import asyncio

import httpx

from apps.api import main, persistence


def test_history_includes_local_runs_without_supabase(monkeypatch):
    monkeypatch.setattr(persistence, "enabled", lambda: False)
    monkeypatch.setattr(main, "STORE", {})
    monkeypatch.setenv("EXPLAINER", "stub")

    async def skip_persistence(*_args, **_kwargs):
        return False

    monkeypatch.setattr(main.auth, "save_session_with_user", skip_persistence)

    async def exercise_history():
        transport = httpx.ASGITransport(app=main.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            analyzed = await client.post(
                "/api/analyze",
                json={"code": "def add(a, b):\n    return a + b\n", "source_id": "history-test"},
            )
            assert analyzed.status_code == 200
            response = await client.get("/api/history")
            return analyzed.json(), response

    analyzed, response = asyncio.run(exercise_history())
    assert response.status_code == 200
    runs = response.json()
    assert len(runs) == 1
    assert runs[0]["request_id"] == analyzed["request_id"]
    assert runs[0]["source_id"] == "history-test"
    assert runs[0]["state"] == analyzed["state"]
