package com.ecommerce.order.support;

/** Raised when the caller's cart is empty at checkout -> 400 VALIDATION_FAILED. */
public class EmptyCartException extends RuntimeException {
    public EmptyCartException() {
        super("Cart is empty");
    }
}
