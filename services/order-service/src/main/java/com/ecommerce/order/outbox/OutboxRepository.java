package com.ecommerce.order.outbox;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;

public interface OutboxRepository extends CrudRepository<OutboxEvent, UUID> {

    List<OutboxEvent> findAllByOrderByCreatedAtAsc();

    /**
     * Atomically locks up to 50 pending outbox events using PostgreSQL's FOR UPDATE SKIP LOCKED.
     * Prevents race conditions and duplicate publishing when running multiple order-service replicas in Kubernetes.
     */
    @Query(value = "SELECT * FROM outbox_events ORDER BY created_at ASC LIMIT 50 FOR UPDATE SKIP LOCKED", nativeQuery = true)
    List<OutboxEvent> findPendingEventsForProcessing();
}
