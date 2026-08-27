// catalog/catalogClient.js — network-internal batch pricing call.
//
// Calls POST /catalog/products/batch (security: [], network-internal, NO
// bearer — see docs/api-contracts/catalog-service.openapi.yaml). The response
// is an array of { productId, name, priceCents }; UNKNOWN ids are SILENTLY
// OMITTED, so absence in the returned map is the invalidity signal.
//
// This client is the single source of truth for prices (threat T-04-02):
// totals are computed only from what it returns. A non-OK response or any
// transport error becomes CatalogUnavailable, which the app maps to a 503
// envelope — never the catalog's internals leak.

import { config } from '../config.js';
import { CatalogUnavailable } from '../errors.js';

const TIMEOUT_MS = 2000;

export async function batchPrice(productIds, catalogUrl = config.catalogUrl) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return new Map();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(`${catalogUrl}/catalog/products/batch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productIds }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      throw new CatalogUnavailable();
    }

    const entries = await resp.json();
    const map = new Map();
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        if (entry && entry.productId != null) {
          map.set(entry.productId, {
            name: entry.name,
            priceCents: entry.priceCents,
          });
        }
      }
    }
    return map;
  } catch (err) {
    if (err instanceof CatalogUnavailable) throw err;
    // Abort/timeout/network errors all mean the catalog can't be reached.
    throw new CatalogUnavailable();
  } finally {
    clearTimeout(timer);
  }
}
