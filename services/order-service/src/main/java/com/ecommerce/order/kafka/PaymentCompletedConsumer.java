package com.ecommerce.order.kafka;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.ecommerce.order.domain.OrderService;

/**
 * Consumes payment.completed (group order-service). Delegates the state-machine
 * transition to OrderService.applyPaymentResult, which enforces the terminal
 * guard (ORDR-04) so redelivered terminal events are acknowledged and ignored.
 */
@Component
public class PaymentCompletedConsumer {

    private static final Logger log = LoggerFactory.getLogger(PaymentCompletedConsumer.class);

    private final OrderService orderService;

    public PaymentCompletedConsumer(OrderService orderService) {
        this.orderService = orderService;
    }

    @KafkaListener(id = "order-service", topics = "payment.completed", groupId = "order-service")
    public void onPaymentCompleted(ConsumerRecord<String, String> record) {
        try {
            PaymentCompletedPayload payload = PaymentCompletedPayload.fromJson(record.value());
            log.info("Received payment.completed orderId={} outcome={}", payload.orderId(), payload.outcome());
            orderService.applyPaymentResult(payload.orderId(), payload.outcome(), payload.reason());
        } catch (IllegalArgumentException ex) {
            // Poison message: log and skip (contract: poison messages logged and skipped).
            log.warn("Skipping malformed payment.completed: {}", ex.getMessage());
        }
    }
}
