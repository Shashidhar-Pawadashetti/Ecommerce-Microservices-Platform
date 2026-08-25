package com.ecommerce.auth.user;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/**
 * Registered account (users table — Flyway V1__create_users.sql owns the DDL;
 * ddl-auto=validate fails boot on any drift).
 *
 * <p>Identity/timestamps are server-assigned, never client-supplied:
 * id is app-generated (UUID v4 via {@link UuidGenerator}, D-05), roles always
 * start at ["customer"] (D-06), createdAt is set on first persist. The
 * password field holds ONLY bcrypt hash material ("$2a$…") — plaintext never
 * touches this column (AUTH-01).</p>
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @UuidGenerator // RANDOM style default: RFC 4122 v4, generated app-side (D-05)
    private UUID id;

    @Column(nullable = false) // uniqueness enforced by the users_email_uniq index
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    /** Native Postgres text[] per D-06; v1 populates exactly ["customer"]. */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false, columnDefinition = "text[]")
    private List<String> roles = new ArrayList<>(List.of("customer"));

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public User() {
    }

    /** Last-resort guard so a persist can never emit NULL against the NOT NULL column. */
    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public List<String> getRoles() {
        return roles;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
