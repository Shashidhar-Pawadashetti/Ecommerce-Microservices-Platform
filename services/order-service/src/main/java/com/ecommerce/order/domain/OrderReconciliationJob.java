package com.ecommerce.order.domain;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Component
public class OrderReconciliationJob {

    private static final Logger log = LoggerFactory.getLogger(OrderReconciliationJob.class);

    private final OrderRepository orderRepository;

    public OrderReconciliationJob(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    @Scheduled(fixedRateString = "60000")
    public void sweepAbandonedOrders() {
        Instant threshold = Instant.now().minus(5, ChronoUnit.MINUTES);
        List<Order> stuckOrders = orderRepository.findByStatusAndCreatedAtBefore(OrderStatus.PENDING_PAYMENT, threshold);
        
        if (stuckOrders.isEmpty()) {
            return;
        }

        log.info("Found {} orders stuck in PENDING_PAYMENT for > 5 mins. Sweeping to PAYMENT_FAILED.", stuckOrders.size());

        for (Order order : stuckOrders) {
            try {
                order.setStatus(OrderStatus.PAYMENT_FAILED);
                orderRepository.save(order);
                log.info("Reconciled orderId={} to PAYMENT_FAILED", order.getOrderId());
            } catch (Exception e) {
                log.error("Failed to reconcile orderId={}", order.getOrderId(), e);
            }
        }
    }
}
