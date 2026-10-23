import asyncio
import json

import httpx
import jwt
import pytest

from apps.api import auth, persistence
from apps.api.main import app


def configure_supabase(monkeypatch, handler):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    monkeypatch.setattr(persistence, "_transport", httpx.MockTransport(handler))


def test_registers_custom_user(monkeypatch):
    requests = []

    def handler(request):
        requests.append(request)
        body = json.loads(request.content)
        return httpx.Response(201, json=[{**body, "created_at": "now", "updated_at": "now"}])

    configure_supabase(monkeypatch, handler)
    user = asyncio.run(auth.create_user("  USER@example.com ", "correct horse", "User"))

    request = requests[0]
    assert request.url.path == "/rest/v1/users"
    assert request.headers["content-profile"] == "public"
    assert request.headers["accept-profile"] == "public"
    body = json.loads(request.content)
    assert body["email"] == "user@example.com"
    assert body["display_name"] == "User"
    assert auth.verify_password("correct horse", body["password_hash"])
    assert user["user_id"] == body["user_id"]


def test_duplicate_email_is_reported(monkeypatch):
    configure_supabase(monkeypatch, lambda request: httpx.Response(409, json={"message": "duplicate"}))

    with pytest.raises(ValueError, match="Email already registered"):
        asyncio.run(auth.create_user("user@example.com", "password"))


def test_login_verifies_custom_user_password(monkeypatch):
    user = {
        "user_id": "a" * 32,
        "email": "user@example.com",
        "password_hash": auth.hash_password("correct horse"),
        "display_name": "User",
    }

    def handler(request):
        assert request.method == "GET"
        assert request.url.path == "/rest/v1/users"
        assert request.url.params["email"] == "eq.user@example.com"
        return httpx.Response(200, json=[user])

    configure_supabase(monkeypatch, handler)
    logged_in = asyncio.run(auth.authenticate_user("USER@example.com", "correct horse"))

    assert logged_in is not None
    assert logged_in["user_id"] == user["user_id"]
    assert auth.decode_token(logged_in["token"]).user_id == user["user_id"]
    assert asyncio.run(auth.authenticate_user("user@example.com", "wrong password")) is None


def test_auth_endpoints_register_duplicate_and_login(monkeypatch):
    users = {}

    def database_handler(request):
        if request.method == "POST":
            user = json.loads(request.content)
            if user["email"] in users:
                return httpx.Response(409, json={"message": "duplicate"})
            users[user["email"]] = user
            return httpx.Response(201, json=[user])

        email = request.url.params["email"].removeprefix("eq.")
        user = users.get(email)
        return httpx.Response(200, json=[user] if user else [])

    configure_supabase(monkeypatch, database_handler)

    async def exercise_endpoints():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            registration = await client.post(
                "/api/auth/register",
                json={"email": "user@example.com", "password": "correct horse", "display_name": "User"},
            )
            duplicate = await client.post(
                "/api/auth/register",
                json={"email": "user@example.com", "password": "correct horse", "display_name": "User"},
            )
            login = await client.post(
                "/api/auth/login",
                json={"email": "user@example.com", "password": "correct horse"},
            )
            return registration, duplicate, login

    registration, duplicate, login = asyncio.run(exercise_endpoints())
    assert registration.status_code == 200
    assert registration.json()["email"] == "user@example.com"
    assert duplicate.status_code == 409
    assert login.status_code == 200
    assert login.json()["user_id"] == registration.json()["user_id"]


def test_jwt_uses_configured_secret_and_rejects_wrong_secret():
    token = auth.create_access_token("a" * 32, "user@example.com")
    payload = auth.decode_token(token)
    assert payload is not None
    assert payload.user_id == "a" * 32
    assert auth.JWT_ALGORITHM == "HS256"

    invalid = jwt.encode(
        {"user_id": "a" * 32, "email": "user@example.com"},
        "incorrect-signing-secret-with-more-than-thirty-two-bytes",
        algorithm=auth.JWT_ALGORITHM,
    )
    assert auth.decode_token(invalid) is None


def test_jwt_secret_loads_from_dotenv_file(tmp_path, monkeypatch):
    secret = "temporary-test-jwt-secret"
    env_file = tmp_path / ".env"
    env_file.write_text(f"JWT_SECRET={secret}\n", encoding="utf-8")
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.setattr(auth, "JWT_ENV_FILE", env_file)

    assert auth._load_jwt_secret() == secret


def test_missing_jwt_secret_fails_clearly(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.setattr(auth, "load_dotenv", lambda *_args, **_kwargs: None)

    with pytest.raises(RuntimeError, match="JWT_SECRET is required"):
        auth._load_jwt_secret()
