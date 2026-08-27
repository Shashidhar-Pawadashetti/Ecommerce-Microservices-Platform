// tests/test_internal.js — CART-03: network-internal GET /cart/{userId} checkout
// snapshot. Returns a priced CartView when populated, 404 NOT_FOUND when no live
// cart exists for the target, and 401 without a token.

import { test } from 'node:test';
import { agent, mintToken, freshSub, resetCart, FAKE_CATALOG } from './conftest.js';

test('CART-03 internal GET /cart/{userId} with populated cart -> 200 priced CartView', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  // Populate via the user-facing add (identity from token sub).
  await agent.post('/cart/items').set('Authorization', auth).send({ productId: 'prod-1001', quantity: 2 });

  // Read the snapshot by the target userId (order-service presents its own token).
  const res = await agent.get(`/cart/${sub}`).set('Authorization', auth);
  if (res.status !== 200) throw new Error(`expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);

  if (res.body.userId !== sub) throw new Error(`userId echo mismatch: ${res.body.userId}`);
  if (res.body.items.length !== 1) throw new Error(`expected 1 item, got ${res.body.items.length}`);
  const line = res.body.items[0];
  if (line.unitPriceCents !== FAKE_CATALOG.get('prod-1001').priceCents) {
    throw new Error(`unitPriceCents ${line.unitPriceCents} != catalog`);
  }
  if (line.lineTotalCents !== FAKE_CATALOG.get('prod-1001').priceCents * 2) {
    throw new Error(`lineTotalCents ${line.lineTotalCents} wrong`);
  }
  if (res.body.grandTotalCents !== FAKE_CATALOG.get('prod-1001').priceCents * 2) {
    throw new Error(`grandTotalCents ${res.body.grandTotalCents} wrong`);
  }
  if (res.body.currency !== 'USD') throw new Error('missing currency');
});

test('CART-03 internal GET /cart/{userId} with no live cart -> 404 NOT_FOUND', async () => {
  const sub = freshSub();
  await resetCart(sub); // ensure an empty/absent cart for this user
  const viewer = freshSub();
  const auth = `Bearer ${mintToken(viewer)}`;

  const res = await agent.get(`/cart/${sub}`).set('Authorization', auth);
  if (res.status !== 404) throw new Error(`expected 404, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (res.body?.code !== 'NOT_FOUND') throw new Error(`expected NOT_FOUND, got ${JSON.stringify(res.body)}`);
});

test('CART-03 internal GET /cart/{userId} without token -> 401 UNAUTHORIZED', async () => {
  const sub = freshSub();
  const res = await agent.get(`/cart/${sub}`);
  if (res.status !== 401) throw new Error(`expected 401, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (res.body?.code !== 'UNAUTHORIZED') throw new Error(`expected UNAUTHORIZED, got ${JSON.stringify(res.body)}`);
});
