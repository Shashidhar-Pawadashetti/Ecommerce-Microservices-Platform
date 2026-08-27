// config.js — environment binding for the Cart Service (Phase 4).
//
// Every value has a safe default so the service boots in dev/test without a
// .env file. Production values are injected by Docker Compose. The JWT secret
// is base64-encoded in the environment (mirrors auth-service's signer and the
// catalog-service verifier); we expose a decoded-bytes getter so the signer
// and verifier use byte-identical material.
//
// Startup assertions (fail-fast): a misconfigured cart TTL or an undersized
// JWT secret must refuse to boot rather than silently degrade security or
// persistence behavior. The secret value is NEVER logged — only its length.

export const config = {
  // Base64-encoded shared HS256 secret. Default matches catalog-service's
  // default so the two transitional self-verifiers agree out-of-the-box.
  jwtSecret: process.env.JWT_SECRET ?? 'sHwEj/+tlj4qr7PKfSqStWXV4ZnD4GPa9ImYNcXvHBM=',
  jwtIssuer: process.env.JWT_ISSUER ?? 'ecommerce-auth',
  jwtAudience: process.env.JWT_AUDIENCE ?? 'ecommerce-api',
  jwtTtlSeconds: parseInt(process.env.JWT_TTL_SECONDS ?? '3600', 10),
  redisUrl: process.env.REDIS_URL ?? 'redis://redis:6379/0',
  catalogUrl: process.env.CATALOG_URL ?? 'http://catalog-service:8000',
  cartTtlSeconds: parseInt(process.env.CART_TTL_SECONDS ?? '1209600', 10),
  port: parseInt(process.env.PORT ?? '3001', 10),
};

// CART_TTL_SECONDS: integer >= 1 (default 1209600 = 14 days). Fail-fast if
// the env value is missing, non-integer, or below 1 so abandoned-cart expiry
// (CART-04) is always well-defined.
const rawTtl = process.env.CART_TTL_SECONDS ?? '1209600';
const parsedTtl = parseInt(rawTtl, 10);
if (!Number.isInteger(parsedTtl) || parsedTtl < 1) {
  throw new Error(
    `CART_TTL_SECONDS must be an integer >= 1, got ${JSON.stringify(rawTtl)}`
  );
}
config.cartTtlSeconds = parsedTtl;

// JWT secret strength floor: decoded bytes must be >= 32 (HS256 256-bit floor,
// mirrors catalog-service config). We log length ONLY — the secret itself is
// never written to stdout/stderr.
const secretBytes = Buffer.from(config.jwtSecret, 'base64');
if (secretBytes.length < 32) {
  throw new Error(
    'JWT_SECRET decodes to fewer than 32 bytes; refusing to start (HS256 strength floor).'
  );
}
console.log(
  `[cart-service] JWT_SECRET decoded length: ${secretBytes.length} bytes (value never logged)`
);

// Decoded raw secret bytes for jsonwebtoken HS256 verify/sign.
// MUST match the auth-service signer (base64-decoded) — see docs/json-interop.md.
export function jwtSecretBytes() {
  return Buffer.from(config.jwtSecret, 'base64');
}
