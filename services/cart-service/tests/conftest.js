// tests/conftest.js — shared test harness for the cart-service suite.
//
// Responsibilities:
//   1. Fix the JWT secret BEFORE the app/config modules load (via './_env.js',
//      imported first so its side effects run before ../src/app.js is evaluated).
//   2. Intercept the global fetch so the catalog batch edge returns an in-memory
//      fake catalog — logic tests never touch a real catalog-service. Unknown ids
//      are OMITTED from the response, mirroring the contract's omission behavior
//      (unknown id => UNKNOWN_PRODUCT upstream).
//   3. Build a supertest agent around the exported express `app`.
//   4. Provide JWT minting helpers (valid / expired / foreign-signature) that use
//      the SAME base64-decoded secret bytes the verifier uses, plus the same
//      iss/aud, so authorized requests pass and bad ones collapse to 401.
//
// ioredis is swapped for ioredis-mock by tests/_loader.mjs (registered via
// --import) for every run where RUN_REDIS_TTL is unset, so cartStore hits an
// in-memory redis. When RUN_REDIS_TTL=1 the loader leaves ioredis real and the
// TTL test talks to a live server.

import './_env.js'; // MUST be first: sets JWT_SECRET before config reads env

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import * as cartStore from '../src/store/cartStore.js';

// --- Fake catalog (in-memory; mirrors the live catalog's priceCents) ----------
export const FAKE_CATALOG = new Map([
  ['prod-1001', { name: 'Mechanical Keyboard', priceCents: 12999 }],
  ['prod-1002', { name: 'USB-C Cable', priceCents: 999 }],
]);

// Intercept fetch so the service never reaches a real catalog-service. Unknown
// ids are omitted (absence => UNKNOWN_PRODUCT in the route layer), exactly as the
// contract specifies.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const u = String(url);
  if (u.includes('/catalog/products/batch')) {
    let productIds = [];
    try {
      const body = options?.body ? JSON.parse(options.body) : {};
      productIds = Array.isArray(body.productIds) ? body.productIds : [];
    } catch {
      productIds = [];
    }
    const entries = productIds
      .filter((id) => FAKE_CATALOG.has(id))
      .map((id) => ({ productId: id, ...FAKE_CATALOG.get(id) }));
    return {
      ok: true,
      status: 200,
      json: async () => entries,
    };
  }
  return realFetch(url, options);
};

// --- JWT helpers --------------------------------------------------------------
const SECRET_BYTES = Buffer.from(process.env.JWT_SECRET, 'base64');
const ISS = 'ecommerce-auth';
const AUD = 'ecommerce-api';

function baseClaims(sub) {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub,
    email: `${sub}@example.com`,
    roles: ['customer'],
    iss: ISS,
    aud: AUD,
    iat: now,
  };
}

// Valid HS256 token with a future exp.
export function mintToken(sub = 'user-test') {
  return jwt.sign({ ...baseClaims(sub), exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET_BYTES, {
    algorithm: 'HS256',
  });
}

// Expired token (exp in the past) -> verification throws -> 401.
export function mintExpiredToken(sub = 'user-test') {
  return jwt.sign({ ...baseClaims(sub), exp: Math.floor(Date.now() / 1000) - 60 }, SECRET_BYTES, {
    algorithm: 'HS256',
  });
}

// Foreign-signature token (signed with a different secret) -> 401.
export function mintInvalidToken(sub = 'user-test') {
  return jwt.sign({ ...baseClaims(sub), exp: Math.floor(Date.now() / 1000) + 3600 }, Buffer.from('0'.repeat(44), 'base64'), {
    algorithm: 'HS256',
  });
}

// --- supertest agent ----------------------------------------------------------
export const agent = request(app);

// --- store helpers ------------------------------------------------------------
export { cartStore };

// Clear a user's cart so each test starts from a known-empty state.
export async function resetCart(sub) {
  await cartStore.clearCart(sub);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fresh, collision-free subject per test (logic suite shares one in-memory redis).
export function freshSub() {
  return 'u-' + Math.random().toString(36).slice(2, 12);
}
