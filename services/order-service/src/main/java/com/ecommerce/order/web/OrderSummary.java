package com.ecommerce.order.web;

import java.time.Instant;

import com.ecommerce.order.domain.Order;
import com.ecommerce.order.domain.OrderStatus;

/**
 * Scanning-relevant subset of an order for GET /orders (history list, ORDR-07).
 */
public record OrderSummary(
        String orderId,
        OrderStatus status,
        int totalCents,
        Instant createdAt
) {
    public static OrderSummary from(Order order) {
        return new OrderSummary(
                order.getOrderId(),
                order.getStatus(),
                order.getTotalCents(),
                order.getCreatedAt());
    }
}
