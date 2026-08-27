// index.js — bootstrap: fail-fast Redis, then listen.
//
// If Redis is unreachable at startup we refuse to start (fail fast beats fail
// insecurely) rather than serving a cart that can't persist.
import { app } from './app.js';
import { config } from './config.js';
import { createRedisClient } from './store/cartStore.js';

async function bootstrap() {
  const client = createRedisClient();
  client.on('error', (err) => console.error('[cart-service] redis error:', err));

  try {
    await client.ping();
  } catch (err) {
    console.error('[cart-service] Redis unavailable at startup:', err);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`cart-service listening on :${config.port}`);
  });
}

bootstrap();
