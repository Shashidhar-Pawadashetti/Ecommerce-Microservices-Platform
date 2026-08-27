package com.ecommerce.order.config;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.ecommerce.order.support.EmptyCartException;
import com.ecommerce.order.support.CartServiceException;

/**
 * HTTP client to cart-service (Phase 4 edges). order-service forwards the
 * caller's Authorization header VERBATIM and never synthesizes a userId — the
 * cart-service derives sub from the token (RESEARCH Pattern 3). An empty cart
 * surfaces as a 404 from the internal read, which we translate to
 * EmptyCartException (checkout rejects it as VALIDATION_FAILED).
 */
@Component
public class CartClient {

    private final WebClient webClient;

    public CartClient(@Value("${app.cart-service-url}") String baseUrl) {
        this.webClient = WebClient.builder().baseUrl(baseUrl).build();
    }

    /** Snapshot the caller's priced cart (GET /cart/{userId}). */
    public CartView snapshot(String userId, String authHeader) {
        try {
            return webClient.get()
                    .uri("/cart/{userId}", userId)
                    .header(HttpHeaders.AUTHORIZATION, authHeader)
                    .retrieve()
                    .bodyToMono(CartView.class)
                    .block();
        } catch (WebClientResponseException e) {
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
                throw new EmptyCartException();
            }
            throw new CartServiceException("cart snapshot failed: " + e.getStatusCode());
        }
    }

    /**
     * Clear the caller's cart (DELETE /cart), forwarding the bearer token.
     * A non-2xx clear is NON-FATAL: the saga already completed, so we log and
     * continue rather than failing the order (ORDR-06).
     */
    public void clear(String authHeader) {
        try {
            webClient.delete()
                    .uri("/cart")
                    .header(HttpHeaders.AUTHORIZATION, authHeader)
                    .retrieve()
                    .toBodilessEntity()
                    .block();
        } catch (WebClientResponseException e) {
            // Non-fatal: the order is already placed; cart clear is best-effort.
            org.slf4j.LoggerFactory.getLogger(CartClient.class)
                    .warn("Cart clear returned {} (best-effort, ignored)", e.getStatusCode());
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(CartClient.class)
                    .warn("Cart clear failed (best-effort, ignored): {}", e.getMessage());
        }
    }

    /** Cart snapshot wire shape (matches cart-service buildCartView). */
    public record CartLine(String productId, String name, int quantity, int unitPriceCents, int lineTotalCents) {
    }

    public record CartView(String userId, List<CartLine> items, int grandTotalCents, String currency,
                           String updatedAt) {
    }
}
