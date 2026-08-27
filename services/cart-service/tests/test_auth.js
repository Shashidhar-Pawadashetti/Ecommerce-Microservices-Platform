// tests/test_auth.js — CART/T-04-01: every protected route rejects missing,
// expired, and foreign-signature bearer tokens with a single 401 UNAUTHORIZED
// envelope (anti-enumeration).

import { test } from 'node:test';
import { agent, mintToken, mintExpiredToken, mintInvalidToken } from './conftest.js';

// Every user-facing + internal route that declares bearerAuth in the contract.
const PROTECTED = [
  { method: 'get', path: '/cart' },
  { method: 'delete', path: '/cart' },
  { method: 'post', path: '/cart/items' },
  { method: 'patch', path: '/cart/items/prod-1001' },
  { method: 'delete', path: '/cart/items/prod-1001' },
  { method: 'get', path: '/cart/some-user-id' },
];

for (const scenario of [
  { label: 'missing', auth: null },
  { label: 'expired', auth: () => mintExpiredToken('user-auth') },
  { label: 'foreign-signature', auth: () => mintInvalidToken('user-auth') },
]) {
  for (const route of PROTECTED) {
    test(`T-04-01 ${route.method.toUpperCase()} ${route.path} -> 401 UNAUTHORIZED (${scenario.label} token)`, async () => {
      let req = agent[route.method](route.path);
      if (scenario.auth) req = req.set('Authorization', `Bearer ${scenario.auth()}`);
      const res = await req;
      if (res.status !== 401) {
        throw new Error(`expected 401 for ${route.method} ${route.path} (${scenario.label}), got ${res.status}`);
      }
      if (res.body?.code !== 'UNAUTHORIZED') {
        throw new Error(`expected Error.code UNAUTHORIZED, got ${JSON.stringify(res.body)}`);
      }
    });
  }
}

// A valid token must NOT be rejected by the auth middleware itself (the route may
// still 404/400 on business logic, but it clears auth). Spot-check GET /cart.
test('T-04-01 valid token passes auth middleware (GET /cart is not 401)', async () => {
  const res = await agent.get('/cart').set('Authorization', `Bearer ${mintToken('user-auth')}`);
  if (res.status === 401) {
    throw new Error('valid token was rejected by auth middleware');
  }
});
