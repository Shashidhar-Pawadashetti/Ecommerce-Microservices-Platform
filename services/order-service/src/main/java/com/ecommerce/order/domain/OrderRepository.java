package com.ecommerce.order.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface OrderRepository extends JpaRepository<Order, Long> {

    Order findByOrderId(String orderId);

    List<Order> findByUserIdOrderByCreatedAtDesc(String userId);

    List<Order> findByStatusAndCreatedAtBefore(OrderStatus status, Instant threshold);

    /**
     * Atomically locks stuck orders using PostgreSQL's FOR UPDATE SKIP LOCKED.
     * Prevents race conditions during scheduled reconciliation across multiple scaled replicas.
     */
    @Query(value = "SELECT * FROM orders WHERE status = :status AND created_at < :threshold LIMIT 50 FOR UPDATE SKIP LOCKED", nativeQuery = true)
    List<Order> findStuckOrdersForReconciliation(@Param("status") String status, @Param("threshold") Instant threshold);
}
