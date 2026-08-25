package com.ecommerce.auth.user;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/**
 * User domain core: signup (Plan 02-02) plus the credential-exchange and
 * token-issuance slice (Plan 03). Takes (email, password) primitives
 * deliberately — DTO records are owned by the web layer, keeping this core
 * wire-shape agnostic.
 *
 * <p>Duplicate detection is two-layered and race-safe: {@link #signup} consults
 * {@link UserRepository#findByEmail(String)} for a fast, unit-testable conflict
 * signal ({@link DuplicateEmailException}) while the users_email_uniq unique
 * index remains the authoritative backstop — a lost race surfaces as a
 * DataIntegrityViolationException translated by the web layer to the same 409
 * envelope. Pre-check-then-insert is never the sole guard.</p>
 *
 * <p>Login is anti-enumeration (T-02-02): unknown emails burn the same bcrypt
 * work as real compares against an instance-generated dummy hash, and both
 * failure modes return an empty result the web layer renders as ONE identical
 * 401 envelope. Secret/token material never reaches log statements here.</p>
 */
@Service
public class UserService {

    /** Fast-path duplicate signal; mapped to 409 DUPLICATE_EMAIL by the web layer. */
    public static class DuplicateEmailException extends RuntimeException {

        public DuplicateEmailException(String email) {
            super("Email already registered: " + email);
        }
    }

    /** Successful credential exchange: the persisted user plus its fresh HS256 token. */
    public record Session(User user, String accessToken) {
    }

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;
    private final String jwtIssuer;
    private final String jwtAudience;
    private final long jwtTtlSeconds;

    /**
     * Fixed dummy hash burned on unknown-email logins so timing profiles match
     * the known-account path (Pitfall 4). Generated once through the SAME
     * encoder bean (cost factor included), guaranteeing format validity.
     */
    private final String dummyBcryptHash;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder,
            JwtEncoder jwtEncoder,
            @Value("${jwt.issuer}") String jwtIssuer,
            @Value("${jwt.audience}") String jwtAudience,
            @Value("${jwt.ttl-seconds}") long jwtTtlSeconds) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtEncoder = jwtEncoder;
        this.jwtIssuer = jwtIssuer;
        this.jwtAudience = jwtAudience;
        this.jwtTtlSeconds = jwtTtlSeconds;
        this.dummyBcryptHash = passwordEncoder.encode("timing-equalizer-dummy-credential");
    }

    /**
     * Registers a new account: normalizes the email to lowercase, encodes the
     * password through the BCryptPasswordEncoder(12) bean (plaintext never
     * reaches the entity field), stamps createdAt, then persists with
     * app-generated UUID identity (D-05) and roles ["customer"] (D-06).
     */
    public User signup(String email, String password) {
        String normalized = email.toLowerCase(Locale.ROOT);
        userRepository.findByEmail(normalized)
                .ifPresent(existing -> {
                    throw new DuplicateEmailException(normalized);
                });

        User user = new User();
        user.setEmail(normalized);
        // Credential material enters the entity ONLY as bcrypt output.
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setCreatedAt(Instant.now());
        return userRepository.save(user);
    }

    /**
     * Verifies credentials and issues an access token. Empty for BOTH
     * wrong-password and unknown-email (after burning an equal-cost compare),
     * so callers emit byte-identical failures — never reveal whether the
     * address exists.
     */
    public Optional<Session> login(String email, String password) {
        String normalized = email.toLowerCase(Locale.ROOT);
        Optional<User> found = userRepository.findByEmail(normalized);
        if (found.isEmpty()) {
            // Equal-cost dummy compare keeps unknown accounts time-indistinguishable.
            passwordEncoder.matches(password, dummyBcryptHash);
            return Optional.empty();
        }
        User user = found.get();
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            return Optional.empty();
        }
        return Optional.of(new Session(user, issueToken(user)));
    }

    /**
     * Issues an HS256 token per the canonical claims table
     * (docs/json-interop.md): sub = user id string, email, roles, iss/aud from
     * properties, iat now, exp now+ttl. The JOSE header is PINNED to HS256 —
     * omitting it lets encoder defaults pick RSA and fail against the
     * symmetric JWK source (flagged assumption A1 / Pitfall 2).
     */
    public String issueToken(User user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(jwtIssuer)
                .audience(List.of(jwtAudience))
                .issuedAt(now)
                .expiresAt(now.plusSeconds(jwtTtlSeconds))
                .subject(user.getId().toString())
                .claim("email", user.getEmail())
                .claim("roles", user.getRoles())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    /**
     * Server-side profile resolution for GET /auth/me: identity derives
     * EXCLUSIVELY from the verified sub claim (never a request body). Empty
     * when the subject row is gone — the web layer renders that as the shared
     * 401 envelope, since the contract exposes only 200/401 for this operation.
     */
    public Optional<User> profileOf(UUID id) {
        return userRepository.findById(id);
    }
}
