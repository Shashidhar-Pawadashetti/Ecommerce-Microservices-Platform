"""Catalog Service HTTP routes.

Routes implemented in this tracer slice (public read path):
  GET  /catalog/products            listProducts       (public)
  POST /catalog/products/batch      batchGetProducts    (network-internal)
  GET  /catalog/products/{id}       getProduct          (public)
  GET  /health                      health             (network-internal)

Every route carries an explicit operation_id matching the frozen OpenAPI contract
so scripts/check-contracts.sh operationId coverage and Spectral lint pass.
"""
from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import Response

from . import db
from .models import (
    BatchPricingEntry,
    BatchPricingRequest,
    Product,
    ProductList,
)

router = APIRouter()


NOT_FOUND_BODY = {
    "code": "NOT_FOUND",
    "message": "The requested resource was not found.",
}


@router.get(
    "/catalog/products",
    operation_id="listProducts",
    response_model=ProductList,
    response_model_exclude_none=True,
)
async def list_products(
    category: str | None = Query(default=None),
    q: str | None = Query(default=None),
    sort: str = Query(default="name", pattern="^(price|name)$"),
    order: str = Query(default="asc", pattern="^(asc|desc)$"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    direction = 1 if order == "asc" else -1
    items, total = await db.list_products(
        category=category,
        q=q,
        sort_field=sort,
        direction=direction,
        limit=limit,
        offset=offset,
    )
    return ProductList(items=items, total=total, limit=limit, offset=offset)


@router.post(
    "/catalog/products/batch",
    operation_id="batchGetProducts",
    response_model=list[BatchPricingEntry],
    response_model_exclude_none=True,
)
async def batch_get_products(req: BatchPricingRequest):
    # Pure read: unknown ids are silently omitted (absence == invalidity signal).
    return await db.batch_get(req.productIds)


@router.get(
    "/catalog/products/{product_id}",
    operation_id="getProduct",
    response_model=Product,
    response_model_exclude_none=True,
)
async def get_product(product_id: str):
    doc = await db.get_product(product_id)
    if doc is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail=NOT_FOUND_BODY)
    return doc


@router.get("/health", operation_id="health")
async def health() -> Response:
    # Compact JSON so the Compose healthcheck grep for '"status":"ok"' matches exactly.
    return Response(content='{"status":"ok"}', media_type="application/json")
