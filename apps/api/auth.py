"""Authentication module: JWT tokens, password hashing, user management."""

from __future__ import annotations

import os
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import jwt
from dotenv import load_dotenv
from passlib.hash import argon2


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
JWT_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


def _load_jwt_secret() -> str:
    load_dotenv(JWT_ENV_FILE)
    secret = os.getenv("JWT_SECRET", "").strip()
    if not secret:
        raise RuntimeError("JWT_SECRET is required; set it in the environment or repository .env file.")
    return secret


JWT_SECRET = _load_jwt_secret()

JWT_ALGORITHM = "HS256"
JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60  # 7 days


# ---------------------------------------------------------------------------
# Password hashing (Argon2)
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    """Hash a password using Argon2."""
    return argon2.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against an Argon2 hash."""
    try:
        return argon2.verify(password, password_hash)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# JWT handling
# ---------------------------------------------------------------------------
@dataclass
class TokenPayload:
    user_id: str
    email: str
    exp: int
    iat: int


def create_access_token(user_id: str, email: str) -> str:
    """Create a JWT access token."""
    now = int(time.time())
    payload = {
        "user_id": user_id,
        "email": email,
        "iat": now,
        "exp": now + JWT_EXPIRY_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> TokenPayload | None:
    """Decode and validate a JWT token. Returns None if invalid/expired."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return TokenPayload(
            user_id=payload["user_id"],
            email=payload["email"],
            exp=payload["exp"],
            iat=payload["iat"],
        )
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def extract_token_from_header(auth_header: str | None) -> str | None:
    """Extract Bearer token from Authorization header."""
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    return auth_header[7:]


# ---------------------------------------------------------------------------
# Supabase user operations
# ---------------------------------------------------------------------------
from apps.api import persistence


async def create_user(email: str, password: str, display_name: str = "") -> dict[str, Any] | None:
    """Create a new user in Supabase. Returns user dict or None on failure."""
    config = persistence._config()
    if config is None:
        raise RuntimeError("Supabase not configured")

    user_id = secrets.token_hex(16)
    password_hash = hash_password(password)

    try:
        with persistence._client(*config) as client:
            response = client.post(
                "/users",
                json={
                    "user_id": user_id,
                    "email": email.lower().strip(),
                    "password_hash": password_hash,
                    "display_name": display_name,
                },
                headers={"Prefer": "return=representation"},
            )
            response.raise_for_status()
            return response.json()[0]
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 409:
            raise ValueError("Email already registered")
        raise
    except Exception as e:
        raise RuntimeError(f"Registration failed: {e}") from e


async def get_user_by_email(email: str) -> dict[str, Any] | None:
    """Get user by email from Supabase."""
    config = persistence._config()
    if config is None:
        return None
    try:
        with persistence._client(*config) as client:
            response = client.get(
                "/users",
                params={"email": f"eq.{email.lower().strip()}", "limit": "1"},
            )
            response.raise_for_status()
            users = response.json()
            return users[0] if users else None
    except Exception:
        return None


async def get_user_by_id(user_id: str) -> dict[str, Any] | None:
    """Get user by ID from Supabase."""
    config = persistence._config()
    if config is None:
        return None

    try:
        with persistence._client(*config) as client:
            response = client.get(
                "/users",
                params={"user_id": f"eq.{user_id}", "limit": "1"},
            )
            response.raise_for_status()
            users = response.json()
            return users[0] if users else None
    except Exception:
        return None


async def authenticate_user(email: str, password: str) -> dict[str, Any] | None:
    """Authenticate user with email and password. Returns user dict with token or None."""
    user = await get_user_by_email(email)
    if not user:
        return None

    if not verify_password(password, user["password_hash"]):
        return None

    token = create_access_token(user["user_id"], user["email"])
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "display_name": user.get("display_name", ""),
        "token": token,
    }


# ---------------------------------------------------------------------------
# Current user from request (for protected endpoints)
# ---------------------------------------------------------------------------
async def get_current_user(authorization: str | None) -> dict[str, Any] | None:
    """Extract and validate current user from Authorization header."""
    token = extract_token_from_header(authorization)
    if not token:
        return None

    payload = decode_token(token)
    if not payload:
        return None

    # Optionally verify user still exists in DB
    user = await get_user_by_id(payload.user_id)
    if not user:
        return None

    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "display_name": user.get("display_name", ""),
    }


# ---------------------------------------------------------------------------
# History with user scoping
# ---------------------------------------------------------------------------
async def list_user_history(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """Get history runs for a specific user."""
    config = persistence._config()
    if config is None:
        return []

    try:
        with persistence._client(*config) as client:
            response = client.get(
                "/run_history",
                params={
                    "user_id": f"eq.{user_id}",
                    "order": "created_at.desc",
                    "limit": str(max(1, min(limit, 200))),
                },
            )
            response.raise_for_status()
            return response.json()
    except Exception:
        return []


async def save_session_with_user(session: dict[str, Any], user_id: str | None) -> bool:
    """Save session to Supabase with optional user_id for scoped history."""
    config = persistence._config()
    if config is None:
        return False

    try:
        orchestrator = session["orchestrator"]
        sm = orchestrator.sm
        request_id = sm.request_id
        proposal = session["proposal"].model_dump(mode="json")
        snippet = session["snippet"]
        evidence = [e.model_dump(mode="json") for e in orchestrator.ledger.all()]
        snippet_hash = next(
            (e["extracted"]["snippet_hash"] for e in evidence if "snippet_hash" in e["extracted"]),
            None,
        )

        with persistence._client(*config) as client:
            persistence._upsert(client, "snippet_runs", {
                "request_id": request_id,
                "user_id": user_id,
                "source_id": snippet.source_id,
                "code": snippet.code,
                "snippet_hash": snippet_hash,
                "submitted_at": snippet.submitted_at.isoformat(),
                "state": sm.current.value,
                "language_name": proposal["language"]["name"],
                "language_confidence": proposal["language"]["confidence"],
                "language_source": proposal["language"]["source"],
                "explanation": proposal["explanation"],
                "documentation": proposal["documentation"],
                "output_hash": proposal["output_hash"],
            }, "request_id")

            chained = {
                event.seq: (prev, fp) for event, prev, fp in sm.event_chain.entries()
            } if sm.event_chain else {}
            events = []
            for event in sm.events:
                prev, fingerprint = chained.get(event.seq, (None, None))
                row = event.model_dump(mode="json")
                events.append({**row, "prev_hash": prev, "fingerprint": fingerprint})
            persistence._upsert(client, "workflow_events", events, "request_id,seq", ignore=True)

            persistence._upsert(
                client,
                "evidence",
                [{**row, "request_id": request_id, "idx": i} for i, row in enumerate(evidence)],
                "request_id,idx",
                ignore=True,
            )

            approval = session.get("approval")
            if approval is not None:
                persistence._upsert(
                    client,
                    "approvals",
                    {**approval.model_dump(mode="json"), "request_id": request_id},
                    "request_id",
                )

            final = session.get("final_result")
            if final is not None:
                persistence._upsert(client, "final_results", final.model_dump(mode="json"), "request_id")

        return True
    except Exception as error:
        import logging
        log = logging.getLogger("snippet.auth")
        log.warning("Supabase save_session_with_user failed: %s", error)
        return False
