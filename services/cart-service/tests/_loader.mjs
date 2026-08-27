// tests/_loader.mjs — ESM resolve hook that aliases `ioredis` to `ioredis-mock`
// for the container-free logic suite.
//
// The cart store imports `Redis` from the bare specifier 'ioredis'. We cannot
// modify the source (rule: tests only), so we swap the implementation at module
// resolution time. This keeps `node --test` free of a Redis container for every
// logic test while still pointing at REAL redis when RUN_REDIS_TTL=1 — the CART-04
// observable-expiry test, which must use a real server because ioredis-mock TTL
// eviction is unreliable (research Assumption A5).

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'ioredis' && !process.env.RUN_REDIS_TTL) {
    return nextResolve('ioredis-mock', context);
  }
  return nextResolve(specifier, context);
}
