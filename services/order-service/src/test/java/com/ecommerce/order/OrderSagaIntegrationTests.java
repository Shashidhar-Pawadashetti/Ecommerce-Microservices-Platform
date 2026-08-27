package com.ecommerce.order;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.ecommerce.order.config.CartClient;
import com.ecommerce.order.domain.IdempotencyRepository;
import com.ecommerce.order.domain.OrderRepository;
import com.ecommerce.order.domain.OrderStatus;
import com.ecommerce.order.test.OrderCreatedCapture;
import com.jayway.jsonpath.JsonPath;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Full saga integration test on EMBEDDED Kafka + Testcontainers PostgreSQL.
 *
 * Proves the whole Phase 5 chain locally without Docker Compose:
 *   POST /orders -> order.created (broker) -> payment.completed (broker)
 *   -> order transitions PENDING_PAYMENT -> PAID | PAYMENT_FAILED.
 * Also asserts ORDR-05 idempotency replay returns the SAME order.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@EmbeddedKafka(partitions = 1, topics = {"order.created", "payment.completed"})
class OrderSagaIntegrationTests {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:18");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.kafka.bootstrap-servers", () -> System.getProperty("spring.embedded.kafka.brokers"));
    }

    @Autowired MockMvc mvc;
    @Autowired KafkaTemplate<String, String> kafkaTemplate;
    @Autowired OrderRepository orderRepository;
    @Autowired IdempotencyRepository idempotencyRepository;
    @MockBean CartClient cartClient;

    @BeforeEach
    void setUp() {
        OrderCreatedCapture.RECORDS.clear();
        when(cartClient.snapshot(anyString(), anyString()))
                .thenReturn(new CartClient.CartView(
                        "user-1",
                        List.of(new CartClient.CartLine("p1", "Widget", 1, 5000, 5000)),
                        5000, "USD", "2026-01-01T00:00:00Z"));
        doNothing().when(cartClient).clear(anyString());
    }

    private String checkout(String idemKey) throws Exception {
        return mvc.perform(post("/orders")
                        .with(jwt().jwt(j -> j.subject("user-1").claim("email", "user-1@example.com")))
                        .header("Idempotency-Key", idemKey))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
    }

    @Test
    void checkoutPublishesOrderCreatedAndReachesPaid() throws Exception {
        String key = "idem-" + UUID.randomUUID();
        String body = checkout(key);
        String orderId = JsonPath.read(body, "$.orderId");
        assertThat(orderId).startsWith("ord-");

        // ORDR-05: idempotency row recorded.
        assertThat(idempotencyRepository.findByKey(key)).isNotNull();

        // First hop actually landed on the broker.
        ConsumerRecord<String, String> rec =
                OrderCreatedCapture.RECORDS.poll(10, TimeUnit.SECONDS);
        assertThat(rec).isNotNull();
        assertThat(rec.key()).isEqualTo(orderId);

        // Simulate payment-service approving the charge.
        String payment = "{\"eventId\":\"e1\",\"orderId\":\"" + orderId
                + "\",\"outcome\":\"APPROVED\",\"processedAt\":\"2026-01-01T00:00:00.000Z\"}";
        kafkaTemplate.send("payment.completed", orderId, payment).get(10, TimeUnit.SECONDS);

        // Second hop: order reaches PAID.
        assertThat(awaitStatus(orderId, OrderStatus.PAID, Duration.ofSeconds(20))).isTrue();
    }

    @Test
    void declinedReachesPaymentFailed() throws Exception {
        String key = "idem-" + UUID.randomUUID();
        String orderId = JsonPath.read(checkout(key), "$.orderId");

        String payment = "{\"eventId\":\"e2\",\"orderId\":\"" + orderId
                + "\",\"outcome\":\"DECLINED\",\"reason\":\"Mock decline\",\"processedAt\":\"2026-01-01T00:00:00.000Z\"}";
        kafkaTemplate.send("payment.completed", orderId, payment).get(10, TimeUnit.SECONDS);

        assertThat(awaitStatus(orderId, OrderStatus.PAYMENT_FAILED, Duration.ofSeconds(20))).isTrue();
    }

    @Test
    void idempotencyReplayReturnsSameOrder() throws Exception {
        String key = "idem-" + UUID.randomUUID();
        String orderId1 = JsonPath.read(checkout(key), "$.orderId");

        // Replay: interceptor short-circuits with 200 + the SAME order snapshot.
        String replay = mvc.perform(post("/orders")
                        .with(jwt().jwt(j -> j.subject("user-1").claim("email", "user-1@example.com")))
                        .header("Idempotency-Key", key))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String orderId2 = JsonPath.read(replay, "$.orderId");

        assertThat(orderId2).isEqualTo(orderId1);
    }

    private boolean awaitStatus(String orderId, OrderStatus expected, Duration timeout)
            throws InterruptedException {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            var order = orderRepository.findByOrderId(orderId);
            if (order != null && order.getStatus() == expected) {
                return true;
            }
            Thread.sleep(200);
        }
        return false;
    }
}
