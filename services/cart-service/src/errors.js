// errors.js — unified error envelope + domain error classes.
//
// Every failure on the wire is rendered as the shared {code, message} envelope
// from docs/api-contracts/_shared.yaml. Messages are human-safe and never leak
// internals (hostnames, stacks, driver errors). The error classes below let
// the app-level error handler map domain failures to the right HTTP status +
// code without scattering literals through the routes.

export class CartServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class ValidationError extends CartServiceError {
  constructor(message = 'Request validation failed. Check field formats and limits.') {
    super('VALIDATION_FAILED', message);
  }
}

export class UnknownProduct extends CartServiceError {
  constructor(productId) {
    super('UNKNOWN_PRODUCT', `Product not found: ${productId}`);
    this.productId = productId;
  }
}

export class LineNotInCart extends CartServiceError {
  constructor(productId) {
    super('LINE_NOT_IN_CART', `Cart line not found: ${productId}`);
    this.productId = productId;
  }
}

export class NotFound extends CartServiceError {
  constructor(message = 'The requested resource was not found.') {
    super('NOT_FOUND', message);
  }
}

export class CatalogUnavailable extends CartServiceError {
  constructor(message = 'Catalog unavailable.') {
    super('SERVICE_UNAVAILABLE', message);
  }
}

// Write the compact envelope {code, message} ONLY — never internals.
export function sendError(res, status, code, message) {
  return res.status(status).json({ code, message });
}

// Express 5 error-handler tail. Arity (4 args) makes Express treat this as the
// terminal error middleware. Unknown errors are logged server-side only.
export function errorHandler(err, _req, res, _next) {
  if (err instanceof UnknownProduct) {
    return sendError(res, 404, 'UNKNOWN_PRODUCT', err.message);
  }
  if (err instanceof LineNotInCart) {
    return sendError(res, 404, 'LINE_NOT_IN_CART', err.message);
  }
  if (err instanceof NotFound) {
    return sendError(res, 404, 'NOT_FOUND', err.message);
  }
  if (err instanceof ValidationError) {
    return sendError(res, 400, 'VALIDATION_FAILED', err.message);
  }
  if (err instanceof CatalogUnavailable) {
    return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Catalog unavailable.');
  }
  // Log only — never echo internals to the client.
  console.error('[cart-service] unhandled error:', err);
  return sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
}
