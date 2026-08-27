package com.ecommerce.order.kafka;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import com.ecommerce.order.domain.Order;

/**
 * Publishes order.created (key = orderId, value = JSON) AFTER the order row has
 * committed (ORDR-02 dual-write ordering — the controller calls this outside the
 * transaction). Record key = orderId keeps per-order events ordered.
 */
@Component
public class OrderEventProducer {

    private static final Logger log = LoggerFactory.getLogger(OrderEventProducer.class);
    private static final String TOPIC = "order.created";

    private final KafkaTemplate<String, String> template;

    public OrderEventProducer(KafkaTemplate<String, String> template) {
        this.template = template;
    }

    public void publishCreated(Order order, String userEmail) {
        OrderCreatedPayload payload = OrderCreatedPayload.from(order, userEmail);
        template.send(TOPIC, order.getOrderId(), payload.toJson());
        log.info("Published order.created orderId={}", order.getOrderId());
    }
}
