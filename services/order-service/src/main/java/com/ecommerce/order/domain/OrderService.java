package com.ecommerce.order.domain;

import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ecommerce.order.config.CartClient;
import com.ecommerce.order.kafka.PaymentOutcome;
import com.ecommerce.order.support.DuplicateIdempotencyKeyException;

/**
 * Core order business logic. Owns the checkout transaction (order + idempotency
 * row), the cart snapshot mapping, and the payment-completed state machine.
 *
 * <p>Dual-write ordering (ORDR-02): the controller persists via createOrder
 * (committed here), THEN publishes order.created and clears the cart OUTSIDE this
 * transaction. This guarantees consumers never act on a non-existent order.</p>
 */
@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    private final OrderRepository orderRepository;
    private final IdempotencyRepository idempotencyRepository;
    private final CartClient cartClient;

    public OrderService(OrderRepository orderRepository,
                        IdempotencyRepository idempotencyRepository,
                        CartClient cartClient) {
        this.orderRepository = orderRepository;
        this.idempotencyRepository = idempotencyRepository;
        this.cartClient = cartClient;
    }

    /**
     * Snapshot the caller's cart, persist the order in PENDING_PAYMENT, and
     * persist the (key -> orderId) idempotency mapping in the SAME transaction.
     * The unique idempotency_keys.key constraint is the race-safe duplicate
     * backstop: a concurrent replay that slipped past the interceptor pre-check
     * lands here and is re-routed to the existing order.
     */
    @Transactional
    public Order createOrder(String sub, String idemKey, String authHeader) {
        CartClient.CartView cart = cartClient.snapshot(sub, authHeader);
        List<OrderItem> items = cart.items().stream()
                .map(line -> new OrderItem(line.productId(), line.name(), line.unitPriceCents(), line.quantity()))
                .toList();

        Order order = new Order();
        order.setOrderId("ord-" + UUID.randomUUID());
        order.setUserId(sub);
        order.setItems(items);
        order.setTotalCents(cart.grandTotalCents());
        order.setCurrency(cart.currency());
        order.setStatus(OrderStatus.PENDING_PAYMENT);
        Order saved = orderRepository.save(order);

        if (idemKey != null && !idemKey.isBlank()) {
            try {
                idempotencyRepository.save(new IdempotencyKey(idemKey, saved.getOrderId()));
            } catch (DataIntegrityViolationException ex) {
                // Concurrent replay slipped past the pre-check: return the existing order.
                log.debug("Idempotency race on key={}; returning existing order", idemKey);
                IdempotencyKey existing = idempotencyRepository.findByKey(idemKey);
                if (existing != null) {
                    Order existingOrder = orderRepository.findByOrderId(existing.getOrderId());
                    if (existingOrder != null) {
                        return existingOrder;
                    }
                }
                throw new DuplicateIdempotencyKeyException("Duplicate Idempotency-Key: " + idemKey);
            }
        }
        return saved;
    }

    /**
     * Apply a payment outcome. Terminal-state guard (ORDR-04): once an order is
     * PAID or PAYMENT_FAILED, further deliveries are acknowledged and ignored —
     * keeping the consumer idempotent under at-least-once redelivery. An unknown
     * orderId (poison/late event) is ignored rather than failing the consumer.
     */
    public void applyPaymentResult(String orderId, PaymentOutcome outcome, String reason) {
        Order order = orderRepository.findByOrderId(orderId);
        if (order == null) {
            log.debug("Ignoring payment.completed for unknown order {}", orderId);
            return;
        }
        if (order.isTerminal()) {
            // Redelivered terminal event — idempotent no-op.
            return;
        }
        order.setStatus(outcome == PaymentOutcome.APPROVED ? OrderStatus.PAID : OrderStatus.PAYMENT_FAILED);
        orderRepository.save(order);
        log.info("Order {} transitioned to {}", orderId, order.getStatus());
    }

    public Order getOrderForOwner(String orderId, String sub) {
        Order order = orderRepository.findByOrderId(orderId);
        if (order == null || !order.getUserId().equals(sub)) {
            throw new com.ecommerce.order.support.OrderNotFoundException();
        }
        return order;
    }

    public List<Order> listForOwner(String sub) {
        return orderRepository.findByUserIdOrderByCreatedAtDesc(sub);
    }
}
