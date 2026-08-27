package com.ecommerce.order.web;

import java.net.URI;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.ecommerce.order.domain.Order;
import com.ecommerce.order.domain.OrderService;
import com.ecommerce.order.domain.OrderStatus;
import com.ecommerce.order.kafka.OrderEventProducer;
import com.ecommerce.order.config.CartClient;
import com.ecommerce.order.support.ApiError;
import com.ecommerce.order.support.EmptyCartException;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Order lifecycle endpoints (ORDR-01/05/06/07).
 *
 * <p>POST /orders is idempotent on the caller-supplied Idempotency-Key (ORDR-05):
 * the IdempotencyInterceptor (Wave 2) short-circuits replays with 200 + the
 * original order; for the tracer build the header is read directly. The order is
 * persisted in PENDING_PAYMENT, order.created is published AFTER the commit, and
 * the cart is cleared (ORDR-06).</p>
 */
@RestController
public class OrdersController {

    private static final Logger log = LoggerFactory.getLogger(OrdersController.class);

    private final OrderService orderService;
    private final OrderEventProducer eventProducer;
    private final CartClient cartClient;

    public OrdersController(OrderService orderService, OrderEventProducer eventProducer,
                            CartClient cartClient) {
        this.orderService = orderService;
        this.eventProducer = eventProducer;
        this.cartClient = cartClient;
    }

    @PostMapping("/orders")
    public ResponseEntity<OrderSnapshot> createOrder(HttpServletRequest request,
                                                     Authentication authentication,
                                                     @RequestHeader(value = "Idempotency-Key", required = false) String headerKey) {
        // Wave 2 interceptor binds the validated key as a request attribute; fall
        // back to the raw header for the tracer build.
        String idemKey = (String) request.getAttribute("idemKey");
        if (idemKey == null) {
            idemKey = headerKey;
        }
        String sub = authentication.getName();
        String email = extractEmail(authentication);

        // Transaction commits inside createOrder (order + idempotency row).
        Order order = orderService.createOrder(sub, idemKey, bearer(authentication));

        // Publish order.created ONLY after the commit (ORDR-02 dual-write ordering).
        eventProducer.publishCreated(order, email);

        // Clear the cart after a successful publish (best-effort).
        cartClient.clear(bearer(authentication));

        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(order.getOrderId()).toUri();
        return ResponseEntity.status(HttpStatus.CREATED)
                .location(location)
                .body(OrderSnapshot.from(order));
    }

    @GetMapping("/orders")
    public ResponseEntity<OrderList> listOrders(Authentication authentication) {
        String sub = authentication.getName();
        var orders = orderService.listForOwner(sub).stream().map(OrderSummary::from).toList();
        return ResponseEntity.ok(new OrderList(orders, orders.size()));
    }

    @GetMapping("/orders/{id}")
    public ResponseEntity<OrderSnapshot> getOrder(@PathVariable("id") String orderId,
                                                 Authentication authentication) {
        String sub = authentication.getName();
        // OrderNotFoundException (unknown OR other-owner) -> 404 via handler (no leak).
        Order order = orderService.getOrderForOwner(orderId, sub);
        return ResponseEntity.ok(OrderSnapshot.from(order));
    }

    private static String extractEmail(Authentication authentication) {
        if (authentication.getPrincipal() instanceof Jwt jwt) {
            return jwt.getClaimAsString("email");
        }
        return null;
    }

    private static String bearer(Authentication authentication) {
        if (authentication.getPrincipal() instanceof Jwt jwt) {
            return "Bearer " + jwt.getTokenValue();
        }
        return null;
    }
}
