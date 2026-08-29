package com.ecommerce.order.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.List;

public interface OrderRepository extends JpaRepository<Order, Long> {

    Order findByOrderId(String orderId);

    List<Order> findByUserIdOrderByCreatedAtDesc(String userId);

    List<Order> findByStatusAndCreatedAtBefore(OrderStatus status, Instant threshold);
}
