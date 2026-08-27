"""Catalog Service FastAPI application entrypoint.

Wires the lifespan (connect Mongo, ensure indexes, assert secret length),
registers contract-faithful exception handlers (unified {"code","message"} envelope),
mounts static product assets, and includes the API router.
"""
from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from . import db, routes
from .config import settings


def _error_response(code: str, message: str, status: int) -> Response:
    """Emit a byte-exact unified error envelope (interop Rule 4 safe)."""
    body = json.dumps({"code": code, "message": message}, separators=(",", ":"))
    return Response(content=body, media_type="application/json", status_code=status)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail fast on a too-short JWT secret; log length only, never the value.
    settings.assert_secret_length()
    await db.connect()
    await db.ensure_indexes()
    try:
        yield
    finally:
        await db.close()


app = FastAPI(
    title="Catalog Service API",
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


# Serve the whole ``static/`` tree so committed assets resolve under their
# planned root-relative URLs, e.g. /catalog/static/products/prod-1001.svg
# (file: static/products/prod-1001.svg). The /catalog/static mount prefix is
# unchanged from Plan 01; only the served directory root moves up one level so
# the ``products`` path segment in the URL maps to the on-disk folder.
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/catalog/static", StaticFiles(directory=STATIC_DIR), name="catalog-static")

app.include_router(routes.router)
