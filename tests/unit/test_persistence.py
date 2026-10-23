import json
from datetime import datetime, timezone

import httpx
import pytest

from agent.harness.approval import make_approval_receipt
from agent.harness.evidence import EvidenceLedger
from agent.harness.orchestrator import Orchestrator
from agent.harness.state_machine import StateMachine
from agent.tools.language_detect import detect_language
from apps.api import persistence
from contracts.schemas import Approval, CodeSnippet


class FakeExplainer:
    def explain_and_document(self, code, language):
        return "It adds numbers.", "# add\nAdds two numbers.", ["test", "demo"]


def build_session():
    snippet = CodeSnippet(code="def add(a, b):\n    return a + b\n", source_id="snippet-1", submitted_at=datetime.now(timezone.utc))
    orch = Orchestrator(StateMachine("a" * 32), EvidenceLedger(), detect_language, FakeExplainer())
    proposal = orch.run_analysis(snippet)
    approval = Approval(proposal_hash=proposal.output_hash, approver_id="me", approved_at=datetime.now(timezone.utc), decision="approve")
    orch.apply_review(proposal, approval)
    approval = approval.model_copy(update={"approval_receipt_hash": make_approval_receipt(approval)})
    final = orch.format_output(proposal, approval)
    return {"orchestrator": orch, "proposal": proposal, "approval": approval, "final_result": final, "snippet": snippet}


def test_disabled_without_env(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    assert persistence.enabled() is False
    assert persistence.save_session(build_session()) is False
    assert persistence.list_history() == []


def test_save_session_posts_all_tables(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "secret")
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.url.path, request.url.params["on_conflict"], json.loads(request.content), request.headers))
        return httpx.Response(201)

    monkeypatch.setattr(persistence, "_transport", httpx.MockTransport(handler))
    assert persistence.save_session(build_session()) is True

    assert [c[0] for c in calls] == [f"/rest/v1/{t}" for t in ("snippet_runs", "workflow_events", "evidence", "approvals", "final_results")]
    assert calls[0][3]["authorization"] == "Bearer secret"
    run = calls[0][2]
    assert run["state"] == "delivered" and run["language_name"] == "Python" and run["snippet_hash"] and run["tags"] == ["test", "demo"]

    events = calls[1][2]
    assert events[0]["seq"] == 1 and events[0]["fingerprint"] is None  # initial event is not chained
    assert events[1]["prev_hash"] == "GENESIS"
    for before, after in zip(events[1:], events[2:]):
        assert after["prev_hash"] == before["fingerprint"]
    assert [e["idx"] for e in calls[2][2]] == list(range(len(calls[2][2])))
    assert calls[4][2]["event_chain_verified"] is True


def test_save_swallows_errors(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "secret")
    monkeypatch.setattr(persistence, "_transport", httpx.MockTransport(lambda r: httpx.Response(500)))
    assert persistence.save_session(build_session()) is False
