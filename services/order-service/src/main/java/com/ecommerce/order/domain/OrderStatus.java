package com.ecommerce.order.domain;

/**
 * Canonical order lifecycle states (D-01 spellings). PAID and PAYMENT_FAILED
 * are terminal: once reached, further payment.completed deliveries are
 * acknowledged and ignored (ORDR-04).
 */
public enum OrderStatus {
    PENDING_PAYMENT,
    PAID,
    PAYMENT_FAILED;

    /** A terminal order never transitions again under redelivery. */
    public boolean isTerminal() {
        return this == PAID || this == PAYMENT_FAILED;
    }
}
