"""CAT-03: exact category filter — returns only exact-match category products and
``total`` reflects the filtered set size (unknown category -> empty + total 0)."""
from __future__ import annotations

from datetime import datetime, timezone

from app import db

CATEGORY_A = "electronics"
CATEGORY_B = "accessories"


async def _seed(client) -> None:
    # Isolate each test from data left by siblings in the shared container.
    await db._products.delete_many({})
    await db._products.insert_many(
        [
            {
                "_id": "cat-el-1",
                "name": "Mechanical Keyboard",
                "description": "Tenkeyless mechanical keyboard",
                "category": CATEGORY_A,
                "priceCents": 12999,
                "stock": 42,
                "createdAt": datetime(2026, 1, 1, tzinfo=timezone.utc),
            },
            {
                "_id": "cat-el-2",
                "name": "USB-C Cable",
                "description": "Braided USB-C cable",
                "category": CATEGORY_A,
                "priceCents": 999,
                "stock": 300,
                "createdAt": datetime(2026, 1, 2, tzinfo=timezone.utc),
            },
            {
                "_id": "cat-ac-1",
                "name": "Laptop Sleeve",
                "description": "Felt laptop sleeve",
                "category": CATEGORY_B,
                "priceCents": 1999,
                "stock": 25,
                "createdAt": datetime(2026, 1, 3, tzinfo=timezone.utc),
            },
        ]
    )


async def test_category_filter_exact_match(client):
    await _seed(client)
    resp = await client.get(f"/catalog/products?category={CATEGORY_A}")
    assert resp.status_code == 200
    body = resp.json()
    # Only the requested category is returned.
    cats = {item["category"] for item in body["items"]}
    assert cats == {CATEGORY_A}
    assert len(body["items"]) == 2
    # total reflects the filtered set, not the whole collection.
    assert body["total"] == 2
    assert body["limit"] == 20
    assert body["offset"] == 0


async def test_category_filter_total_vs_full(client):
    await _seed(client)
    full_total = (await client.get("/catalog/products")).json()["total"]
    filtered_total = (
        await client.get(f"/catalog/products?category={CATEGORY_B}")
    ).json()["total"]
    assert full_total == 3
    # Filtered total is the size of the matched subset only.
    assert filtered_total == 1


async def test_unknown_category_empty(client):
    await _seed(client)
    resp = await client.get("/catalog/products?category=does-not-exist")
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == []
    assert body["total"] == 0
