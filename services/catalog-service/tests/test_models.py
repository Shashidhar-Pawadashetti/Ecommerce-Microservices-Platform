"""Interop serialization contract (docs/json-interop.md) at the model level.

Rule 1 — createdAt: exactly 3-digit ms + Z (never 6-digit microseconds).
Rule 2 — priceCents: integer; negative rejected.
Rule 4 — optional fields omitted (exclude_none), never null.
Rule 5 — extra="ignore": unknown fields tolerated.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

import pytest

from app.models import Product

MS_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")


def _product(**overrides) -> Product:
    base = dict(
        id="prod-1",
        name="Widget",
        category="test",
        priceCents=1000,
        stock=3,
        createdAt=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    base.update(overrides)
    return Product(**base)


def test_createdAt_ms():
    # Microseconds beyond the 3rd digit must be truncated, not emitted.
    p = _product(createdAt=datetime(2026, 8, 24, 12, 0, 0, 123456, tzinfo=timezone.utc))
    body = p.model_dump_json()
    import json

    created = json.loads(body)["createdAt"]
    assert MS_RE.match(created), created
    assert created == "2026-08-24T12:00:00.123Z"


def test_exclude_none():
    p = _product(description=None, imageUrl=None)
    dumped = p.model_dump(exclude_none=True)
    assert "description" not in dumped
    assert "imageUrl" not in dumped


def test_priceCents_int_accepts_positive():
    p = _product(priceCents=12999)
    assert p.priceCents == 12999


def test_priceCents_rejects_negative():
    with pytest.raises(Exception):
        _product(priceCents=-1)


def test_extra_ignore():
    p = _product(unknownFutureField="tolerated")
    assert p.id == "prod-1"
    assert "unknownFutureField" not in p.model_dump()
