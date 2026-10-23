"""FastAPI deployment adapter for the deterministic snippet harness."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import Depends, FastAPI, HTTPException, Header, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field

from agent.harness.approval import StaleApproval, apply_edits, make_approval_receipt
from agent.harness.evidence import EvidenceLedger
from agent.harness.orchestrator import Orchestrator
from agent.harness.state_machine import StateMachine
from agent.tools.explainer import ExplainError, Explainer, StubExplainer
from agent.tools.gemini_explainer import GeminiExplainer
from agent.tools.language_detect import detect_language
from agent.tools.local_explainer import LocalExplainer
from apps.api import persistence, auth
from contracts.schemas import Approval, CodeSnippet, ProposedOutput


app = FastAPI(title="Code Snippet Explainer")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STORE: dict[str, dict[str, Any]] = {}
ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "frontend" / "dist" / "index.html"
ASSETS_DIR = ROOT / "frontend" / "dist" / "assets"
if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")


# ---------------------------------------------------------------------------
# Pydantic models for auth
# ---------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(default="", max_length=64)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    user_id: str
    email: str
    display_name: str
    token: str


class UserResponse(BaseModel):
    user_id: str
    email: str
    display_name: str


class AnalyzeRequest(BaseModel):
    code: str
    source_id: str


class ReviewRequest(BaseModel):
    approver_id: str
    decision: Literal["approve", "reject"]
    edited_explanation: str | None = None
    edited_documentation: str | None = None


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------
async def get_current_user_optional(authorization: str | None = Header(None)) -> dict[str, Any] | None:
    """Optional auth - returns user if valid token, None otherwise."""
    return await auth.get_current_user(authorization)


async def get_current_user_required(authorization: str | None = Header(None)) -> dict[str, Any]:
    """Required auth - raises 401 if no valid token."""
    user = await auth.get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


# ---------------------------------------------------------------------------
# Explainer factory
# ---------------------------------------------------------------------------
def build_explainer() -> Explainer:
    """Pick the explainer backend from the environment.

    EXPLAINER=stub   -> StubExplainer (offline, deterministic; default)
    EXPLAINER=ollama -> LocalExplainer (needs a running Ollama server)
    EXPLAINER=gemini -> GeminiExplainer (needs GEMINI_API_KEY)
    """
    backend = os.getenv("EXPLAINER", "stub").strip().lower()
    if backend == "ollama":
        return LocalExplainer(host=os.environ["OLLAMA_HOST"]) if os.getenv("OLLAMA_HOST") else LocalExplainer()
    if backend == "gemini":
        return GeminiExplainer()
    if backend == "stub":
        return StubExplainer()
    raise HTTPException(400, f"Unknown EXPLAINER backend: {backend}")


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------
def serialize(session: dict[str, Any]) -> dict[str, Any]:
    orchestrator = session["orchestrator"]
    response: dict[str, Any] = {
        "request_id": orchestrator.sm.request_id,
        "state": orchestrator.sm.current.value,
        "proposal": session["proposal"].model_dump(mode="json"),
        "events": [event.model_dump(mode="json") for event in orchestrator.sm.events],
        "evidence": [evidence.model_dump(mode="json") for evidence in orchestrator.ledger.all()],
    }
    if session.get("final_result") is not None:
        response["final_result"] = session["final_result"].model_dump(mode="json")
    return response


def get_session(request_id: str) -> dict[str, Any]:
    try:
        return STORE[request_id]
    except KeyError as error:
        raise HTTPException(404, "Session not found") from error


# ---------------------------------------------------------------------------
# Health & Public Endpoints
# ---------------------------------------------------------------------------
@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    if INDEX.exists():
        return FileResponse(INDEX)
    return FileResponse(ROOT / "frontend" / "index.html")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "ollama_host": os.getenv("OLLAMA_HOST", "http://localhost:11434"),
        "explainer": os.getenv("EXPLAINER", "stub"),
        "supabase": "enabled" if persistence.enabled() else "disabled",
    }


# ---------------------------------------------------------------------------
# Auth Endpoints
# ---------------------------------------------------------------------------
@app.post("/api/auth/register", response_model=TokenResponse)
async def register(body: RegisterRequest) -> TokenResponse:
    if not persistence.enabled():
        raise HTTPException(503, "Supabase not configured")

    try:
        user = await auth.create_user(body.email, body.password, body.display_name)
    except ValueError as e:
        raise HTTPException(409, str(e))
    except RuntimeError as e:
        raise HTTPException(500, str(e))

    token = auth.create_access_token(user["user_id"], user["email"])
    return TokenResponse(
        user_id=user["user_id"],
        email=user["email"],
        display_name=user.get("display_name", ""),
        token=token,
    )


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    if not persistence.enabled():
        raise HTTPException(503, "Supabase not configured")

    user = await auth.authenticate_user(body.email, body.password)
    if not user:
        raise HTTPException(401, "Invalid email or password")

    return TokenResponse(
        user_id=user["user_id"],
        email=user["email"],
        display_name=user.get("display_name", ""),
        token=user["token"],
    )


@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: dict[str, Any] = Depends(get_current_user_required)) -> UserResponse:
    return UserResponse(
        user_id=current_user["user_id"],
        email=current_user["email"],
        display_name=current_user.get("display_name", ""),
    )


# ---------------------------------------------------------------------------
# History Endpoints (user-scoped if authenticated)
# ---------------------------------------------------------------------------
def _local_history(limit: int, user_id: str | None) -> list[dict[str, Any]]:
    runs = []
    for request_id, session in reversed(list(STORE.items())):
        if session.get("user_id") != user_id:
            continue
        proposal = session["proposal"]
        snippet = session["snippet"]
        runs.append({
            "request_id": request_id,
            "source_id": snippet.source_id,
            "language_name": proposal.language.name,
            "state": session["orchestrator"].sm.current.value,
            "output_hash": proposal.output_hash,
            "created_at": snippet.submitted_at.isoformat(),
        })
    return runs[:max(1, min(limit, 200))]


@app.get("/api/history")
async def history(
    limit: int = 50,
    current_user: dict[str, Any] | None = Depends(get_current_user_optional),
) -> list[dict[str, Any]]:
    user_id = current_user["user_id"] if current_user else None
    local_runs = _local_history(limit, user_id)
    if not persistence.enabled():
        return local_runs

    if current_user:
        stored_runs = await auth.list_user_history(current_user["user_id"], limit)
    else:
        stored_runs = persistence.list_history(max(1, min(limit, 200)))
    return stored_runs or local_runs


# ---------------------------------------------------------------------------
# Workflow Endpoints
# ---------------------------------------------------------------------------
@app.post("/api/analyze")
async def analyze(
    body: AnalyzeRequest,
    response: Response,
    current_user: dict[str, Any] | None = Depends(get_current_user_optional),
) -> dict[str, Any]:
    request_id = uuid.uuid4().hex
    explainer = build_explainer()
    orchestrator = Orchestrator(StateMachine(request_id), EvidenceLedger(), detect_language, explainer)
    snippet = CodeSnippet(code=body.code, source_id=body.source_id, submitted_at=datetime.now(timezone.utc))
    try:
        proposal = orchestrator.run_analysis(snippet)
    except ExplainError as error:
        raise HTTPException(503, str(error)) from error
    if proposal is None:
        reason = orchestrator.sm.events[-1].detail.get("reason", "Analysis failed")
        if orchestrator.sm.current.value == "failed":
            raise HTTPException(503, reason)
        raise HTTPException(422, reason)

    user_id = current_user["user_id"] if current_user else None
    session = {
        "orchestrator": orchestrator,
        "proposal": proposal,
        "approval": None,
        "final_result": None,
        "snippet": snippet,
        "user_id": user_id,
    }
    STORE[request_id] = session

    # Persist with user_id if authenticated
    await auth.save_session_with_user(session, user_id)

    return serialize(session)


@app.post("/api/{request_id}/review")
async def review(
    request_id: str,
    body: ReviewRequest,
    current_user: dict[str, Any] | None = Depends(get_current_user_optional),
) -> dict[str, Any]:
    session = get_session(request_id)
    proposal: ProposedOutput = session["proposal"]
    approval = Approval(
        proposal_hash=proposal.output_hash,
        approver_id=body.approver_id,
        approved_at=datetime.now(timezone.utc),
        decision=body.decision,
        edited_explanation=body.edited_explanation,
        edited_documentation=body.edited_documentation,
    )
    if body.decision == "approve" and (body.edited_explanation is not None or body.edited_documentation is not None):
        session["proposal"] = apply_edits(proposal, approval)
    try:
        session["orchestrator"].apply_review(session["proposal"], approval)
    except StaleApproval as error:
        raise HTTPException(409, str(error)) from error
    session["approval"] = approval.model_copy(update={"approval_receipt_hash": make_approval_receipt(approval)})

    user_id = current_user["user_id"] if current_user else None
    await auth.save_session_with_user(session, user_id)

    return serialize(session)


@app.post("/api/{request_id}/format")
async def format_result(
    request_id: str,
    current_user: dict[str, Any] | None = Depends(get_current_user_optional),
) -> dict[str, Any]:
    session = get_session(request_id)
    try:
        final_result = session["orchestrator"].format_output(session["proposal"], session["approval"])
    except StaleApproval as error:
        raise HTTPException(409, str(error)) from error
    except (RuntimeError, ValueError) as error:
        raise HTTPException(400, str(error)) from error
    session["final_result"] = final_result

    user_id = current_user["user_id"] if current_user else None
    await auth.save_session_with_user(session, user_id)

    def render_markdown(source: str) -> str:
        """Render delivered Markdown to HTML with the `markdown` library."""
        try:
            import markdown as _markdown
            return _markdown.markdown(source, extensions=["fenced_code", "tables", "sane_lists"])
        except Exception:
            return source

    return {
        "markdown": final_result.formatted_markdown,
        "html": render_markdown(final_result.formatted_markdown or ""),
        "final_result": final_result.model_dump(mode="json"),
    }


@app.get("/api/{request_id}")
async def session_status(request_id: str) -> dict[str, Any]:
    return serialize(get_session(request_id))
