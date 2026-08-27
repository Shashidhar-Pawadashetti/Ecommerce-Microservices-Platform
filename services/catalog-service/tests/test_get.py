"""CAT-02: single-product fetch by id (public); unknown id -> NOT_FOUND envelope."""
from __future__ import annotations

from datetime import datetime, timezone

from app import db

NOT_FOUND_BODY = '{"code":"NOT_FOUND","message":"The requested resource was not found."}'


async def test_get_known(client):
    await db._products.insert_one(
        {
            "_id": "prod-known-1",
            "name": "Known Product",
            "description": "A known product",
            "category": "test",
            "priceCents": 2499,
            "stock": 10,
            "imageUrl": "https://cdn.example.com/prod-known-1.png",
            "createdAt": datetime(2026, 1, 1, tzinfo=timezone.utc),
        }
    )
    resp = await client.get("/catalog/products/prod-known-1")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == "prod-known-1"
    assert body["name"] == "Known Product"
    assert body["priceCents"] == 2499


async def test_get_unknown(client):
    resp = await client.get("/catalog/products/does-not-exist")
    assert resp.status_code == 404
    # Byte-exact NOT_FOUND envelope (interop Rule 4 safe).
    assert resp.text == NOT_FOUND_BODY
