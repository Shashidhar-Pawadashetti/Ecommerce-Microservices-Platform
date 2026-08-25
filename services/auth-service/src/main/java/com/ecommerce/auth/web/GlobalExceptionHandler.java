package com.ecommerce.auth.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.ecommerce.auth.support.ApiError;
import com.ecommerce.auth.user.UserService;

/**
 * Translates failures into the unified {@link ApiError} envelope with the
 * exact _shared.yaml example strings. Internals are logged server-side ONLY —
 * wire messages never carry hostnames, stack traces, or driver errors.
 */
@RestControllerAdvice
class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** jakarta validation on @Valid request bodies (malformed email, short password…). */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> invalidBody(MethodArgumentNotValidException ignored) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError("VALIDATION_FAILED",
                        "Request validation failed. Check field formats and limits."));
    }

    /**
     * Fast-path duplicate signal raised by UserService before any insert is
     * attempted; same 409 envelope as the race backstop below.
     */
    @ExceptionHandler(UserService.DuplicateEmailException.class)
    ResponseEntity<ApiError> knownDuplicate(UserService.DuplicateEmailException ex) {
        log.debug("Signup rejected for already-registered email: {}", ex.getMessage());
        return conflict();
    }

    /**
     * Race-safe backstop: whenever two concurrent signups slip past the
     * pre-check, the users_email_uniq unique index violation lands here and is
     * translated to the identical DUPLICATE_EMAIL envelope. The constraint —
     * never a select-then-insert — is the authoritative duplicate detector.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> integrityViolation(DataIntegrityViolationException ex) {
        log.warn("Integrity violation suppressed", ex);
        return conflict();
    }

    private static ResponseEntity<ApiError> conflict() {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError("DUPLICATE_EMAIL",
                        "An account with this email already exists."));
    }
}
