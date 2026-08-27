package com.ecommerce.order.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

import com.ecommerce.order.security.RestAuthenticationEntryPoint;

import jakarta.servlet.DispatcherType;

/**
 * Stateless security chain for order-service. order-service stores NO passwords,
 * so the PasswordEncoder bean is intentionally omitted (unlike auth-service).
 *
 * <p>PermitAll is limited to the ERROR dispatch + the actuator health probe;
 * every /orders/** route requires a verified bearer token through the JwtDecoder
 * bean, and anything else is denied by default.</p>
 */
@Configuration
class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http,
            RestAuthenticationEntryPoint entryPoint) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                .requestMatchers("/actuator/health", "/health").permitAll()
                .requestMatchers("/orders/**").authenticated()
                .anyRequest().denyAll())
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(Customizer.withDefaults())
                .authenticationEntryPoint(entryPoint));
        return http.build();
    }
}
