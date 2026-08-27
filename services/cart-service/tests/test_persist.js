// tests/test_persist.js — CART-03: a mutation persists the cart under the Redis
// key cart:{userId} so it survives across reads (and, in production, processes).

import { test } from 'node:test';
import { agent, mintToken, freshSub, resetCart, cartStore } from './conftest.js';

test('CART-03 after add, readCart(sub) returns the persisted line', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  await agent.post('/cart/items').set('Authorization', auth).send({ productId: 'prod-1001', quantity: 2 });

  const cart = await cartStore.readCart(sub);
  if (cart.items.length !== 1) throw new Error(`expected 1 persisted line, got ${cart.items.length}`);
  const line = cart.items[0];
  if (line.productId !== 'prod-1001' || line.quantity !== 2) {
    throw new Error(`unexpected persisted line: ${JSON.stringify(line)}`);
  }
});

test('CART-03 Redis key cart:{sub} exists after add (ioredis-mock)', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  await agent.post('/cart/items').set('Authorization', auth).send({ productId: 'prod-1001', quantity: 1 });

  const client = cartStore.createRedisClient();
  const exists = await client.exists(`cart:${sub}`);
  if (exists !== 1) throw new Error(`expected cart:${sub} to exist, exists=${exists}`);

  // And the stored blob round-trips through GET (read path).
  const get = await agent.get('/cart').set('Authorization', auth);
  if (get.status !== 200 || get.body.items.length !== 1) {
    throw new Error(`GET /cart did not reflect persisted cart: ${JSON.stringify(get.body)}`);
  }
});

test('CART-03 clearing the cart empties the key (cart:{sub} holds [] blob)', async () => {
  const sub = freshSub();
  await resetCart(sub);
  const auth = `Bearer ${mintToken(sub)}`;

  await agent.post('/cart/items').set('Authorization', auth).send({ productId: 'prod-1001', quantity: 1 });
  await agent.delete('/cart').set('Authorization', auth);

  // clearCart rewrites the blob as [] (TTL refreshed) rather than deleting the
  // key, so the key persists but the stored cart is empty.
  const client = cartStore.createRedisClient();
  const exists = await client.exists(`cart:${sub}`);
  if (exists !== 1) throw new Error(`expected cart:${sub} to still exist (empty), exists=${exists}`);
  const raw = await client.get(`cart:${sub}`);
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.items) || parsed.items.length !== 0) {
    throw new Error(`expected empty items after clear, got ${JSON.stringify(parsed)}`);
  }
  const cart = await cartStore.readCart(sub);
  if (cart.items.length !== 0) throw new Error('readCart not empty after clear');
});
