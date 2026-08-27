package com.ecommerce.order.support;

/**
 * Raised when a concurrent replay slips past the interceptor pre-check and hits
 * the unique idempotency_keys.key constraint -> 409 CONFLICT (DUPLICATE).
 */
public class DuplicateIdempotencyKeyException extends RuntimeException {
    public DuplicateIdempotencyKeyException(String message) {
        super(message);
    }
}
