// store/cartStore.js — Redis-backed cart persistence.
//
// Cart lines live under the key `cart:{userId}` as a JSON blob
// { items: [{ productId, quantity }], updatedAt: <ISO-8601> }. The cart NEVER
// stores price (threat T-04-02): only productId + quantity persist.
//
// The TTL is refreshed on EVERY mutation via writeCart() (the single EXPIRE
// chokepoint) so abandoned carts expire after CART_TTL_SECONDS; reads do NOT
// touch the TTL, so an un-mutated cart still ages out. This is the CART-04
// abandoned-cart expiry anchor.
//
// Tracer scope: addItem is implemented fully. updateQty/removeItem/clearCart
// are added in plan 04-02 (different file edit, no architectural change).

import Redis from 'ioredis';
import { config } from '../config.js';

let client;

// Singleton client. ioredis reconnects automatically in the running service.
export function createRedisClient() {
  if (!client) {
    client = new Redis(config.redisUrl, {
      // Bound retries so a genuinely unreachable Redis fails fast at startup
      // rather than hanging the process forever.
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
    });
  }
  return client;
}

function key(userId) {
  return `cart:${userId}`;
}

// Returns { items, updatedAt }. Missing/absent key -> empty view, no TTL touch.
export async function readCart(userId) {
  const raw = await createRedisClient().get(key(userId));
  if (!raw) return { items: [], updatedAt: null };
  try {
    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed?.items) ? parsed.items : [],
      updatedAt: parsed?.updatedAt ?? null,
    };
  } catch {
    return { items: [], updatedAt: null };
  }
}

// The ONLY writer — always passes EX so every mutation resets the TTL window.
export async function writeCart(userId, items, updatedAt = new Date().toISOString()) {
  const blob = JSON.stringify({ items, updatedAt });
  await createRedisClient().set(key(userId), blob, 'EX', config.cartTtlSeconds);
}

// Additive add: an existing line's quantity is incremented by the requested
// amount; a new line is pushed. Then the blob is rewritten (TTL refresh).
export async function addItem(userId, productId, quantity) {
  const { items } = await readCart(userId);
  const existing = items.find((line) => line.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ productId, quantity });
  }
  await writeCart(userId, items);
  return items;
}
