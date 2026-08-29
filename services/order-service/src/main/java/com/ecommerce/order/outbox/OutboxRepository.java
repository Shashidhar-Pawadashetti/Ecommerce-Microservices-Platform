package com.ecommerce.order.outbox;

import java.util.List;
import java.util.UUID;
import org.springframework.data.repository.CrudRepository;

public interface OutboxRepository extends CrudRepository<OutboxEvent, UUID> {
    List<OutboxEvent> findAllByOrderByCreatedAtAsc();
}
