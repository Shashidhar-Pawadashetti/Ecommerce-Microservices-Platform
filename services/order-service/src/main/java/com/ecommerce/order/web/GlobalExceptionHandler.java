package com.ecommerce.order.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.ecommerce.order.support.ApiError;
import com.ecommerce.order.support.CartServiceException;
import com.ecommerce.order.support.DuplicateIdempotencyKeyException;
import com.ecommerce.order.support.EmptyCartException;
import com.ecommerce.order.support.OrderNotFoundException;

/**
 * Translates failures into the unified {@link ApiError} envelope with the exact
 * _shared.yaml example strings. Internals are logged server-side ONLY — wire
 * messages never carry hostnames, stack traces, or driver errors.
 */
@RestControllerAdvice
class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** jakarta validation on @Valid request bodies. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> invalidBody(MethodArgumentNotValidException ignored) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError("VALIDATION_FAILED",
                        "Request validation failed. Check field formats and limits."));
    }

    /** Empty cart at checkout -> 400 VALIDATION_FAILED (contract D-checkout-source). */
    @ExceptionHandler(EmptyCartException.class)
    ResponseEntity<ApiError> emptyCart(EmptyCartException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError("VALIDATION_FAILED", "Cart is empty; cannot create an order."));
    }

    /** Unknown order OR other-owner -> identical 404 (no existence leak, ASVS V4). */
    @ExceptionHandler(OrderNotFoundException.class)
    ResponseEntity<ApiError> orderNotFound(OrderNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiError("NOT_FOUND", "The requested resource was not found."));
    }

    /** Concurrent idempotency replay slips past pre-check -> 409 DUPLICATE. */
    @ExceptionHandler(DuplicateIdempotencyKeyException.class)
    ResponseEntity<ApiError> duplicateKey(DuplicateIdempotencyKeyException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError("DUPLICATE", "A request with this Idempotency-Key was already processed."));
    }

    /** cart-service call failed (other than empty) -> 502. */
    @ExceptionHandler(CartServiceException.class)
    ResponseEntity<ApiError> cartFailed(CartServiceException ex) {
        log.warn("Cart service error: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new ApiError("BAD_GATEWAY", "Upstream cart service unavailable."));
    }

    /** Race-safe backstop for any other integrity violation -> 409. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> integrityViolation(DataIntegrityViolationException ex) {
        log.warn("Integrity violation suppressed", ex);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError("CONFLICT", "Request conflicts with existing state."));
    }
}
