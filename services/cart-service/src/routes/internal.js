// routes/internal.js — network-internal checkout snapshot GET /cart/:userId.
//
// Consumed by order-service to snapshot items + live prices at checkout time.
// The caller presents its OWN valid bearer token (still token-gated); the
// {userId} path parameter is the single sanctioned exception to sub-derived
// identity (T-04-01). This edge is reachable only inside the compose network
// and is EXCLUDED from the api-gateway route table in Phase 7. Path spelling is
// the singular /cart/:userId locked by contract decision D-02.
//
// Mounted at '/' in app.js so the full path becomes /cart/:userId.

import { Router } from 'express';
import { verifyBearer } from '../auth/verifyToken.js';
import * as cartStore from '../store/cartStore.js';
import { batchPrice } from '../catalog/catalogClient.js';
import { buildCartView } from '../totals.js';
import { NotFound } from '../errors.js';

const EMPTY_MAP = new Map();

export const internalRouter = Router();

// GET /cart/:userId — priced snapshot of a user's cart for checkout.
internalRouter.get('/cart/:userId', verifyBearer, async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const cart = await cartStore.readCart(userId);

    // A missing/absent cart is NOT_FOUND — distinct from UNKNOWN_PRODUCT, which
    // concerns a product id, not a cart. This is the internal read's 404 case.
    if (cart.items.length === 0) {
      throw new NotFound();
    }

    const ids = cart.items.map((line) => line.productId);
    const priceMap = ids.length ? await batchPrice(ids) : EMPTY_MAP;
    const view = buildCartView(userId, cart.items, priceMap, cart.updatedAt);

    return res.status(200).json(view);
  } catch (err) {
    return next(err);
  }
});
