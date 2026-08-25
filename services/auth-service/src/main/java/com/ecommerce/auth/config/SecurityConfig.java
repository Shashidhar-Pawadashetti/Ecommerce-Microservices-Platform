package com.ecommerce.auth.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Minimal security chain for the Phase 2 signup slice.
 *
 * <p>Permits the actuator health endpoint (compose healthcheck) and denies
 * everything else — no auth endpoints exist yet. The resource-server starter on
 * the classpath is inert without a customizer; JWT configuration
 * (oauth2ResourceServer().jwt()) lands with Plan 02-03 Tasks 1-2, alongside the
 * remaining permitAll entries.</p>
 *
 * <p>Also declares the credential-hashing bean: plain BCryptPasswordEncoder(12)
 * (discretion decision Q3) so the stored column stays tool-portable raw bcrypt
 * ("$2a$…") with no framework prefix. Cost 12 per flagged assumption A3.</p>
 */
@Configuration
class SecurityConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health").permitAll()
                .anyRequest().denyAll());
        return http.build();
    }
}
