// tests/test_update_remove.js — CART-02: update quantity (absolute), remove with
// idempotency, and 404 discrimination (LINE_NOT_IN_CART vs UNKNOWN_PRODUCT).

import { test } from 'node:test';
import { agent, mintToken, freshSub, resetCart, FAKE_CATALOG } from './conftest.js';

test('CART-02 PATCH existing line qty=3 -> 200 grandTotal = 3*price', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  await agent.post('/cart/items').set('Authorization', auth).send({ productId: 'prod-1001', quantity: 1 });
  const res = await agent.patch('/cart/items/prod-1001').set('Authorization', auth).send({ quantity: 3 });
  if (res.status !== 200) throw new Error(`expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  const expected = FAKE_CATALOG.get('prod-1001').priceCents * 3;
  if (res.body.grandTotalCents !== expected) {
    throw new Error(`grandTotalCents ${res.body.grandTotalCents} != ${expected}`);
  }
  const line = res.body.items.find((i) => i.productId === 'prod-1001');
  if (!line || line.quantity !== 3) throw new Error('line quantity not updated to 3');
});

test('CART-02 PATCH qty=0 -> 400 VALIDATION_FAILED (removal is DELETE-only, D-04)', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  await agent.post('/cart/items').set('Authorization', auth).send({ productId: 'prod-1001', quantity: 1 });
  const res = await agent.patch('/cart/items/prod-1001').set('Authorization', auth).send({ quantity: 0 });
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (res.body?.code !== 'VALIDATION_FAILED') throw new Error(`expected VALIDATION_FAILED, got ${JSON.stringify(res.body)}`);
});

test('CART-02 PATCH a catalog-known product not in cart -> 404 LINE_NOT_IN_CART', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  // prod-1002 is a valid catalog product but never added to this cart.
  const res = await agent.patch('/cart/items/prod-1002').set('Authorization', auth).send({ quantity: 2 });
  if (res.status !== 404) throw new Error(`expected 404, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (res.body?.code !== 'LINE_NOT_IN_CART') {
    throw new Error(`expected LINE_NOT_IN_CART, got ${JSON.stringify(res.body)} (discrimination bug)`);
  }
});

test('CART-02 PATCH unknown product -> 404 UNKNOWN_PRODUCT', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  const res = await agent.patch('/cart/items/prod-DOES-NOT-EXIST').set('Authorization', auth).send({ quantity: 2 });
  if (res.status !== 404) throw new Error(`expected 404, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (res.body?.code !== 'UNKNOWN_PRODUCT') {
    throw new Error(`expected UNKNOWN_PRODUCT, got ${JSON.stringify(res.body)} (discrimination bug)`);
  }
});

test('CART-02 DELETE line -> 204 then GET shows it gone', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  await agent.post('/cart/items').set('Authorization', auth).send({ productId: 'prod-1001', quantity: 1 });
  const del = await agent.delete('/cart/items/prod-1001').set('Authorization', auth);
  if (del.status !== 204) throw new Error(`expected 204, got ${del.status}`);

  const get = await agent.get('/cart').set('Authorization', auth);
  if (get.status !== 200) throw new Error(`expected 200, got ${get.status}`);
  if (get.body.items.length !== 0) throw new Error(`expected empty cart, got ${JSON.stringify(get.body.items)}`);
});

test('CART-02 DELETE already-absent line -> 204 (idempotent)', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  const res = await agent.delete('/cart/items/prod-1001').set('Authorization', auth);
  if (res.status !== 204) throw new Error(`expected 204 (idempotent), got ${res.status}`);
});

test('CART-02 DELETE /cart -> 204 (clears entire cart)', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  await agent.post('/cart/items').set('Authorization', auth).send({ productId: 'prod-1001', quantity: 1 });
  await agent.post('/cart/items').set('Authorization', auth).send({ productId: 'prod-1002', quantity: 1 });
  const res = await agent.delete('/cart').set('Authorization', auth);
  if (res.status !== 204) throw new Error(`expected 204, got ${res.status}`);

  const get = await agent.get('/cart').set('Authorization', auth);
  if (get.body.items.length !== 0) throw new Error(`expected empty cart after clear, got ${JSON.stringify(get.body.items)}`);
});
