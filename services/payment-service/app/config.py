"""Payment Service settings — pydantic-settings binding the contractual env names.

Env var names are contractual (shared with auth-service / gateway): JWT_SECRET,
JWT_ISSUER, JWT_AUDIENCE, JWT_TTL_SECONDS. Payment-service is Kafka-only and does
NOT verify JWTs — the jwt_* block is kept (harmless) only because config.py is
cloned from catalog-service; it is never read for token verification here.
"""
from __future__ import annotations

import base64

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ── Auth / JWT (unused for verification; kept for parity with catalog) ──
    jwt_secret: str = "sHwEj/+tlj4qr7PKfSqStWXV4ZnD4GPa9ImYNcXvHBM="
    jwt_issuer: str = "ecommerce-auth"
    jwt_audience: str = "ecommerce-api"
    jwt_ttl_seconds: int = 3600

    # ── Kafka / Payment ──────────────────────────────────────────────────────
    kafka_bootstrap_servers: str = "kafka:9092"
    redis_url: str = "redis://redis:6379/0"
    payment_mode: str = "always_success"   # always_success | always_fail | random

    @property
    def jwt_secret_bytes(self) -> bytes:
        """Base64-decoded raw secret bytes (parity with catalog-service)."""
        return base64.b64decode(self.jwt_secret)


settings = Settings()
