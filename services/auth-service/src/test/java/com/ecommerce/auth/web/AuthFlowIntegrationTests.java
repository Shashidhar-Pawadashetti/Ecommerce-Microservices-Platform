package com.ecommerce.auth.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.equalTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.ecommerce.auth.user.UserRepository;

/**
 * AUTH-01 integration proof on the real SQL dialect (D-07): ephemeral
 * postgres:18 via Testcontainers + @ServiceConnection, Flyway V1 applied,
 * ddl-auto=validate guarding entity/schema drift. Exercises the signup wire
 * contract end-to-end through MockMvc including the security filter chain.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class AuthFlowIntegrationTests {

    /** Exact _shared.yaml Conflict response example (byte-match asserted). */
    private static final String DUPLICATE_BODY =
            "{\"code\":\"DUPLICATE_EMAIL\",\"message\":\"An account with this email already exists.\"}";

    /** Exact _shared.yaml ValidationError response example (byte-match asserted). */
    private static final String VALIDATION_BODY =
            "{\"code\":\"VALIDATION_FAILED\",\"message\":\"Request validation failed. Check field formats and limits.\"}";

    private static final String PASSWORD = "correct-horse-battery";

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:18");

    @Autowired
    MockMvc mockMvc;

    @Autowired
    UserRepository userRepository;

    @BeforeEach
    void cleanUsers() {
        userRepository.deleteAll();
    }

    private ResultActions signup(String email, String password) throws Exception {
        String body = "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
        return mockMvc.perform(post("/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    @Test
    void validSignupReturns201WithContractUserShape() throws Exception {
        String body = signup("Alice.Example@Example.COM", PASSWORD)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("alice.example@example.com"))
                .andExpect(jsonPath("$.roles").value(contains("customer")))
                .andReturn().getResponse().getContentAsString();

        // id is a UUID string on the wire (interop Rule 3)
        assertThat(UUID.fromString(com.jayway.jsonpath.JsonPath.read(body, "$.id"))).isNotNull();
        // createdAt obeys the interop Rule 1 millisecond law (Pitfall 3 guard)
        String createdAt = com.jayway.jsonpath.JsonPath.read(body, "$.createdAt");
        assertThat(createdAt).matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z");
    }

    @Test
    void duplicateEmailReturnsExact409ConflictEnvelope() throws Exception {
        signup("dup@example.com", PASSWORD).andExpect(status().isCreated());

        signup("DUP@example.com", PASSWORD)
                .andExpect(status().isConflict())
                .andExpect(content().string(equalTo(DUPLICATE_BODY)));
    }

    @Test
    void malformedEmailReturnsExact400ValidationEnvelope() throws Exception {
        signup("not-an-email", PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(content().string(equalTo(VALIDATION_BODY)));
    }

    @Test
    void shortPasswordReturnsExact400ValidationEnvelope() throws Exception {
        signup("ok@example.com", "short")
                .andExpect(status().isBadRequest())
                .andExpect(content().string(equalTo(VALIDATION_BODY)));
    }

    @Test
    void storedCredentialIsBcryptHashNeverPlaintext() throws Exception {
        signup("hashcheck@example.com", PASSWORD).andExpect(status().isCreated());

        var stored = userRepository.findByEmail("hashcheck@example.com").orElseThrow();
        assertThat(stored.getPasswordHash()).startsWith("$2a$");
        assertThat(stored.getPasswordHash()).isNotEqualTo(PASSWORD);
    }
}
