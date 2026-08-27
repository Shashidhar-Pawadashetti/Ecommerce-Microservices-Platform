"""Pydantic v2 event models for the Payment Service — wire shapes match
docs/kafka-topics.md exactly (single drift surface with the orders OpenAPI spec).

Interop discipline (docs/json-interop.md):
  Rule 1 — timestamps serialize as ISO-8601 ms + Z.
  Rule 2 — monetary amounts are integer Cents (never floats).
  Rule 4 — optional fields omitted, never null (reason absent on APPROVED).
  Rule 5 — extra="ignore" tolerates forward-compatible payloads.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


def iso_ms(value: datetime) -> str:
    """Render a datetime as ISO-8601 with exactly 3-digit ms precision + Z."""
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value.strftime("%Y-%m-%dT%H:%M:%S.") + f"{value.microsecond // 1000:03d}Z"


class OrderItemSnapshot(BaseModel):
    model_config = ConfigDict(extra="ignore")

    productId: str
    nameSnapshot: str
    unitPriceCents: int = Field(ge=0)
    quantity: int = Field(ge=1)


class OrderCreated(BaseModel):
    model_config = ConfigDict(extra="ignore")

    eventId: str
    orderId: str
    userId: str
    userEmail: str
    items: list[OrderItemSnapshot]
    totalCents: int = Field(ge=0)
    currency: str
    createdAt: str


class PaymentCompleted(BaseModel):
    model_config = ConfigDict(extra="ignore")

    eventId: str
    orderId: str
    outcome: str                      # APPROVED | DECLINED (frozen spellings)
    reason: Optional[str] = None      # OMITTED entirely on APPROVED (Rule 4)
    processedAt: str
