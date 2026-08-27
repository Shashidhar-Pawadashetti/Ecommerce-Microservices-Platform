"""Catalog Service settings — pydantic-settings binding the contractual env names.

Env var names are contractual (shared with auth-service / gateway): JWT_SECRET,
JWT_ISSUER, JWT_AUDIENCE, JWT_TTL_SECONDS, MONGO_URI, MONGO_DB, MONGO_COLLECTION.
JWT_SECRET is base64-encoded in the environment (mirrors auth-service's signer); it
is decoded to raw bytes at load time so PyJWT verification matches the issuer.
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

    # ── Auth / JWT ────────────────────────────────────────────────────────
    jwt_secret: str = "sHwEj/+tlj4qr7PKfSqStWXV4ZnD4GPa9ImYNcXvHBM="
    jwt_issuer: str = "ecommerce-auth"
    jwt_audience: str = "ecommerce-api"
    jwt_ttl_seconds: int = 3600

    # ── Datastore ───────────────────────────────────────────────────────
    mongo_uri: str = "mongodb://mongo:27017"
    mongo_db: str = "catalog"
    mongo_collection: str = "products"

    @property
    def jwt_secret_bytes(self) -> bytes:
        """Base64-decoded raw secret bytes for PyJWT HS256 verification."""
        return base64.b64decode(self.jwt_secret)

    def assert_secret_length(self) -> None:
        """Fail fast if the decoded secret is shorter than 32 bytes (256 bits).

        Logs the decoded length ONLY — the secret value is never logged.
        """
        decoded = self.jwt_secret_bytes
        if len(decoded) < 32:
            raise RuntimeError(
                f"JWT_SECRET too short: {len(decoded)} decoded bytes; minimum 32"
            )


settings = Settings()
