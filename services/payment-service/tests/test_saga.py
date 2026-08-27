"""Payment saga participant tests — exercise authorize + the Kafka handler
(handle_order) WITHOUT a Kafka broker, using a fake producer and a real Redis
container for the SETNX dedup (ORDR-03 / ORDR-08). This keeps the suite green and
fast on any machine with Docker, while the broker-level flow is covered by the
order-service EmbeddedKafka integration test and the compose smoke script.
"""
import json
import uuid

import pytest

from app.consumer import authorize, handle_order
from app.models import OrderCreated, OrderItemSnapshot


class FakeProducer:
    def __init__(self):
        self.sent = []

    async def send_and_wait(self, topic, key=None, value=None):
        self.sent.append((topic, key, value))
        return None


def _order(order_id: str = "order-xyz", total: int = 5000) -> OrderCreated:
    return OrderCreated(
        eventId=str(uuid.uuid4()),
        orderId=order_id,
        userId="user-1",
        userEmail="a@b.com",
        items=[
            OrderItemSnapshot(
                productId="p1", nameSnapshot="Widget", unitPriceCents=5000, quantity=1
            )
        ],
        totalCents=total,
        currency="USD",
        createdAt="2026-08-27T10:00:00.000Z",
    )


@pytest.mark.asyncio
async def test_approve_produces_approved(redis_client):
    prod = FakeProducer()
    event = await handle_order(_order(), prod, redis_client, "always_success")

    assert event.outcome == "APPROVED"
    assert event.reason is None
    assert len(prod.sent) == 1

    topic, key, value = prod.sent[0]
    assert topic == "payment.completed"
    assert key == "order-xyz"
    payload = json.loads(value)
    assert payload["outcome"] == "APPROVED"
    assert "reason" not in payload  # interop Rule 4: omit on APPROVED


@pytest.mark.asyncio
async def test_decline_produces_declined_with_reason(redis_client):
    prod = FakeProducer()
    event = await handle_order(_order(), prod, redis_client, "always_fail")

    assert event.outcome == "DECLINED"
    payload = json.loads(prod.sent[0][2])
    assert payload["reason"] == "Mock decline"


@pytest.mark.asyncio
async def test_dedup_redelivery_no_double_produce(redis_client):
    prod = FakeProducer()
    order = _order()

    first = await handle_order(order, prod, redis_client, "always_success")
    second = await handle_order(order, prod, redis_client, "always_success")  # redelivery

    assert first is not None
    assert second is None  # SETNX short-circuits the redelivery
    assert len(prod.sent) == 1  # exactly one payment.completed produced


@pytest.mark.asyncio
async def test_authorize_random_returns_valid_outcome():
    assert authorize("random") in ("APPROVED", "DECLINED")
