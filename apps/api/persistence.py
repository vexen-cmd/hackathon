"""Best-effort Supabase persistence for finished workflow state.

Talks to Supabase's PostgREST endpoint with httpx (already in requirements.txt), so no new
dependency. Enabled only when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set; otherwise
every function is a no-op and the API keeps working from its in-memory STORE.
Failures are logged and swallowed: the audit store must never break the user-facing flow.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

log = logging.getLogger("snippet.persistence")
TIMEOUT = 5.0
_transport: httpx.BaseTransport | None = None  # tests inject a MockTransport here


def _config() -> tuple[str, str] | None:
    url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    return (url, key) if url and key else None


def enabled() -> bool:
    return _config() is not None


def _client(url: str, key: str) -> httpx.Client:
    return httpx.Client(
        base_url=f"{url}/rest/v1",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept-Profile": "public",
            "Content-Profile": "public",
        },
        timeout=TIMEOUT,
        transport=_transport,
    )


def _upsert(client: httpx.Client, table: str, rows: list[dict[str, Any]] | dict[str, Any], on_conflict: str, *, ignore: bool = False) -> None:
    if isinstance(rows, list) and not rows:
        return
    resolution = "ignore-duplicates" if ignore else "merge-duplicates"
    response = client.post(
        f"/{table}",
        params={"on_conflict": on_conflict},
        headers={"Prefer": f"resolution={resolution},return=minimal"},
        json=rows,
    )
    response.raise_for_status()


def save_session(session: dict[str, Any]) -> bool:
    """Upsert the run and all child rows. Safe to call after every workflow step."""
    config = _config()
    if config is None:
        return False
    try:
        orchestrator = session["orchestrator"]
        sm = orchestrator.sm
        request_id = sm.request_id
        proposal = session["proposal"].model_dump(mode="json")
        snippet = session["snippet"]
        evidence = [e.model_dump(mode="json") for e in orchestrator.ledger.all()]
        snippet_hash = next((e["extracted"]["snippet_hash"] for e in evidence if "snippet_hash" in e["extracted"]), None)

        with _client(*config) as client:
            _upsert(client, "snippet_runs", {
                "request_id": request_id,
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
                "tags": proposal.get("tags", []),
            }, "request_id")

            chained = {event.seq: (prev, fp) for event, prev, fp in sm.event_chain.entries()} if sm.event_chain else {}
            events = []
            for event in sm.events:
                prev, fingerprint = chained.get(event.seq, (None, None))
                row = event.model_dump(mode="json")
                events.append({**row, "prev_hash": prev, "fingerprint": fingerprint})
            _upsert(client, "workflow_events", events, "request_id,seq", ignore=True)

            _upsert(client, "evidence", [{**row, "request_id": request_id, "idx": i} for i, row in enumerate(evidence)], "request_id,idx", ignore=True)

            approval = session.get("approval")
            if approval is not None:
                _upsert(client, "approvals", {**approval.model_dump(mode="json"), "request_id": request_id}, "request_id")

            final = session.get("final_result")
            if final is not None:
                _upsert(client, "final_results", final.model_dump(mode="json"), "request_id")
        return True
    except Exception as error:  # noqa: BLE001 - persistence is best-effort by design
        log.warning("Supabase save failed: %s", error)
        return False


def list_history(limit: int = 50) -> list[dict[str, Any]]:
    config = _config()
    if config is None:
        return []
    try:
        with _client(*config) as client:
            response = client.get("/run_history", params={"order": "created_at.desc", "limit": str(limit)})
            response.raise_for_status()
            return response.json()
    except Exception as error:  # noqa: BLE001
        log.warning("Supabase history failed: %s", error)
        return []
