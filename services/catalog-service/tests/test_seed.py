"""CAT-05 — idempotent seed + static SVG serving.

Proves:
  1. The seed populates exactly 20 products with stable ids prod-1001..prod-1020.
  2. Re-running the seed is a no-op: count stays 20 and createdAt is preserved
     byte-for-byte (idempotent upsert via $setOnInsert).
  3. A seeded placeholder SVG is served 200 with an svg content-type via the
     /catalog/static StaticFiles mount established in Plan 01.

Uses a real MongoDB 8.0 via testcontainers (same pattern as the Plan 01 suite).
"""
from __future__ import annotations

import os

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.db import close, connect, ensure_indexes, products_collection
from scripts import seed as seed_module

EXPECTED_COUNT = 20


@pytest.fixture(scope="session")
def mongo_container():
    from testcontainers.community.mongodb import MongoDbContainer

    with MongoDbContainer("mongo:8.0") as container:
        yield container


@pytest.fixture
async def seed_db(mongo_container):
    settings.mongo_uri = mongo_container.get_connection_url()
    await connect()
    await ensure_indexes()
    yield
    await close()


async def test_seed_creates_twenty_products(seed_db) -> None:
    await seed_module.run_seed()
    count = await products_collection().count_documents({})
    assert count == EXPECTED_COUNT


async def test_seed_is_idempotent(seed_db) -> None:
    await seed_module.run_seed()
    first = await products_collection().find_one({"_id": "prod-1001"})
    assert first is not None
    first_created = first["createdAt"]
    first_count = await products_collection().count_documents({})

    # Second run must change nothing observable.
    await seed_module.run_seed()
    second = await products_collection().find_one({"_id": "prod-1001"})
    assert second["createdAt"] == first_created
    assert await products_collection().count_documents({}) == first_count == EXPECTED_COUNT

    # Every id is present and stable.
    ids = {
        d["_id"] async for d in products_collection().find({}, {"_id": 1})
    }
    assert {f"prod-{i:04d}" for i in range(1001, 1021)}.issubset(ids)


async def test_seeded_svg_served_with_svg_content_type() -> None:
    # Static assets are committed on disk; no DB connection required.
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/catalog/static/products/prod-1001.svg")
    assert resp.status_code == 200
    assert "svg" in resp.headers.get("content-type", "")
    assert resp.text.lstrip().startswith("<svg")


async def test_seeded_image_url_is_root_relative(seed_db) -> None:
    """imageUrl values point at the gateway-riding /catalog/static path, never an
    absolute external URL (so they work behind the Phase 7 proxy)."""
    await seed_module.run_seed()
    doc = await products_collection().find_one({"_id": "prod-1001"})
    assert doc["imageUrl"] == "/catalog/static/products/prod-1001.svg"
    assert not doc["imageUrl"].startswith("http")
