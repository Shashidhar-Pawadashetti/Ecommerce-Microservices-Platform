package com.ecommerce.order.web;

import java.time.Instant;
import java.util.List;

import com.ecommerce.order.domain.Order;
import com.ecommerce.order.domain.OrderItem;
import com.ecommerce.order.domain.OrderStatus;

/**
 * Full order detail — the polling endpoint body (ORDR-07). Field names mirror
 * the OrderSnapshot schema in orders-service.openapi.yaml exactly.
 */
public record OrderSnapshot(
        String orderId,
        String userId,
        OrderStatus status,
        List<OrderItem> items,
        int totalCents,
        String currency,
        Instant createdAt
) {
    public static OrderSnapshot from(Order order) {
        return new OrderSnapshot(
                order.getOrderId(),
                order.getUserId(),
                order.getStatus(),
                order.getItems(),
                order.getTotalCents(),
                order.getCurrency(),
                order.getCreatedAt());
    }
}
