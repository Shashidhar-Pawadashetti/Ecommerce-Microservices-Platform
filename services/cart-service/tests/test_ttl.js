// tests/test_ttl.js — CART-04: observable abandoned-cart expiry, run ONLY when
// RUN_REDIS_TTL=1 is set (real Redis). ioredis-mock TTL eviction is unreliable
// (research Assumption A5), so this test must talk to a live redis server.
//
// Default `npm test` (RUN_REDIS_TTL unset) SKIPS this file to stay container-free
// and green. Run it explicitly with:
//   RUN_REDIS_TTL=1 CART_TTL_SECONDS=2 REDIS_URL=redis://localhost:6379/1 \
//     node --import ./tests/loader-register.mjs --test tests/test_ttl.js

import { test, describe } from 'node:test';
import { agent, mintToken, freshSub, resetCart, cartStore, sleep } from './conftest.js';

const RUN = process.env.RUN_REDIS_TTL === '1';
const TTL = parseInt(process.env.CART_TTL_SECONDS || '2', 10);
const suite = RUN ? describe : describe.skip;

suite(`CART-04 observable TTL expiry (real Redis; skipped unless RUN_REDIS_TTL=1)`, () => {
  test('abandoned cart expires: key present after add, TTL resets on mutation, gone after window', async () => {
    const sub = freshSub();
    await resetCart(sub);
    const auth = `Bearer ${mintToken(sub)}`;

    // Add a known product (catalog served by the fake fetch in conftest).
    const add = await agent.post('/cart/items').set('Authorization', auth).send({ productId: 'prod-1001', quantity: 1 });
    if (add.status !== 200) throw new Error(`add failed: ${add.status} ${JSON.stringify(add.body)}`);

    // Key exists with a positive TTL near the configured window.
    const ttlAfterAdd = await cartStore.readTtl(sub);
    if (ttlAfterAdd <= 0) throw new Error(`expected positive TTL after add, got ${ttlAfterAdd}`);
    if (ttlAfterAdd > TTL) throw new Error(`TTL ${ttlAfterAdd} exceeds configured window ${TTL}`);

    // Let the window partially elapse, then observe the TTL shrinking.
    await sleep(Math.floor(TTL * 1000 * 0.5));
    const ttlMid = await cartStore.readTtl(sub);
    if (ttlMid >= ttlAfterAdd) throw new Error(`TTL did not decrease over time (${ttlMid} >= ${ttlAfterAdd})`);

    // A second mutation must refresh (reset) the TTL anchor.
    const patch = await agent.patch(`/cart/items/prod-1001`).set('Authorization', auth).send({ quantity: 3 });
    if (patch.status !== 200) throw new Error(`patch failed: ${patch.status} ${JSON.stringify(patch.body)}`);
    const ttlAfterPatch = await cartStore.readTtl(sub);
    if (ttlAfterPatch <= ttlMid) throw new Error(`TTL not reset by mutation (${ttlAfterPatch} <= ${ttlMid})`);
    if (ttlAfterPatch <= 0) throw new Error(`TTL reset but non-positive: ${ttlAfterPatch}`);

    // Wait out the full window; the key must be gone and GET /cart empty.
    await sleep(TTL * 1000 + 500);
    const ttlGone = await cartStore.readTtl(sub);
    if (ttlGone !== -2) throw new Error(`expected TTL -2 (key gone) after window, got ${ttlGone}`);

    const get = await agent.get('/cart').set('Authorization', auth);
    if (get.status !== 200) throw new Error(`GET /cart unexpected status ${get.status}`);
    if (!Array.isArray(get.body.items) || get.body.items.length !== 0) {
      throw new Error(`expected empty items after expiry, got ${JSON.stringify(get.body.items)}`);
    }
  });
});

// Always-present signal so the default (container-free) run documents the skip.
test('CART-04 TTL test is container-free by default (RUN_REDIS_TTL must be 1 to run against real Redis)', () => {
  if (RUN) return; // the suite above executes the real-redis assertions
  // Pass; the describe.skip above documents the skip in the runner output.
});
