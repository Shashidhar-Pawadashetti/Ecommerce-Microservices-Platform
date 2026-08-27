package com.ecommerce.order.web;

import java.util.List;

/**
 * Paginated history list wrapper for GET /orders (ORDR-07). {@code total} is the
 * caller's total order count independent of any rendering window.
 */
public record OrderList(List<OrderSummary> items, int total) {
}
