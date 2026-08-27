package com.ecommerce.order.domain;

/**
 * Immutable purchase-time snapshot of a single cart line. Field names match the
 * OrderItem schema in docs/api-contracts/orders-service.openapi.yaml exactly.
 */
public record OrderItem(
        String productId,
        String nameSnapshot,
        int unitPriceCents,
        int quantity
) {
}
