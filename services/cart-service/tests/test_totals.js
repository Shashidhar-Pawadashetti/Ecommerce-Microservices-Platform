// tests/test_totals.js — CART-02 / T-04-02: server-side totals are derived ONLY
// from the live catalog priceCents; client-supplied price fields are ignored, math
// is integer cents, and an empty cart totals 0.

import { test } from 'node:test';
import { agent, mintToken, freshSub, resetCart, FAKE_CATALOG } from './conftest.js';

test('T-04-02 totals equal quantity * live catalog priceCents across multiple lines', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  await agent.post('/cart/items').set('Authorization', auth).send({ productId: 'prod-1001', quantity: 2 });
  await agent.post('/cart/items').set('Authorization', auth).send({ productId: 'prod-1002', quantity: 3 });

  const res = await agent.get('/cart').set('Authorization', auth);
  if (res.status !== 200) throw new Error(`expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);

  const byId = new Map(res.body.items.map((i) => [i.productId, i]));
  for (const [id, cat] of FAKE_CATALOG) {
    const line = byId.get(id);
    if (!line) throw new Error(`missing line for ${id}`);
    if (line.unitPriceCents !== cat.priceCents) {
      throw new Error(`${id} unitPriceCents ${line.unitPriceCents} != catalog ${cat.priceCents}`);
    }
    if (line.lineTotalCents !== cat.priceCents * line.quantity) {
      throw new Error(`${id} lineTotalCents ${line.lineTotalCents} != ${cat.priceCents * line.quantity}`);
    }
  }
  const expectedGrand = 2 * FAKE_CATALOG.get('prod-1001').priceCents + 3 * FAKE_CATALOG.get('prod-1002').priceCents;
  if (res.body.grandTotalCents !== expectedGrand) {
    throw new Error(`grandTotalCents ${res.body.grandTotalCents} != ${expectedGrand}`);
  }
});

test('T-04-02 totals ignore extra client-supplied price fields', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  // Inject bogus price fields on the add; they must have zero effect.
  const res = await agent.post('/cart/items').set('Authorization', auth).send({
    productId: 'prod-1001',
    quantity: 1,
    unitPriceCents: 1,
    lineTotalCents: 1,
    grandTotalCents: 1,
  });
  if (res.status !== 200) throw new Error(`expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (res.body.items[0].unitPriceCents !== FAKE_CATALOG.get('prod-1001').priceCents) {
    throw new Error('client unitPriceCents honored — T-04-02 violation');
  }
  if (res.body.grandTotalCents !== FAKE_CATALOG.get('prod-1001').priceCents) {
    throw new Error('client grandTotalCents honored — T-04-02 violation');
  }
});

test('T-04-02 money fields are integer cents (no floats on the wire)', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  await agent.post('/cart/items').set('Authorization', auth).send({ productId: 'prod-1001', quantity: 2 });
  const res = await agent.get('/cart').set('Authorization', auth);
  for (const line of res.body.items) {
    for (const field of ['unitPriceCents', 'lineTotalCents']) {
      if (!Number.isInteger(line[field])) throw new Error(`${field} is not an integer: ${line[field]}`);
    }
  }
  if (!Number.isInteger(res.body.grandTotalCents)) {
    throw new Error(`grandTotalCents not integer: ${res.body.grandTotalCents}`);
  }
});

test('T-04-02 empty cart grandTotalCents == 0', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  const res = await agent.get('/cart').set('Authorization', auth);
  if (res.status !== 200) throw new Error(`expected 200, got ${res.status}`);
  if (res.body.items.length !== 0) throw new Error('expected empty items');
  if (res.body.grandTotalCents !== 0) throw new Error(`expected 0, got ${res.body.grandTotalCents}`);
});
