package com.ecommerce.order.support;

/** Raised when an order is unknown OR owned by another user -> 404 NOT_FOUND. */
public class OrderNotFoundException extends RuntimeException {
    public OrderNotFoundException() {
        super("Order not found");
    }
}
