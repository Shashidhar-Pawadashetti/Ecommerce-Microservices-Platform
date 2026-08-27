// tests/test_add.js — CART-01: add an item, validate unknown product and bad
// quantity, and assert server-side totals equal quantity * live catalog price.

import { test } from 'node:test';
import { agent, mintToken, freshSub, resetCart, FAKE_CATALOG } from './conftest.js';

test('CART-01 POST /cart/items adds known product and returns priced cart (grandTotalCents == qty*price)', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  const res = await agent.post('/cart/items').set('Authorization', auth).send({ productId: 'prod-1001', quantity: 2 });
  if (res.status !== 200) throw new Error(`expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);

  const expectedUnit = FAKE_CATALOG.get('prod-1001').priceCents;
  if (res.body.items.length !== 1) throw new Error(`expected 1 item, got ${res.body.items.length}`);
  if (res.body.items[0].productId !== 'prod-1001') throw new Error('wrong productId');
  if (res.body.items[0].unitPriceCents !== expectedUnit) {
    throw new Error(`unitPriceCents ${res.body.items[0].unitPriceCents} != catalog ${expectedUnit}`);
  }
  if (res.body.items[0].lineTotalCents !== expectedUnit * 2) {
    throw new Error(`lineTotalCents ${res.body.items[0].lineTotalCents} != ${expectedUnit * 2}`);
  }
  if (res.body.grandTotalCents !== expectedUnit * 2) {
    throw new Error(`grandTotalCents ${res.body.grandTotalCents} != ${expectedUnit * 2}`);
  }
});

test('CART-01 POST /cart/items unknown productId -> 404 UNKNOWN_PRODUCT', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  const res = await agent.post('/cart/items').set('Authorization', auth).send({ productId: 'prod-DOES-NOT-EXIST', quantity: 1 });
  if (res.status !== 404) throw new Error(`expected 404, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (res.body?.code !== 'UNKNOWN_PRODUCT') throw new Error(`expected UNKNOWN_PRODUCT, got ${JSON.stringify(res.body)}`);
});

test('CART-01 POST /cart/items quantity 0 -> 400 VALIDATION_FAILED', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  const res = await agent.post('/cart/items').set('Authorization', auth).send({ productId: 'prod-1001', quantity: 0 });
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (res.body?.code !== 'VALIDATION_FAILED') throw new Error(`expected VALIDATION_FAILED, got ${JSON.stringify(res.body)}`);
});

test('CART-01 POST /cart/items missing productId -> 400 VALIDATION_FAILED', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  const res = await agent.post('/cart/items').set('Authorization', auth).send({ quantity: 1 });
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (res.body?.code !== 'VALIDATION_FAILED') throw new Error(`expected VALIDATION_FAILED, got ${JSON.stringify(res.body)}`);
});

test('CART-01 POST /cart/items ignores client-supplied price fields (T-04-02)', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  // Even if a client sends unitPriceCents in the body, the server must use the
  // catalog value, not the injected one.
  const res = await agent.post('/cart/items').set('Authorization', auth).send({ productId: 'prod-1001', quantity: 1, unitPriceCents: 1 });
  if (res.status !== 200) throw new Error(`expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (res.body.items[0].unitPriceCents !== FAKE_CATALOG.get('prod-1001').priceCents) {
    throw new Error('client-injected price was honored — T-04-02 violation');
  }
});
