"""Kafka producer wrapper for payment-service (payment.completed)."""
from __future__ import annotations

from aiokafka import AIOKafkaProducer


def build_producer(bootstrap_servers: str) -> AIOKafkaProducer:
    """Build an AIOKafkaProducer that serializes values as UTF-8 JSON bytes."""
    return AIOKafkaProducer(
        bootstrap_servers=bootstrap_servers,
        value_serializer=lambda v: v if isinstance(v, bytes) else v.encode("utf-8"),
        key_serializer=lambda k: k.encode("utf-8") if isinstance(k, str) else k,
    )
