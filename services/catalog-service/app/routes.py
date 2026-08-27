"""Catalog Service HTTP routes.

Routes implemented in this slice:
  GET  /catalog/products            listProducts       (public)
  POST /catalog/products/batch      batchGetProducts    (network-internal)
  GET  /catalog/products/{id}       getProduct          (public)
  POST /catalog/products            createProduct       (admin, JWT)  -- Plan 04 / CAT-06
  PUT  /catalog/products/{id}       updateProduct       (admin, JWT)  -- Plan 04 / CAT-06
  DELETE /catalog/products/{id}     deleteProduct       (admin, JWT)  -- Plan 04 / CAT-06
  GET  /health                      health             (network-internal)

Every route carries an explicit operation_id matching the frozen OpenAPI contract
so scripts/check-contracts.sh operationId coverage and Spectral lint pass. Mutating
routes (create/update/delete) declare ``bearerAuth`` and attach the ``require_auth``
dependency (default-deny; T-03-01 broken-access-control mitigation).
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from . import db
from .models import (
    BatchPricingEntry,
    BatchPricingRequest,
    Product,
    ProductList,
    ProductWrite,
)
from .security import require_auth

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
    # Primary sort resolves to a concrete field; direction from order.
    sort_key = "priceCents" if sort == "price" else "name"
    direction = -1 if order == "desc" else 1
    # Deterministic tie-break on _id so equal-primary-key rows are ordered
    # repeatably across pages (CAT-04 adjacency contract).
    sort_spec = [(sort_key, direction), ("_id", 1)]
    items, total = await db.list_products(
        category=category,
        q=q,
        sort_spec=sort_spec,
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


@router.post(
    "/catalog/products",
    operation_id="createProduct",
    response_model=Product,
    response_model_exclude_none=True,
    dependencies=[Depends(require_auth)],
    openapi_extra={"security": [{"bearerAuth": []}]},
    status_code=201,
)
async def create_product(body: ProductWrite):
    # Mass-assignment guard: id/createdAt are never taken from the body (ProductWrite
    # excludes them by construction); the server generates both (T-03-05).
    doc = body.model_dump(exclude_none=True)
    doc["_id"] = f"prod-{uuid4().hex[:12]}"  # string id per interop Rule 3
    doc["createdAt"] = datetime.now(timezone.utc)
    new_id = await db.create_product(doc)
    return await db.get_product(new_id)


@router.put(
    "/catalog/products/{product_id}",
    operation_id="updateProduct",
    response_model=Product,
    response_model_exclude_none=True,
    dependencies=[Depends(require_auth)],
    openapi_extra={"security": [{"bearerAuth": []}]},
)
async def update_product(product_id: str, body: ProductWrite):
    changes = body.model_dump(exclude_none=True)
    updated = await db.update_product(product_id, changes)
    if updated is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND_BODY)
    return updated


@router.delete(
    "/catalog/products/{product_id}",
    operation_id="deleteProduct",
    dependencies=[Depends(require_auth)],
    openapi_extra={"security": [{"bearerAuth": []}]},
    status_code=204,
)
async def delete_product(product_id: str):
    deleted = await db.delete_product(product_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=NOT_FOUND_BODY)
    return Response(status_code=204)


@router.get("/health", operation_id="health")
async def health() -> Response:
    # Compact JSON so the Compose healthcheck grep for '"status":"ok"' matches exactly.
    return Response(content='{"status":"ok"}', media_type="application/json")
