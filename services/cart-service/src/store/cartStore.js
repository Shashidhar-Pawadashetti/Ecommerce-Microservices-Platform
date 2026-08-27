// store/cartStore.js — Redis-backed cart persistence.
//
// Cart lines live under the key `cart:{userId}` as a JSON blob
// { items: [{ productId, quantity }], updatedAt: <ISO-8601> }. The cart NEVER
// stores price (threat T-04-02): only productId + quantity persist.
//
// The TTL is refreshed on EVERY mutation via writeCart() (the single EXPIRE
// chokepoint) so abandoned carts expire after CART_TTL_SECONDS; reads do NOT
// touch the TTL, so an un-mutated cart still ages out. This is the CART-04
// abandoned-cart expiry anchor and the source of truth for the readTtl() probe.

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
// The persisted `updatedAt` is the last-mutation timestamp (the TTL anchor);
// an absent cart resolves updatedAt to null and the route substitutes the
// current time (Open Question 3 resolution).
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
// updatedAt defaults to now (the last-mutation timestamp / TTL anchor) but can
// be supplied by callers; either way the blob and the expiry stay in lockstep.
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

// Absolute quantity replace (used by PATCH). The route layer returns
// LINE_NOT_IN_CART before calling this when the line is absent, so the store
// treats a missing line as a safe no-op (no new line created, TTL still
// refreshed). When present, the line quantity is replaced wholesale.
export async function updateQty(userId, productId, quantity) {
  const { items } = await readCart(userId);
  const existing = items.find((line) => line.productId === productId);
  if (existing) {
    existing.quantity = quantity;
    await writeCart(userId, items);
  } else {
    // No-op-safe: refresh the window without mutating the cart contents.
    await writeCart(userId, items);
  }
  return items;
}

// Idempotent removal: the matching line is filtered out. Removing an absent
// line still rewrites [] and resets the TTL (idempotency per the contract).
export async function removeItem(userId, productId) {
  const { items } = await readCart(userId);
  const next = items.filter((line) => line.productId !== productId);
  await writeCart(userId, next);
  return next;
}

// Empties the cart and resets the TTL window. Idempotent — clearing an
// already-empty cart still writes [] and refreshes the expiry.
export async function clearCart(userId) {
  await writeCart(userId, []);
}

// Exposes the remaining TTL in seconds for observable-expiry tests (CART-04):
//   - positive integer  -> seconds remaining until the key expires
//   - -1                -> key exists but has no associated expiry
//   - -2                -> key does not exist (already expired / never written)
export async function readTtl(userId) {
  return createRedisClient().ttl(key(userId));
}

// Returns the stored last-mutation timestamp, or null when the cart blob is
// absent. The route substitutes the current time when null (Open Question 3).
export async function readUpdatedAt(userId) {
  const { updatedAt } = await readCart(userId);
  return updatedAt;
}
