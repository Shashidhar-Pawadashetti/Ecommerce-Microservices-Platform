package com.ecommerce.order.support;

/** Raised when the cart-service call fails (other than empty-cart) -> 502. */
public class CartServiceException extends RuntimeException {
    public CartServiceException(String message) {
        super(message);
    }
}
