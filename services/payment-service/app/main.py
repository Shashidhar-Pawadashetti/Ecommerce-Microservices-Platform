"""Payment Service FastAPI application entrypoint.

Payment-service is Kafka-only: it has NO REST router. The lifespan starts the
AIOKafka consumer + producer loop (app.consumer.run) and cancels it on shutdown.
The unified error envelope handlers are kept (cloned from catalog-service) so any
future HTTP surface stays contract-faithful.
"""
from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import Response

from . import consumer
from .config import settings

logging.basicConfig(level=logging.INFO)


def _error_response(code: str, message: str, status: int) -> Response:
    """Emit a byte-exact unified error envelope (interop Rule 4 safe)."""
    body = json.dumps({"code": code, "message": message}, separators=(",", ":"))
    return Response(content=body, media_type="application/json", status_code=status)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the Kafka consumer/producer loop as a background task; cancel on shutdown.
    task = asyncio.create_task(
        consumer.run(
            settings.kafka_bootstrap_servers,
            settings.redis_url,
            settings.payment_mode,
        )
    )
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass


app = FastAPI(
    title="Payment Service API",
    version="1.0.0",
    lifespan=lifespan,
    openapi_extra={
        "components": {
            "securitySchemes": {
                "bearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                }
            }
        }
    },
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> Response:
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail and "message" in detail:
        return _error_response(detail["code"], detail["message"], exc.status_code)
    if exc.status_code == 400:
        return _error_response("VALIDATION_FAILED", "Request validation failed.", exc.status_code)
    if exc.status_code == 401:
        return _error_response(
            "UNAUTHORIZED",
            "Authentication required or credentials invalid.",
            exc.status_code,
        )
    if exc.status_code == 404:
        return _error_response(
            "NOT_FOUND", "The requested resource was not found.", exc.status_code
        )
    return _error_response("INTERNAL_ERROR", "An unexpected error occurred.", exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> Response:
    return _error_response(
        "VALIDATION_FAILED",
        "Request validation failed. Check field formats and limits.",
        400,
    )
