"""CAT-04: text search ($text index), sort direction, pagination boundaries, and
deterministic tie-break stability across repeated calls."""
from __future__ import annotations

from datetime import datetime, timezone

from app import db

PRODUCTS = [
    {
        "_id": "srch-1",
        "name": "Mechanical Keyboard",
        "description": "Tenkeyless mechanical keyboard with hot-swappable switches",
        "category": "electronics",
        "priceCents": 12999,
        "stock": 42,
        "createdAt": datetime(2026, 1, 1, tzinfo=timezone.utc),
    },
    {
        "_id": "srch-2",
        "name": "Wireless Mouse",
        "description": "Ergonomic wireless mouse with silent clicks",
        "category": "electronics",
        "priceCents": 2499,
        "stock": 80,
        "createdAt": datetime(2026, 1, 2, tzinfo=timezone.utc),
    },
    {
        "_id": "srch-3",
        "name": "Laptop Stand",
        "description": "Aluminum laptop stand for better posture",
        "category": "accessories",
        "priceCents": 3999,
        "stock": 15,
        "createdAt": datetime(2026, 1, 3, tzinfo=timezone.utc),
    },
]


async def _seed(client) -> None:
    await db._products.delete_many({})
    await db._products.insert_many(PRODUCTS)


async def test_search_q_matches_and_total(client):
    await _seed(client)
    resp = await client.get("/catalog/products?q=keyboard")
    assert resp.status_code == 200
    body = resp.json()
    ids = [item["id"] for item in body["items"]]
    assert "srch-1" in ids
    assert "srch-2" not in ids
    # total reflects the matched set, not the whole collection.
    assert body["total"] == 1


async def test_empty_q_omits_filter(client):
    # Empty q must behave like absent q: all products match.
    await _seed(client)
    resp = await client.get("/catalog/products?q=")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3


async def test_sort_price_desc(client):
    await _seed(client)
    resp = await client.get("/catalog/products?sort=price&order=desc")
    assert resp.status_code == 200
    prices = [item["priceCents"] for item in resp.json()["items"]]
    assert prices == sorted(prices, reverse=True)


async def test_sort_name_asc(client):
    await _seed(client)
    resp = await client.get("/catalog/products?sort=name&order=asc")
    assert resp.status_code == 200
    names = [item["name"] for item in resp.json()["items"]]
    assert names == sorted(names)


async def test_pagination_limit(client):
    await _seed(client)
    resp = await client.get("/catalog/products?limit=1")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["items"]) <= 1
    # total reflects the full filtered collection, independent of limit.
    assert body["total"] == 3


async def test_offset_beyond_collection(client):
    await _seed(client)
    full_total = (await client.get("/catalog/products")).json()["total"]
    resp = await client.get("/catalog/products?offset=99999")
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == []
    # total is unchanged by a beyond-range offset.
    assert body["total"] == full_total


async def test_tie_break_stable(client):
    # Two products with identical priceCents; the _id tie-break makes the order
    # repeatable across repeated calls.
    await db._products.delete_many({})
    await db._products.insert_many(
        [
            {
                "_id": "tie-b",
                "name": "B Equal Price",
                "description": "same price product b",
                "category": "electronics",
                "priceCents": 1000,
                "stock": 1,
                "createdAt": datetime(2026, 2, 1, tzinfo=timezone.utc),
            },
            {
                "_id": "tie-a",
                "name": "A Equal Price",
                "description": "same price product a",
                "category": "electronics",
                "priceCents": 1000,
                "stock": 1,
                "createdAt": datetime(2026, 2, 2, tzinfo=timezone.utc),
            },
        ]
    )
    r1 = await client.get("/catalog/products?sort=price&order=desc")
    r2 = await client.get("/catalog/products?sort=price&order=desc")
    ids1 = [item["id"] for item in r1.json()["items"]]
    ids2 = [item["id"] for item in r2.json()["items"]]
    # Order is identical across calls (deterministic tie-break).
    assert ids1 == ids2
    # Tie-break is _id ascending: "tie-a" precedes "tie-b".
    assert ids1 == ["tie-a", "tie-b"]
