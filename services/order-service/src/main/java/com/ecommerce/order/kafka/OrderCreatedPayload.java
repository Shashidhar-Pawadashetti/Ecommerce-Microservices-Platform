package com.ecommerce.order.kafka;

import java.util.List;
import java.util.UUID;

import com.ecommerce.order.domain.Order;
import com.ecommerce.order.domain.OrderItem;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * order.created event payload. Field names mirror docs/kafka-topics.md EXACTLY
 * (single drift surface with the OpenAPI OrderSnapshot schema). Produced ONLY
 * AFTER the order row commits (ORDR-02) — never before, so consumers act on an
 * existing REST resource.
 */
public record OrderCreatedPayload(
        String eventId,
        String orderId,
        String userId,
        String userEmail,
        List<OrderItem> items,
        int totalCents,
        String currency,
        String createdAt
) {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static OrderCreatedPayload from(Order order, String userEmail) {
        return new OrderCreatedPayload(
                UUID.randomUUID().toString(),
                order.getOrderId(),
                order.getUserId(),
                userEmail,
                order.getItems(),
                order.getTotalCents(),
                order.getCurrency(),
                order.getCreatedAt().toString());
    }

    public String toJson() {
        try {
            return MAPPER.writeValueAsString(this);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize order.created", e);
        }
    }
}
