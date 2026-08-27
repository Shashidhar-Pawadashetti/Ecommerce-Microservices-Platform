// tests/_env.js — environment bootstrap for the cart-service test suite.
//
// This module MUST be imported BEFORE ../src/app.js (and anything that pulls in
// config.js) so the JWT secret is fixed before config reads process.env. We use
// a stable base64 HS256 secret (>= 32 decoded bytes) so the config startup
// strength check passes and the minted test tokens verify byte-for-byte against
// the service's verifier.
//
// REDIS_URL / CART_TTL_SECONDS are intentionally NOT forced here:
//   - For logic tests (RUN_REDIS_TTL unset) the ioredis loader aliases ioredis to
//     ioredis-mock, so the URL is irrelevant (in-memory).
//   - For the TTL test (RUN_REDIS_TTL=1) the real REDIS_URL / CART_TTL_SECONDS are
//     supplied on the command line, and the loader leaves ioredis real.

process.env.JWT_SECRET ??= 'sHwEj/+tlj4qr7PKfSqStWXV4ZnD4GPa9ImYNcXvHBM=';
// Keep issuer/audience at the service defaults (ecommerce-auth / ecommerce-api)
// so the minted tokens match config.jwtIssuer / config.jwtAudience exactly.
