package com.ecommerce.auth.support;

/**
 * Unified error envelope per _shared.yaml schema Error: clients branch on the
 * machine-readable code, never on message text, and messages never leak
 * internals (no hostnames, stack traces, or driver/database errors).
 */
public record ApiError(String code, String message) {
}
