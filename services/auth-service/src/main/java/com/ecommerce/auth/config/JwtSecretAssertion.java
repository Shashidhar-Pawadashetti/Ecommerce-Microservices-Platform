package com.ecommerce.auth.config;

import java.util.Base64;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Fail-fast secret gate (docs/json-interop.md §Secret Handling items 1, 3, 4):
 * refuses boot when jwt.secret decodes to fewer than 32 bytes (256 bits) and
 * logs the secret's LENGTH ONLY — the value itself must never appear in logs,
 * error messages, or diagnostics.
 */
@Component
class JwtSecretAssertion implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(JwtSecretAssertion.class);

    private final String base64Secret;

    JwtSecretAssertion(@Value("${jwt.secret}") String base64Secret) {
        this.base64Secret = base64Secret;
    }

    @Override
    public void run(ApplicationArguments args) {
        int decodedBytes;
        try {
            decodedBytes = Base64.getDecoder().decode(base64Secret).length;
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("jwt.secret is not valid base64; refusing to start", ex);
        }
        if (decodedBytes < 32) {
            throw new IllegalStateException(
                    "jwt.secret too short: " + decodedBytes + " bytes decoded; minimum 32");
        }
        // Length only — never content (interop law item 4).
        log.info("JWT signing secret present ({} decoded bytes)", decodedBytes);
    }
}
