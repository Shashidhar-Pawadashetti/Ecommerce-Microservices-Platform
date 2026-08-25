package com.ecommerce.auth.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.OctetSequenceKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;

/**
 * Unit slice for the signup domain core (D-07 layering): plain JUnit + Mockito
 * against a mocked {@link UserRepository} — no Spring context, no Docker.
 * Wire-level behavior is pinned separately by web.AuthFlowIntegrationTests.
 */
@ExtendWith(MockitoExtension.class)
class UserServiceTests {

    private static final String RAW_PASSWORD = "correct-horse-battery";

    @Mock
    private UserRepository userRepository;

    private PasswordEncoder passwordEncoder;
    private JwtEncoder jwtEncoder;
    private UserService userService;

    @BeforeEach
    void setUp() {
        // Real BCryptPasswordEncoder(12) — same cost factor as the SecurityConfig
        // bean — so the "$2a$" assertion exercises genuine bcrypt output.
        passwordEncoder = new BCryptPasswordEncoder(12);
        // Real HS256 encoder over a local test secret so issueToken() is callable.
        byte[] secretBytes = "unit-slice-signing-secret-32-bytes!!".getBytes(StandardCharsets.UTF_8);
        OctetSequenceKey jwk = new OctetSequenceKey.Builder(secretBytes)
                .algorithm(JWSAlgorithm.HS256).build();
        jwtEncoder = new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(jwk)));
        userService = new UserService(userRepository, passwordEncoder, jwtEncoder,
                "ecommerce-auth", "ecommerce-api", 3600);
    }

    /** Emulates @UuidGenerator persist-time generation on the mocked save(). */
    private User saveThroughUuidGenerator(org.mockito.invocation.InvocationOnMock inv) {
        User u = inv.getArgument(0);
        u.setId(UUID.randomUUID());
        return u;
    }

    @Test
    void signupNormalizesEmailToLowercaseBeforeLookupAndSave() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(this::saveThroughUuidGenerator);

        User saved = userService.signup("Alice@Example.COM", RAW_PASSWORD);

        // Ordering proof: normalization happens BEFORE both the duplicate lookup
        // and the insert — findByEmail must be consulted with the lowercase form.
        InOrder order = inOrder(userRepository);
        order.verify(userRepository).findByEmail("alice@example.com");
        order.verify(userRepository).save(any(User.class));
        assertThat(saved.getEmail()).isEqualTo("alice@example.com");
    }

    @Test
    void signupRaisesConflictSignalWithoutInsertWhenEmailExists() {
        when(userRepository.findByEmail("taken@example.com")).thenReturn(Optional.of(new User()));

        assertThatThrownBy(() -> userService.signup("Taken@Example.com", RAW_PASSWORD))
                .isInstanceOf(UserService.DuplicateEmailException.class);

        // The conflict signal fires WITHOUT attempting an insert — the unique
        // index remains the authoritative race backstop, never a substitute
        // for this fast unit-testable guard.
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void savedEntityCarriesCustomerRolesAppUuidAndCreatedAt() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(this::saveThroughUuidGenerator);

        User saved = userService.signup("carol@example.com", RAW_PASSWORD);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getRoles()).containsExactly("customer");
        assertThat(saved.getCreatedAt()).isNotNull();
    }

    @Test
    void passwordIsStoredOnlyAsBcryptHashNeverPlaintext() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(this::saveThroughUuidGenerator);

        User saved = userService.signup("dave@example.com", RAW_PASSWORD);

        assertThat(saved.getPasswordHash()).startsWith("$2a$");
        assertThat(saved.getPasswordHash()).isNotEqualTo(RAW_PASSWORD);
        assertThat(passwordEncoder.matches(RAW_PASSWORD, saved.getPasswordHash())).isTrue();
    }
}
