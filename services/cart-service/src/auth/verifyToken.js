// auth/verifyToken.js — HS256 bearer verification middleware.
//
// Identity on every user-facing operation derives EXCLUSIVELY from the verified
// JWT `sub` claim (threat T-04-01 mitigation). The secret is base64-decoded to
// raw bytes before jsonwebtoken verifies, matching the auth-service signer and
// the catalog-service verifier byte-for-byte. Algorithm is pinned to HS256 and
// iss/aud/exp are validated with a ±60s clock skew (docs/json-interop.md JWT
// Claims). All auth failures collapse to one byte-identical 401 envelope
// (anti-enumeration), per catalog-service/app/security.py.
//
// Phase-4 transitional holder: cart-service self-verifies until the api-gateway
// owns verification in Phase 7 (DOCS-02-style deviation, reversible).

import jwt from 'jsonwebtoken';
import { config, jwtSecretBytes } from '../config.js';
import { sendError } from '../errors.js';

export function verifyBearer(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required or credentials invalid.');
  }

  try {
    const claims = jwt.verify(token, jwtSecretBytes(), {
      algorithms: ['HS256'], // pin alg; reject RS/none swaps (T-04-03)
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
      clockTolerance: 60, // ±60s skew per interop §JWT Claims
    });
    req.user = claims; // identity from token ONLY
    return next();
  } catch {
    // One byte-identical envelope for every auth failure (missing, expired,
    // wrong iss/aud, alg swap, foreign signature) — no enumeration signal.
    return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required or credentials invalid.');
  }
}
