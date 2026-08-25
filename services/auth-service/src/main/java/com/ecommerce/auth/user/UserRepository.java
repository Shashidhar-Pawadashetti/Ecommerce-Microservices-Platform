package com.ecommerce.auth.user;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Spring Data repository over the Flyway-managed users table. Duplicate-email
 * truth lives in the users_email_uniq unique index; findByEmail exists only as
 * the fast conflict signal (and later, login lookup) — never as the sole
 * duplicate guard.
 */
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);
}
