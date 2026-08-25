package com.ecommerce.auth.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Minimal security chain for the Phase 2 skeleton slice ONLY.
 *
 * <p>Permits the actuator health endpoint (compose healthcheck) and denies
 * everything else — no auth endpoints exist yet. The resource-server starter on
 * the classpath is inert without a customizer; JWT configuration
 * (oauth2ResourceServer().jwt()) lands with Plan 02-03 Tasks 1-2, alongside the
 * permitAll entries for /auth/signup and /auth/login.</p>
 */
@Configuration
class SecurityConfig {

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
