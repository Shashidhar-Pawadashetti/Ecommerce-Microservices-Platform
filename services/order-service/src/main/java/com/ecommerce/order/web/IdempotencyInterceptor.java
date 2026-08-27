package com.ecommerce.order.web;

import com.ecommerce.order.domain.IdempotencyKey;
import com.ecommerce.order.domain.IdempotencyRepository;
import com.ecommerce.order.domain.Order;
import com.ecommerce.order.domain.OrderRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Idempotency guard for POST /orders (ORDR-05).
 *
 * preHandle policy:
 *  - missing / blank key          -> 400 (caller must supply a key)
 *  - key shorter than 16 chars    -> 400 (collision-resistance floor)
 *  - key already recorded (replay) -> re-serve the SAME order snapshot (status
 *    preserved) and short-circuit (return false) so the controller never runs.
 *  - otherwise                    -> stash key in request attrs; controller later
 *    records key->orderId so subsequent identical POSTs replay.
 *
 * Only applies to POST /orders; GET /orders (list) and GET /orders/{id} pass through.
 */
@Component
public class IdempotencyInterceptor implements HandlerInterceptor {

    private static final int MIN_KEY_LENGTH = 16;

    private final IdempotencyRepository idempotencyRepository;
    private final OrderRepository orderRepository;
    private final ObjectMapper objectMapper;

    public IdempotencyInterceptor(
            IdempotencyRepository idempotencyRepository,
            OrderRepository orderRepository,
            ObjectMapper objectMapper) {
        this.idempotencyRepository = idempotencyRepository;
        this.orderRepository = orderRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(
            HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String key = request.getHeader("Idempotency-Key");
        if (key == null || key.isBlank()) {
            response.sendError(HttpStatus.BAD_REQUEST.value(), "Idempotency-Key header is required");
            return false;
        }
        key = key.trim();
        if (key.length() < MIN_KEY_LENGTH) {
            response.sendError(
                    HttpStatus.BAD_REQUEST.value(),
                    "Idempotency-Key must be at least " + MIN_KEY_LENGTH + " characters");
            return false;
        }

        IdempotencyKey existing = idempotencyRepository.findByKey(key);
        if (existing != null && existing.getOrderId() != null) {
            Order order = orderRepository.findByOrderId(existing.getOrderId());
            if (order != null) {
                // Re-serve the SAME order snapshot on replay (HTTP 200 is the
                // idempotent-replay status; body is identical to the original).
                response.setStatus(HttpStatus.OK.value());
                response.setContentType("application/json");
                response.getWriter().write(objectMapper.writeValueAsString(OrderSnapshot.from(order)));
                return false;
            }
        }

        request.setAttribute("idemKey", key);
        return true;
    }
}
