package com.ecommerce.order.kafka;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * payment.completed event payload (consumed by order-service). Field names mirror
 * docs/kafka-topics.md exactly. {@code reason} is present ONLY when outcome is
 * DECLINED; on APPROVED it is omitted entirely (interop Rule 4) — @JsonIgnoreProperties
 * tolerates either shape.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PaymentCompletedPayload(
        String eventId,
        String orderId,
        PaymentOutcome outcome,
        String reason,
        String processedAt
) {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static PaymentCompletedPayload fromJson(String json) {
        try {
            return MAPPER.readValue(json, PaymentCompletedPayload.class);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid payment.completed payload", e);
        }
    }
}
