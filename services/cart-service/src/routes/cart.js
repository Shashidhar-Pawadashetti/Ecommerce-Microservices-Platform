// routes/cart.js — JWT-protected cart operations for the authenticated shopper.
//
// Tracer scope (04-01): POST /cart/items (additive add with catalog validation)
// and GET /cart (live-priced read). This plan (04-02) adds the full mutation
// CRUD: PATCH /cart/items/:productId (absolute quantity), DELETE
// /cart/items/:productId (idempotent removal), and DELETE /cart (clear,
// idempotent). Identity derives exclusively from the verified JWT `sub`
// (T-04-01); prices derive exclusively from the catalog batch response (T-04-02).
// 404 discrimination order follows Pitfall 5: catalog batch check BEFORE
// line-presence check.
//
// The store is imported as a NAMESPACE (not named exports) so this route layer
// links cleanly even before plan 04-03 adds updateQty/removeItem/clearCart to
// cartStore.js — missing functions resolve at call time, not link time, keeping
// the tracer routes live while the two wave-2 plans run in parallel.

import { Router } from 'express';
import { verifyBearer } from '../auth/verifyToken.js';
import * as cartStore from '../store/cartStore.js';
import { batchPrice } from '../catalog/catalogClient.js';
import { buildCartView } from '../totals.js';
import { sendError, ValidationError, UnknownProduct, LineNotInCart } from '../errors.js';

export const cartRouter = Router();

const EMPTY_MAP = new Map();

// POST /cart/items — add a product line (body carries productId + quantity ONLY).
cartRouter.post('/items', verifyBearer, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    // Destructure ONLY the allowed fields — reject price/identity injection
    // (T-04-01 / T-04-02). Additional keys are ignored per interop Rule 5.
    const { productId, quantity } = body;

    if (typeof productId !== 'string' || productId.length === 0) {
      return sendError(res, 400, 'VALIDATION_FAILED', 'productId is required and must be a non-empty string.');
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return sendError(res, 400, 'VALIDATION_FAILED', 'quantity must be an integer >= 1.');
    }

    // Validate the product against the live catalog BEFORE accepting it.
    const priceMap = await batchPrice([productId]);
    if (!priceMap.has(productId)) {
      return sendError(res, 404, 'UNKNOWN_PRODUCT', 'Product not found.');
    }

    // Identity comes from the token, never the body.
    const userId = req.user.sub;

    await cartStore.addItem(userId, productId, quantity);

    // Recompute a priced view from the live cart (server-side totals only).
    const cart = await cartStore.readCart(userId);
    const ids = cart.items.map((line) => line.productId);
    const pricedMap = ids.length ? await batchPrice(ids) : EMPTY_MAP;
    const view = buildCartView(userId, cart.items, pricedMap, cart.updatedAt);

    return res.status(200).json(view);
  } catch (err) {
    return next(err);
  }
});

// GET /cart — return the caller's cart with live-priced totals.
cartRouter.get('/', verifyBearer, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const cart = await cartStore.readCart(userId);

    if (cart.items.length === 0) {
      return res.status(200).json(buildCartView(userId, [], EMPTY_MAP, new Date().toISOString()));
    }

    const ids = cart.items.map((line) => line.productId);
    const priceMap = await batchPrice(ids);
    const view = buildCartView(userId, cart.items, priceMap, cart.updatedAt);

    return res.status(200).json(view);
  } catch (err) {
    return next(err);
  }
});

// PATCH /cart/items/:productId — set an ABSOLUTE quantity (D-04). Removal is
// DELETE-only, so quantity < 1 is rejected with VALIDATION_FAILED.
cartRouter.patch('/items/:productId', verifyBearer, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    // Destructure ONLY quantity — never price/identity (T-04-02 / T-04-01).
    const { quantity } = body;

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new ValidationError('quantity must be an integer >= 1.');
    }

    const userId = req.user.sub;
    const productId = req.params.productId;

    // 404 discrimination order (Pitfall 5): catalog validity BEFORE line presence.
    const priceMap = await batchPrice([productId]);
    if (!priceMap.has(productId)) {
      throw new UnknownProduct(productId);
    }

    const cart = await cartStore.readCart(userId);
    const line = cart.items.find((l) => l.productId === productId);
    if (!line) {
      throw new LineNotInCart(productId);
    }

    await cartStore.updateQty(userId, productId, quantity); // absolute quantity

    // Recompute a priced view from the refreshed live cart.
    const refreshed = await cartStore.readCart(userId);
    const ids = refreshed.items.map((l) => l.productId);
    const pricedMap = ids.length ? await batchPrice(ids) : EMPTY_MAP;
    const view = buildCartView(userId, refreshed.items, pricedMap, refreshed.updatedAt);

    return res.status(200).json(view);
  } catch (err) {
    return next(err);
  }
});

// DELETE /cart/items/:productId — idempotent removal. UNKNOWN_PRODUCT only when
// the product is absent from catalog; an already-absent line still returns 204.
cartRouter.delete('/items/:productId', verifyBearer, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const productId = req.params.productId;

    // Catalog validity check first (Pitfall 5); UNKNOWN_PRODUCT if absent.
    const priceMap = await batchPrice([productId]);
    if (!priceMap.has(productId)) {
      throw new UnknownProduct(productId);
    }

    await cartStore.removeItem(userId, productId); // idempotent — no error if missing
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});

// DELETE /cart — clear the entire cart. Idempotent: clearing an already-empty
// cart still returns 204. The mutation resets the TTL window (CART-03/04).
cartRouter.delete('/', verifyBearer, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    await cartStore.clearCart(userId); // idempotent
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});
