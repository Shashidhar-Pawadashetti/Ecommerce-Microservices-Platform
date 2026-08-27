// routes/health.js — liveness probe for Docker Compose (network-internal).
// Never routed through the api-gateway (Phase 7). No auth.
import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});
