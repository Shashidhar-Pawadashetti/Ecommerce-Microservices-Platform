"""Idempotent Catalog Service seed.

Populates the ``products`` collection with ~20 realistic products carrying
stable string ids (``prod-1001``..``prod-1020``) and bundled placeholder
image URLs rooted at ``/catalog/static/products/{id}.svg`` (served by the
StaticFiles mount established in Plan 01, so they ride the gateway proxy with
no extra routing).

Idempotency contract (CAT-05):
  * Each product is upserted keyed on its stable ``_id``.
  * The fixed ``createdAt`` is written only on insert (``$setOnInsert``), so
    re-running the seed is a no-op: the count stays at 20 and ``createdAt``
    is preserved byte-for-byte.
  * ``imageUrl`` values are root-relative (never absolute external URLs).

Run with: ``python -m scripts.seed`` from the service directory.
"""
from __future__ import annotations

import asyncio

from app.db import close, connect, ensure_indexes, products_collection

# Fixed-point creation timestamps (ISO-8601, 3-digit ms + Z, interop Rule 1).
# Computed deterministically from a base so every re-run yields identical
# strings (idempotency depends on the createdAt value never changing).
from datetime import datetime, timedelta

_BASE = datetime(2026, 8, 24, 12, 0, 0)


def _ts(offset_minutes: int) -> str:
    d = _BASE + timedelta(minutes=offset_minutes)
    return d.strftime("%Y-%m-%dT%H:%M:%S") + ".000Z"


def _img(product_id: str) -> str:
    return f"/catalog/static/products/{product_id}.svg"


# ~20 realistic products. ``id`` and ``createdAt`` are special-cased by the
# upsert; everything else is set on every run (values are stable, so a re-run
# is still a no-op for observable state).
PRODUCTS: list[dict] = [
    {
        "id": "prod-1001",
        "name": "Mechanical Keyboard",
        "description": "Tenkeyless mechanical keyboard with hot-swappable switches.",
        "category": "electronics",
        "priceCents": 12999,
        "stock": 42,
        "createdAt": _ts(0),
    },
    {
        "id": "prod-1002",
        "name": "USB-C Cable",
        "description": "1.5m braided USB-C to USB-C charging cable.",
        "category": "accessories",
        "priceCents": 999,
        "stock": 300,
        "createdAt": _ts(5),
    },
    {
        "id": "prod-1003",
        "name": "Wireless Mouse",
        "description": "Ergonomic 2.4GHz wireless mouse with silent clicks.",
        "category": "electronics",
        "priceCents": 2499,
        "stock": 150,
        "createdAt": _ts(10),
    },
    {
        "id": "prod-1004",
        "name": '27" 4K Monitor',
        "description": "27-inch 4K IPS monitor with USB-C power delivery.",
        "category": "electronics",
        "priceCents": 29999,
        "stock": 25,
        "createdAt": _ts(15),
    },
    {
        "id": "prod-1005",
        "name": "Laptop Stand",
        "description": "Aluminum foldable laptop stand for ergonomic typing.",
        "category": "accessories",
        "priceCents": 3499,
        "stock": 80,
        "createdAt": _ts(20),
    },
    {
        "id": "prod-1006",
        "name": "Cotton T-Shirt",
        "description": "Soft 100% organic cotton crew-neck t-shirt.",
        "category": "apparel",
        "priceCents": 1999,
        "stock": 200,
        "createdAt": _ts(25),
    },
    {
        "id": "prod-1007",
        "name": "Hooded Sweatshirt",
        "description": "Heavyweight fleece hoodie with kangaroo pocket.",
        "category": "apparel",
        "priceCents": 4499,
        "stock": 120,
        "createdAt": _ts(30),
    },
    {
        "id": "prod-1008",
        "name": "Running Shoes",
        "description": "Lightweight breathable running shoes with cushioned sole.",
        "category": "apparel",
        "priceCents": 8999,
        "stock": 60,
        "createdAt": _ts(35),
    },
    {
        "id": "prod-1009",
        "name": "Ceramic Coffee Mug",
        "description": "350ml glazed ceramic mug, dishwasher safe.",
        "category": "home",
        "priceCents": 1499,
        "stock": 250,
        "createdAt": _ts(40),
    },
    {
        "id": "prod-1010",
        "name": "Stainless Water Bottle",
        "description": "750ml double-walled insulated stainless bottle.",
        "category": "home",
        "priceCents": 2499,
        "stock": 180,
        "createdAt": _ts(45),
    },
    {
        "id": "prod-1011",
        "name": "Desk Lamp",
        "description": "LED desk lamp with adjustable color temperature.",
        "category": "home",
        "priceCents": 3999,
        "stock": 90,
        "createdAt": _ts(50),
    },
    {
        "id": "prod-1012",
        "name": "Bluetooth Speaker",
        "description": "Portable waterproof Bluetooth speaker with 12h battery.",
        "category": "electronics",
        "priceCents": 5999,
        "stock": 70,
        "createdAt": _ts(55),
    },
    {
        "id": "prod-1013",
        "name": "Webcam 1080p",
        "description": "Full-HD 1080p webcam with auto-focus and privacy shutter.",
        "category": "electronics",
        "priceCents": 4999,
        "stock": 110,
        "createdAt": _ts(60),
    },
    {
        "id": "prod-1014",
        "name": "HDMI Cable",
        "description": "2m high-speed HDMI 2.1 cable, 4K@120Hz capable.",
        "category": "accessories",
        "priceCents": 1299,
        "stock": 400,
        "createdAt": _ts(65),
    },
    {
        "id": "prod-1015",
        "name": "Phone Case",
        "description": "Shock-absorbing TPU case with matte finish.",
        "category": "accessories",
        "priceCents": 1799,
        "stock": 220,
        "createdAt": _ts(70),
    },
    {
        "id": "prod-1016",
        "name": "Throw Blanket",
        "description": "Cozy 130x170cm woven throw blanket.",
        "category": "home",
        "priceCents": 2999,
        "stock": 75,
        "createdAt": _ts(75),
    },
    {
        "id": "prod-1017",
        "name": "Bean Bag Chair",
        "description": "Large fleece bean bag chair with removable cover.",
        "category": "home",
        "priceCents": 12999,
        "stock": 30,
        "createdAt": _ts(80),
    },
    {
        "id": "prod-1018",
        "name": "Denim Jeans",
        "description": "Slim-fit stretch denim jeans, mid-rise.",
        "category": "apparel",
        "priceCents": 5999,
        "stock": 140,
        "createdAt": _ts(85),
    },
    {
        "id": "prod-1019",
        "name": "Wool Socks (3-pack)",
        "description": "Merino wool blend socks, pack of three.",
        "category": "apparel",
        "priceCents": 1499,
        "stock": 300,
        "createdAt": _ts(90),
    },
    {
        "id": "prod-1020",
        "name": "Noise-Cancelling Headphones",
        "description": "Over-ear active noise-cancelling headphones with ANC.",
        "category": "electronics",
        "priceCents": 19999,
        "stock": 50,
        "createdAt": _ts(95),
    },
]


async def run_seed() -> int:
    """Upsert every product idempotently. Returns the number of products."""
    products = products_collection()
    for row in PRODUCTS:
        # _id mirrors the stable string id. createdAt + id are frozen on insert
        # only; all other fields are re-applied each run (they never change, so
        # the observable document is identical on re-run).
        await products.update_one(
            {"_id": row["id"]},
            {
                "$set": {
                    k: v for k, v in row.items() if k not in ("id", "createdAt")
                },
                "$setOnInsert": {
                    "createdAt": row["createdAt"],
                    "id": row["id"],
                },
            },
            upsert=True,
        )
    # imageUrl is derived from the stable id (root-relative SVG path).
    for row in PRODUCTS:
        await products.update_one(
            {"_id": row["id"]},
            {"$set": {"imageUrl": _img(row["id"])}},
            upsert=False,
        )
    return len(PRODUCTS)


async def _main() -> None:
    await connect()
    await ensure_indexes()
    n = await run_seed()
    print(f"Seeded {n} products (idempotent: re-running is a no-op).")
    await close()


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    main()
