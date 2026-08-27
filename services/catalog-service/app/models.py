"""Pydantic v2 models for the Catalog Service — wire shapes match the frozen
``docs/api-contracts/catalog-service.openapi.yaml`` components.schemas exactly.

Interop discipline (docs/json-interop.md):
  Rule 1 — createdAt serializes as ISO-8601 with exactly 3-digit ms + Z.
  Rule 2 — monetary amounts are integer priceCents, never floats.
  Rule 3 — identifiers are strings on the wire (Mongo _id -> id mapping in db.py).
  Rule 4 — optional fields are omitted, never sent as null (response_model_exclude_none).
  Rule 5 — extra="ignore" tolerates unknown fields from forward-compatible payloads.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer


def iso_ms(value: datetime) -> str:
    """Render a datetime as ISO-8601 with exactly 3-digit ms precision + Z.

    Never emits 6-digit microseconds (interop Rule 1).
    """
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value.strftime("%Y-%m-%dT%H:%M:%S.") + f"{value.microsecond // 1000:03d}Z"


class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Rule 5

    id: str  # Rule 3 — string on the wire
    name: str
    description: Optional[str] = None  # Rule 4 — omitted, never null
    category: str
    priceCents: int = Field(ge=0)  # Rule 2
    stock: int = Field(ge=0)
    imageUrl: Optional[str] = None  # Rule 4
    createdAt: datetime  # Rule 1

    @field_serializer("createdAt")
    def _serialize_created_at(self, value: datetime) -> str:
        return iso_ms(value)


class ProductWrite(BaseModel):
    """Admin create/update body. Excludes id/createdAt (mass-assignment guard)."""

    model_config = ConfigDict(extra="ignore")  # Rule 5

    name: str = Field(min_length=1)
    description: Optional[str] = None
    category: str = Field(min_length=1)
    priceCents: int = Field(ge=0)  # Rule 2
    stock: int = Field(ge=0, default=0)
    imageUrl: Optional[str] = None


class ProductList(BaseModel):
    model_config = ConfigDict(extra="ignore")

    items: list[Product]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)


class BatchPricingRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    productIds: list[str] = Field(min_length=1)


class BatchPricingEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    productId: str
    name: str
    priceCents: int = Field(ge=0)  # Rule 2
