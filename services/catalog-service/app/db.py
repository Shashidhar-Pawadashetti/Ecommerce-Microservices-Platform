"""MongoDB access layer for the Catalog Service.

Uses pymongo's native asyncio client (AsyncMongoClient, >=4.9) — Motor is
forbidden. Reads map Mongo ``_id`` -> ``id`` (interop Rule 3). Indexes
(category asc, plus exactly one text index on name+description) are created
idempotently at startup so re-runs are safe.
"""
from __future__ import annotations

from typing import Any, Optional

from pymongo import ASCENDING, TEXT
from pymongo.errors import OperationFailure

from .config import settings

_client = None
_db = None
_products = None


async def connect() -> None:
    """Build the AsyncMongoClient and resolve the products collection."""
    global _client, _db, _products
    from pymongo import AsyncMongoClient

    _client = AsyncMongoClient(settings.mongo_uri)
    _db = _client[settings.mongo_db]
    _products = _db[settings.mongo_collection]


async def ensure_indexes() -> None:
    """Idempotently create the category index and the single text index.

    An equal-spec re-create raises OperationFailure on some servers; we swallow
    that so startup is safe to re-run.
    """
    assert _products is not None, "connect() must run before ensure_indexes()"
    try:
        await _products.create_index([("category", ASCENDING)])
    except OperationFailure:
        pass
    try:
        await _products.create_index([("name", TEXT), ("description", TEXT)])
    except OperationFailure:
        pass


async def close() -> None:
    """Close the client."""
    global _client, _db, _products
    if _client is not None:
        await _client.close()
    _client = None
    _db = None
    _products = None


def _doc_to_product(doc: dict) -> dict:
    """Map a Mongo document to a wire Product dict (Rule 3: _id -> id)."""
    mapped = dict(doc)
    mapped["id"] = str(mapped.pop("_id"))
    return mapped


def _doc_to_batch(doc: dict) -> dict:
    return {
        "productId": str(doc["_id"]),
        "name": doc["name"],
        "priceCents": doc["priceCents"],
    }


async def list_products(
    category: Optional[str] = None,
    q: Optional[str] = None,
    sort_spec: Optional[list[tuple[str, int]]] = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """Return one page of products plus the total size of the filtered set.

    ``sort_spec`` is an explicit list of ``(field, direction)`` tuples; the caller
    is expected to include a deterministic tie-break (``("_id", 1)``) as the final
    element so pagination is repeatable. ``category`` is an EXACT-match filter and
    ``q`` adds a ``$text`` clause only when non-empty — raw request JSON is never
    interpolated into the query (T-03-03 NoSQL injection guard).
    """
    assert _products is not None, "connect() must run before list_products()"
    query: dict[str, Any] = {}
    # Exact category match — no substring/operator logic (injection guard).
    if category:
        query["category"] = category
    # $text search only when q is non-empty; empty/absent q omits the clause.
    if q:
        query["$text"] = {"$search": q}

    total = await _products.count_documents(query)
    # Defense-in-depth: guarantee a deterministic _id tie-break so listings are
    # stable even if a caller forgets to append one.
    if not sort_spec:
        sort_spec = [("name", ASCENDING)]
    elif sort_spec[-1][0] != "_id":
        sort_spec = list(sort_spec) + [("_id", ASCENDING)]
    cursor = _products.find(query).sort(sort_spec).skip(offset).limit(limit)
    items = [_doc_to_product(d) async for d in cursor]
    return items, total


async def get_product(product_id: str) -> Optional[dict]:
    """Fetch one product by string id, or None if unknown."""
    assert _products is not None, "connect() must run before get_product()"
    doc = await _products.find_one({"_id": product_id})
    return _doc_to_product(doc) if doc is not None else None


async def batch_get(ids: list[str]) -> list[dict]:
    """Return current name + priceCents for KNOWN ids; unknown ids are omitted."""
    assert _products is not None, "connect() must run before batch_get()"
    if not ids:
        return []
    cursor = _products.find({"_id": {"$in": ids}})
    return [_doc_to_batch(d) async for d in cursor]
