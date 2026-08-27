"""Kafka consumer + producer loop for the payment saga participant.

Consumes order.created, runs the mock authorization controlled by PAYMENT_MODE,
and produces payment.completed. Redelivery safety (ORDR-03 / ORDR-08) comes from
a Redis SETNX dedup: `payment:authorized:{orderId}` is set atomically before
authorization, so a redelivered order.created never re-authorizes the mock.
"""
from __future__ import annotations

import json
import logging
import random
import uuid
from datetime import datetime, timezone
from typing import Optional

from aiokafka import AIOKafkaConsumer

import redis.asyncio as redis

from .config import settings
from .models import OrderCreated, PaymentCompleted, iso_ms
from .producer import build_producer

logger = logging.getLogger("payment-service")


def authorize(payment_mode: str) -> str:
    """Return the mock authorization outcome for PAYMENT_MODE.

    FROZEN spellings: APPROVED | DECLINED (docs/kafka-topics.md).
    """
    if payment_mode == "always_success":
        return "APPROVED"
    if payment_mode == "always_fail":
        return "DECLINED"
    # random: evenly split (still a valid APPROVED/DECLINED).
    return random.choice(["APPROVED", "DECLINED"])


async def handle_order(
    order: OrderCreated,
    producer,
    redis_client,
    payment_mode: str,
) -> Optional[PaymentCompleted]:
    """Process one order.created. Returns the produced event, or None if the
    Redis SETNX dedup short-circuited a redelivery."""
    dedup_key = f"payment:authorized:{order.orderId}"

    # SETNX: first delivery sets the key and proceeds; any redelivery finds the
    # key already present and is a no-op (no second authorize + produce).
    if not await redis_client.set(dedup_key, order.orderId, nx=True):
        logger.info("Dedup skip: orderId=%s already authorized", order.orderId)
        return None

    outcome = authorize(payment_mode)
    reason = None if outcome == "APPROVED" else "Mock decline"
    event = PaymentCompleted(
        eventId=str(uuid.uuid4()),
        orderId=order.orderId,
        outcome=outcome,
        reason=reason,
        processedAt=iso_ms(datetime.now(timezone.utc)),
    )
    await producer.send_and_wait(
        "payment.completed",
        key=order.orderId,
        value=event.model_dump_json().encode("utf-8"),
    )
    logger.info("Produced payment.completed orderId=%s outcome=%s", order.orderId, outcome)
    return event


async def run(bootstrap_servers: str, redis_url: str, payment_mode: str) -> None:
    """Main consumer/producer loop. Manual commit AFTER produce => at-least-once."""
    redis_client = redis.from_url(redis_url)
    consumer = AIOKafkaConsumer(
        "order.created",
        group_id="payment-service",
        bootstrap_servers=bootstrap_servers,
        auto_offset_reset="earliest",
        enable_auto_commit=False,
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
    )
    producer = build_producer(bootstrap_servers)

    await consumer.start()
    await producer.start()
    try:
        async for msg in consumer:
            try:
                order = OrderCreated.model_validate(msg.value)
            except Exception as exc:  # poison message -> log + skip
                logger.warning("Skipping malformed order.created: %s", exc)
                continue
            await handle_order(order, producer, redis_client, payment_mode)
            await consumer.commit()  # commit only after produce
    finally:
        await consumer.stop()
        await producer.stop()
        await redis_client.aclose()
