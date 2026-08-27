"""Pytest fixtures for the Catalog Service test suite.

Spins a real MongoDB 8.0 via testcontainers with a session-scoped container, points
the settings singleton at it, and yields an ASGI test client. Also mints a valid
HS256 token (consumed by Plan 04 admin-route tests).
"""
from __future__ import annotations

import jwt
import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.db import close, connect, ensure_indexes
from app.main import app


@pytest.fixture(scope="session")
def mongo_container():
    from testcontainers.community.mongodb import MongoDbContainer

    with MongoDbContainer("mongo:8.0") as container:
        yield container


@pytest.fixture
async def client(mongo_container):
    # Point the settings singleton at the test container (host-mapped port).
    settings.mongo_uri = mongo_container.get_connection_url()
    await connect()
    await ensure_indexes()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await close()


@pytest.fixture
def auth_token() -> str:
    """Mint a valid HS256 token for Plan 04 admin-route tests."""
    payload = {
        "sub": "test-user",
        "email": "test@example.com",
        "roles": ["customer"],
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
    }
    return jwt.encode(payload, settings.jwt_secret_bytes, algorithm="HS256")
