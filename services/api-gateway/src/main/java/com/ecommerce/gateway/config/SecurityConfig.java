package com.ecommerce.gateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;

@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Bean
    public SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http) {
        http
            .csrf(ServerHttpSecurity.CsrfSpec::disable)
            .authorizeExchange(exchanges -> exchanges
                // Public paths (GTWY-03)
                .pathMatchers("/auth/**").permitAll()
                .pathMatchers(HttpMethod.GET, "/catalog/**").permitAll()
                .pathMatchers("/actuator/**").permitAll()
                // Protected paths (GTWY-02)
                .pathMatchers("/cart/**").authenticated()
                .pathMatchers("/orders/**").authenticated()
                .pathMatchers(HttpMethod.POST, "/catalog/**").authenticated()
                .pathMatchers(HttpMethod.PUT, "/catalog/**").authenticated()
                .pathMatchers(HttpMethod.DELETE, "/catalog/**").authenticated()
                // Any other paths require authentication
                .anyExchange().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));
        
        return http.build();
    }
}
