// scripts/smoke.js — standalone end-to-end smoke for the cart-service.
//
// Asserts the vertical slice against the RUNNING compose stack:
//   redis + cart-service + catalog-service (transitional host ports 3001/8000).
//
// Token minting uses the SAME JWT_SECRET the cart-service verifies with
// (config.jwtSecretBytes -> base64-decoded bytes), so the signature validates.
// To run against the full stack, export JWT_SECRET to the value used by
// docker-compose (.env) BEFORE running this script:
//
//   export JWT_SECRET=<value-from-.env>
//   docker compose up -d redis cart-service catalog-service mongo
//   node services/cart-service/scripts/smoke.js
//
// Exits non-zero on any failure.

import jwt from 'jsonwebtoken';
import { config, jwtSecretBytes } from '../src/config.js';

const PORT = process.env.PORT || config.port || 3001;
const BASE = process.env.CART_BASE_URL || `http://localhost:${PORT}`;
const CATALOG_BASE = process.env.CATALOG_BASE_URL || 'http://localhost:8000';
const SECRET = jwtSecretBytes();

function makeToken(sub = 'smoke-user') {
  const payload = {
    sub,
    email: 'smoke@example.com',
    roles: ['customer'],
    iss: process.env.JWT_ISSUER || config.jwtIssuer,
    aud: process.env.JWT_AUDIENCE || config.jwtAudience,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return jwt.sign(payload, SECRET, { algorithm: 'HS256' });
}

async function http(method, path, { token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await resp.json();
  } catch {
    /* non-JSON bodies ignored */
  }
  return { status: resp.status, data };
}

// Find a real product to price against, so the smoke is seed-agnostic.
// Catalog list is PUBLIC (GTWY-03), reachable on the transitional host port.
async function findKnownProduct() {
  try {
    const resp = await fetch(`${CATALOG_BASE}/catalog/products?limit=1`, { method: 'GET' });
    if (resp.ok) {
      const json = await resp.json();
      const first = json?.items?.[0];
      if (first?.id) return { productId: first.id, priceCents: first.priceCents };
    }
  } catch {
    /* fall through to default */
  }
  return { productId: 'prod-1001', priceCents: 12999 };
}

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log(`  PASS: ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL: ${name}${detail ? ' — ' + detail : ''}`);
  }
}

async function main() {
  console.log('cart-service smoke starting...');
  console.log(`  target: ${BASE}`);

  const { productId, priceCents } = await findKnownProduct();
  console.log(`  using product ${productId} (expected priceCents=${priceCents})`);
  const token = makeToken();

  // 1. Add a known product (additive, qty 2).
  const add = await http('POST', '/cart/items', { token, body: { productId, quantity: 2 } });
  check('POST /cart/items known product -> 200', add.status === 200, `status=${add.status} body=${JSON.stringify(add.data)}`);
  check('add grandTotalCents == 2*priceCents', add.data?.grandTotalCents === priceCents * 2, `got ${add.data?.grandTotalCents}`);
  check('add items length == 1', add.data?.items?.length === 1, `len=${add.data?.items?.length}`);

  // 2. GET totals match the add (server-side, live-priced).
  const get = await http('GET', '/cart', { token });
  check('GET /cart -> 200', get.status === 200, `status=${get.status}`);
  check('GET grandTotalCents matches add', get.data?.grandTotalCents === priceCents * 2, `got ${get.data?.grandTotalCents}`);

  // 3. Unknown product -> 404 UNKNOWN_PRODUCT.
  const unknown = await http('POST', '/cart/items', { token, body: { productId: 'prod-definitely-not-real-xyz', quantity: 1 } });
  check('POST unknown product -> 404 UNKNOWN_PRODUCT', unknown.status === 404 && unknown.data?.code === 'UNKNOWN_PRODUCT', `status=${unknown.status} body=${JSON.stringify(unknown.data)}`);

  // 4. Missing token -> 401 UNAUTHORIZED.
  const noToken = await http('POST', '/cart/items', { body: { productId, quantity: 1 } });
  check('POST no token -> 401 UNAUTHORIZED', noToken.status === 401 && noToken.data?.code === 'UNAUTHORIZED', `status=${noToken.status} body=${JSON.stringify(noToken.data)}`);

  console.log(failures === 0 ? '\nSMOKE PASS' : `\nSMOKE FAIL (${failures} failure(s))`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('smoke crashed:', err);
  process.exit(1);
});
