"""CAT-01: public, unauthenticated product listing (no token required)."""
from __future__ import annotations

from datetime import datetime, timezone

from app import db


async def test_public_list_no_auth(client):
    resp = await client.get("/catalog/products")
    assert resp.status_code == 200
    body = resp.json()
    assert set(["items", "total", "limit", "offset"]).issubset(body)
    assert isinstance(body["items"], list)
    assert isinstance(body["total"], int)
    assert isinstance(body["limit"], int)
    assert isinstance(body["offset"], int)


async def test_list_default_pagination(client):
    resp = await client.get("/catalog/products")
    assert resp.status_code == 200
    body = resp.json()
    assert body["limit"] == 20
    assert body["total"] >= 0


async def test_list_includes_inserted(client):
    await db._products.insert_one(
        {
            "_id": "prod-test-1",
            "name": "Test Product",
            "category": "test",
            "priceCents": 1000,
            "stock": 5,
            "createdAt": datetime(2026, 1, 1, tzinfo=timezone.utc),
        }
    )
    resp = await client.get("/catalog/products")
    assert resp.status_code == 200
    ids = [item["id"] for item in resp.json()["items"]]
    assert "prod-test-1" in ids
