package com.ecommerce.order.outbox;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.ecommerce.order.kafka.OrderEventProducer;

@Component
public class OutboxRelay {

    private static final Logger log = LoggerFactory.getLogger(OutboxRelay.class);

    private final OutboxRepository outboxRepository;
    private final OrderEventProducer eventProducer;

    public OutboxRelay(OutboxRepository outboxRepository, OrderEventProducer eventProducer) {
        this.outboxRepository = outboxRepository;
        this.eventProducer = eventProducer;
    }

    /**
     * Relays outbox events with row-level pessimistic locking (FOR UPDATE SKIP LOCKED) within
     * an atomic transaction. Safely coordinates across multiple scaled pod replicas in Kubernetes.
     */
    @Transactional
    @Scheduled(fixedDelayString = "2000")
    public void relayEvents() {
        List<OutboxEvent> pending = outboxRepository.findPendingEventsForProcessing();
        if (pending.isEmpty()) {
            return;
        }

        for (OutboxEvent event : pending) {
            try {
                if ("order.created".equals(event.getType())) {
                    eventProducer.publishCreated(event.getAggregateId(), event.getPayload());
                }
                outboxRepository.delete(event);
            } catch (Exception e) {
                log.error("Failed to relay outbox event ID {}", event.getId(), e);
                // Break to preserve aggregate ordering, wait for next scheduled transaction
                break;
            }
        }
    }
}
