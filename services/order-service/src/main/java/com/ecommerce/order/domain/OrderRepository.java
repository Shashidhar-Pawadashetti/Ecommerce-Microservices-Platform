package com.ecommerce.order.domain;

import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, Long> {

    Order findByOrderId(String orderId);

    java.util.List<Order> findByUserIdOrderByCreatedAtDesc(String userId);
}
