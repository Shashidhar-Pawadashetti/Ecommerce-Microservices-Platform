// app.js — Express application assembly (exported for supertest).
import express from 'express';
import { healthRouter } from './routes/health.js';
import { cartRouter } from './routes/cart.js';
import { internalRouter } from './routes/internal.js';
import { errorHandler } from './errors.js';

export const app = express();

app.use(express.json());

// Health is probed directly by Compose (no auth).
app.use(healthRouter);
// Cart operations live under /cart and are token-protected.
app.use('/cart', cartRouter);
// Network-internal checkout snapshot GET /cart/:userId (mounted at '/' so the
// full path is /cart/:userId). Token-gated; excluded from the gateway in Phase 7.
app.use(internalRouter);

// 404 fallback via middleware (Express 5 forbids bare `*` route paths).
app.use((_req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Resource not found.' });
});

// Terminal error handler — maps domain errors to the shared envelope.
app.use(errorHandler);
