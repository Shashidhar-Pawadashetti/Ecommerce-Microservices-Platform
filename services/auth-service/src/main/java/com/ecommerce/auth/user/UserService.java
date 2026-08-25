package com.ecommerce.auth.user;

import java.time.Instant;
import java.util.Locale;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Signup slice of the user domain (login/profileOf/issueToken land in
 * Plan 02-03). Takes (email, password) primitives deliberately — DTO records
 * are owned by the web layer, keeping this core wire-shape agnostic.
 *
 * <p>Duplicate detection is two-layered and race-safe: {@link #signup} consults
 * {@link UserRepository#findByEmail(String)} for a fast, unit-testable conflict
 * signal ({@link DuplicateEmailException}) while the users_email_uniq unique
 * index remains the authoritative backstop — a lost race surfaces as a
 * DataIntegrityViolationException translated by the web layer to the same 409
 * envelope. Pre-check-then-insert is never the sole guard.</p>
 */
@Service
public class UserService {

    /** Fast-path duplicate signal; mapped to 409 DUPLICATE_EMAIL by the web layer. */
    public static class DuplicateEmailException extends RuntimeException {

        public DuplicateEmailException(String email) {
            super("Email already registered: " + email);
        }
    }

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
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
}
