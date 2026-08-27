package com.ecommerce.order.domain;

import org.springframework.data.jpa.repository.JpaRepository;

public interface IdempotencyRepository extends JpaRepository<IdempotencyKey, String> {

    IdempotencyKey findByKey(String key);
}
