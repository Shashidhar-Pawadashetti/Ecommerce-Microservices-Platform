package com.ecommerce.auth.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.equalTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
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

    /** Exact _shared.yaml Unauthorized response example (byte-match asserted). */
    private static final String UNAUTHORIZED_BODY =
            "{\"code\":\"UNAUTHORIZED\",\"message\":\"Authentication required or credentials invalid.\"}";

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

    private ResultActions login(String email, String password) throws Exception {
        String body = "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
        return mockMvc.perform(post("/auth/login")
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

    // ── AUTH-02: login + HS256 issuance ─────────────────────────────────

    @Test
    void loginReturnsThreeSegmentHs256TokenWithCanonicalClaims() throws Exception {
        signup("login.claims@example.com", PASSWORD).andExpect(status().isCreated());

        String body = login("login.claims@example.com", PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.user.email").value("login.claims@example.com"))
                .andExpect(jsonPath("$.user.roles").value(contains("customer")))
                .andReturn().getResponse().getContentAsString();

        String token = com.jayway.jsonpath.JsonPath.read(body, "$.accessToken");
        String[] segments = token.split("\\.");
        assertThat(segments).as("JWT must have three dot-separated segments").hasSize(3);

        java.util.Base64.Decoder url64 = java.util.Base64.getUrlDecoder();
        String headerJson = new String(url64.decode(segments[0]), java.nio.charset.StandardCharsets.UTF_8);
        String payloadJson = new String(url64.decode(segments[1]), java.nio.charset.StandardCharsets.UTF_8);

        // Algorithm pinned by name on the issue side (D-JWT / json-interop table)
        assertThat((String) com.jayway.jsonpath.JsonPath.read(headerJson, "$.alg")).isEqualTo("HS256");

        // sub == user id string (interop Rule 3); iss/aud literals per canonical table
        String userId = com.jayway.jsonpath.JsonPath.read(body, "$.user.id");
        UUID.fromString(userId); // id is a UUID string on the wire
        assertThat((String) com.jayway.jsonpath.JsonPath.read(payloadJson, "$.sub")).isEqualTo(userId);
        assertThat((String) com.jayway.jsonpath.JsonPath.read(payloadJson, "$.iss")).isEqualTo("ecommerce-auth");
        Object aud = com.jayway.jsonpath.JsonPath.read(payloadJson, "$.aud");
        if (aud instanceof List<?> audiences) {
            assertThat(audiences).asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.list(Object.class))
                    .contains("ecommerce-api");
        } else {
            assertThat(aud).isEqualTo("ecommerce-api");
        }

        // TTL law: exp - iat == 3600 epoch seconds (RFC 7519 numeric dates)
        long iat = ((Number) com.jayway.jsonpath.JsonPath.read(payloadJson, "$.iat")).longValue();
        long exp = ((Number) com.jayway.jsonpath.JsonPath.read(payloadJson, "$.exp")).longValue();
        assertThat(exp - iat).isEqualTo(3600L);
    }

    @Test
    void wrongPasswordAndUnknownEmailReturnByteIdentical401Envelopes() throws Exception {
        signup("enum@example.com", PASSWORD).andExpect(status().isCreated());

        String wrongPasswordBody = login("enum@example.com", "definitely-not-the-password")
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        String unknownEmailBody = login("ghost@example.com", PASSWORD)
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        // Anti-enumeration (T-02-02): both failure modes leak NOTHING about
        // account existence — full JSON bodies are byte-identical to each other
        // and to the _shared.yaml Unauthorized example.
        assertThat(wrongPasswordBody).isEqualTo(UNAUTHORIZED_BODY);
        assertThat(unknownEmailBody).isEqualTo(wrongPasswordBody);
    }

    @Test
    void weakSecretRefusesBootViaStartupAssertion() {
        // 13 decoded bytes < 32-byte law: JwtSecretAssertion must abort boot.
        String shortSecret = java.util.Base64.getEncoder()
                .encodeToString("under-32-bytes".getBytes(java.nio.charset.StandardCharsets.UTF_8));

        assertThatThrownBy(() -> new org.springframework.boot.builder.SpringApplicationBuilder(
                        com.ecommerce.auth.AuthServiceApplication.class)
                .run(
                        // command-line args outrank application.yml (its
                        // localhost datasource default would otherwise win)
                        "--spring.datasource.url=" + postgres.getJdbcUrl(),
                        "--spring.datasource.username=" + postgres.getUsername(),
                        "--spring.datasource.password=" + postgres.getPassword(),
                        "--server.port=0",
                        "--jwt.secret=" + shortSecret))
                .isInstanceOf(IllegalStateException.class)
                .hasStackTraceContaining("jwt.secret too short");
    }
}
