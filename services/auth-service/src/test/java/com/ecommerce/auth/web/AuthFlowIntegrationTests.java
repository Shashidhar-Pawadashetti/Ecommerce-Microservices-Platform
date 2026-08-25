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
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.OctetSequenceKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;

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

    @Autowired
    org.springframework.security.oauth2.jwt.JwtEncoder jwtEncoder;

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

    // ── AUTH-03: authenticated /me + hardened stateless chain ───────────

    /** Issues a fully-valid token via the app's own encoder with a chosen subject. */
    private String encodeValidToken(String subject) {
        java.time.Instant now = java.time.Instant.now();
        org.springframework.security.oauth2.jwt.JwtClaimsSet claims =
                org.springframework.security.oauth2.jwt.JwtClaimsSet.builder()
                        .issuer("ecommerce-auth")
                        .audience(List.of("ecommerce-api"))
                        .issuedAt(now)
                        .expiresAt(now.plusSeconds(3600))
                        .subject(subject)
                        .claim("email", "crafted@example.com")
                        .claim("roles", List.of("customer"))
                        .build();
        return jwtEncoder.encode(org.springframework.security.oauth2.jwt.JwtEncoderParameters.from(
                org.springframework.security.oauth2.jwt.JwsHeader.with(
                        org.springframework.security.oauth2.jose.jws.MacAlgorithm.HS256).build(),
                claims)).getTokenValue();
    }

    private ResultActions me(String bearerHeaderValue) throws Exception {
        var request = get("/auth/me");
        if (bearerHeaderValue != null) {
            request = request.header(org.springframework.http.HttpHeaders.AUTHORIZATION, bearerHeaderValue);
        }
        return mockMvc.perform(request);
    }

    private String loginAndGetTokenAndUser(String email) throws Exception {
        String body = login(email, PASSWORD)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return body;
    }

    @Test
    void meWithFreshBearerTokenReturnsSameUserShapeAsLogin() throws Exception {
        signup("me.happy@example.com", PASSWORD).andExpect(status().isCreated());
        String loginBody = loginAndGetTokenAndUser("me.happy@example.com");
        String token = com.jayway.jsonpath.JsonPath.read(loginBody, "$.accessToken");
        String userId = com.jayway.jsonpath.JsonPath.read(loginBody, "$.user.id");
        Object createdAt = com.jayway.jsonpath.JsonPath.read(loginBody, "$.user.createdAt");

        me("Bearer " + token)
                .andExpect(status().isOk())
                // /me must return the SAME user object the login response carried
                .andExpect(jsonPath("$.id").value(equalTo(userId)))
                .andExpect(jsonPath("$.email").value("me.happy@example.com"))
                .andExpect(jsonPath("$.roles").value(contains("customer")))
                .andExpect(jsonPath("$.createdAt").value(equalTo(createdAt)));
    }

    @Test
    void meWithoutAuthorizationHeaderReturnsExact401Envelope() throws Exception {
        me(null)
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(equalTo(UNAUTHORIZED_BODY)));
    }

    @Test
    void meWithGarbageBearerReturnsExact401Envelope() throws Exception {
        me("Bearer this.is.garbage")
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(equalTo(UNAUTHORIZED_BODY)));
    }

    @Test
    void meWithForeignSignedTokenReturns401() throws Exception {
        signup("me.foreign@example.com", PASSWORD).andExpect(status().isCreated());
        String userId = userRepository.findByEmail("me.foreign@example.com").orElseThrow()
                .getId().toString();

        // Same claims, different signing secret -> signature validation fails.
        byte[] foreignBytes = "foreign-signing-secret-with-32-bytes-min"
                .getBytes(java.nio.charset.StandardCharsets.UTF_8);
        org.springframework.security.oauth2.jwt.NimbusJwtEncoder foreignEncoder =
                new org.springframework.security.oauth2.jwt.NimbusJwtEncoder(
                        new ImmutableJWKSet<>(new JWKSet(new OctetSequenceKey.Builder(foreignBytes)
                                .algorithm(JWSAlgorithm.HS256).build())));
        java.time.Instant now = java.time.Instant.now();
        String forged = foreignEncoder.encode(
                org.springframework.security.oauth2.jwt.JwtEncoderParameters.from(
                        org.springframework.security.oauth2.jwt.JwsHeader.with(
                                org.springframework.security.oauth2.jose.jws.MacAlgorithm.HS256).build(),
                        org.springframework.security.oauth2.jwt.JwtClaimsSet.builder()
                                .issuer("ecommerce-auth").audience(List.of("ecommerce-api"))
                                .issuedAt(now).expiresAt(now.plusSeconds(3600))
                                .subject(userId).claim("email", "me.foreign@example.com")
                                .claim("roles", List.of("customer")).build()))
                .getTokenValue();

        me("Bearer " + forged)
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(equalTo(UNAUTHORIZED_BODY)));
    }

    @Test
    void meWithExpiredToken61SecondsPastSkewReturns401() throws Exception {
        signup("me.expired@example.com", PASSWORD).andExpect(status().isCreated());
        String userId = userRepository.findByEmail("me.expired@example.com").orElseThrow()
                .getId().toString();

        // Correctly signed, correct iss/aud — ONLY expiry fails. exp sits 61s
        // in the past: one second past the ±60s skew window (boundary proof).
        java.time.Instant now = java.time.Instant.now();
        String expired = jwtEncoder.encode(
                org.springframework.security.oauth2.jwt.JwtEncoderParameters.from(
                        org.springframework.security.oauth2.jwt.JwsHeader.with(
                                org.springframework.security.oauth2.jose.jws.MacAlgorithm.HS256).build(),
                        org.springframework.security.oauth2.jwt.JwtClaimsSet.builder()
                                .issuer("ecommerce-auth").audience(List.of("ecommerce-api"))
                                .issuedAt(now.minusSeconds(3661)).expiresAt(now.minusSeconds(61))
                                .subject(userId).claim("email", "me.expired@example.com")
                                .claim("roles", List.of("customer")).build()))
                .getTokenValue();

        me("Bearer " + expired)
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(equalTo(UNAUTHORIZED_BODY)));
    }

    @Test
    void meWithNonHs256OrUnsignedTokenReturns401() throws Exception {
        signup("me.algswap@example.com", PASSWORD).andExpect(status().isCreated());
        String userId = userRepository.findByEmail("me.algswap@example.com").orElseThrow()
                .getId().toString();

        // RS256-signed with valid claims: the MAC-restricted decoder must
        // reject the algorithm swap before any claim is honored.
        java.security.KeyPairGenerator keyGen = java.security.KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(2048);
        java.security.KeyPair keyPair = keyGen.generateKeyPair();
        java.util.Date now = java.util.Date.from(java.time.Instant.now());
        com.nimbusds.jose.crypto.RSASSASigner rsaSigner =
                new com.nimbusds.jose.crypto.RSASSASigner((java.security.interfaces.RSAPrivateKey) keyPair.getPrivate());
        com.nimbusds.jwt.SignedJWT swapped = new com.nimbusds.jwt.SignedJWT(
                new com.nimbusds.jose.JWSHeader.Builder(JWSAlgorithm.RS256).build(),
                new com.nimbusds.jwt.JWTClaimsSet.Builder()
                        .subject(userId).issueTime(now)
                        .expirationTime(new java.util.Date(now.getTime() + 3_600_000L))
                        .issuer("ecommerce-auth").audience("ecommerce-api").build());
        swapped.sign(rsaSigner);

        // Unsigned variant (alg=none): two segments, no signature at all.
        com.nimbusds.jwt.PlainJWT plain = new com.nimbusds.jwt.PlainJWT(
                new com.nimbusds.jwt.JWTClaimsSet.Builder()
                        .subject(userId).issueTime(now)
                        .expirationTime(new java.util.Date(now.getTime() + 3_600_000L)).build());

        for (String forged : new String[] { swapped.serialize(), plain.serialize() }) {
            me("Bearer " + forged)
                    .andExpect(status().isUnauthorized())
                    .andExpect(content().string(equalTo(UNAUTHORIZED_BODY)));
        }
    }

    @Test
    void meWithTokenWhoseSubjectHasNoUserRowReturns401Not404() throws Exception {
        // Fully valid signature/claims — but sub references no persisted row.
        // Contract exposes only 200/401 for getMe; identity simply cannot be
        // established server-side.
        String ghostToken = encodeValidToken(UUID.randomUUID().toString());

        me("Bearer " + ghostToken)
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(equalTo(UNAUTHORIZED_BODY)));
    }
}
