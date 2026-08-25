package com.ecommerce.auth.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

import com.ecommerce.auth.security.RestAuthenticationEntryPoint;

/**
 * Finalized stateless security chain (AUTH-03).
 *
 * <p>PermitAll is limited to exactly three matchers — the two public auth
 * operations plus the actuator health probe; every other /auth/** route
 * requires a verified bearer token through the JwtDecoder bean (MAC-only,
 * skew/issuer/audience validators), and anything else is denied by default.
 * All authentication failures collapse into RestAuthenticationEntryPoint's
 * single byte-identical 401 envelope.</p>
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
    SecurityFilterChain filterChain(HttpSecurity http,
            RestAuthenticationEntryPoint entryPoint) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // exactly three public matchers, then deny-by-default
                .requestMatchers("/auth/signup", "/auth/login", "/actuator/health").permitAll()
                .requestMatchers("/auth/**").authenticated()
                .anyRequest().denyAll())
            // jwt(withDefaults()) pulls this plan's JwtDecoder bean into the
            // chain; the entry point MUST ride the resource-server customizer —
            // BearerTokenAuthenticationFilter invokes IT directly on decode
            // failures (the generic exceptionHandling entry point never sees them).
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(Customizer.withDefaults())
                .authenticationEntryPoint(entryPoint));
        return http.build();
    }
}
