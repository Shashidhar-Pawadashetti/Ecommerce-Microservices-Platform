// routes/cart.js — JWT-protected cart operations (Phase 4 tracer slice).
//
// Tracer scope: POST /cart/items (additive add with catalog validation) and
// GET /cart (live-priced read). Identity derives exclusively from the verified
// JWT `sub` (T-04-01). Prices are derived exclusively from the catalog batch
// response (T-04-02). updateQty/removeItem/clearCart/GET /cart/{userId} land in
// plans 04-02 / 04-03.

import { Router } from 'express';
import { verifyBearer } from '../auth/verifyToken.js';
import { readCart, addItem } from '../store/cartStore.js';
import { batchPrice } from '../catalog/catalogClient.js';
import { buildCartView } from '../totals.js';
import { sendError } from '../errors.js';

export const cartRouter = Router();

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

    await addItem(userId, productId, quantity);

    // Recompute a priced view from the live cart (server-side totals only).
    const cart = await readCart(userId);
    const ids = cart.items.map((line) => line.productId);
    const pricedMap = ids.length ? await batchPrice(ids) : new Map();
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
    const cart = await readCart(userId);

    if (cart.items.length === 0) {
      return res.status(200).json(buildCartView(userId, [], new Map(), new Date().toISOString()));
    }

    const ids = cart.items.map((line) => line.productId);
    const priceMap = await batchPrice(ids);
    const view = buildCartView(userId, cart.items, priceMap, cart.updatedAt);

    return res.status(200).json(view);
  } catch (err) {
    return next(err);
  }
});
