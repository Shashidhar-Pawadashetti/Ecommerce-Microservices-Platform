package com.ecommerce.order.kafka;

/**
 * FROZEN spellings per docs/kafka-topics.md: APPROVED | DECLINED. Nothing else
 * may ever appear on the payment.completed topic.
 */
public enum PaymentOutcome {
    APPROVED,
    DECLINED
}
