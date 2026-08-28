package com.ecommerce.gateway.config;

import java.time.Duration;
import java.util.Base64;
import java.util.List;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;

@Configuration
public class JwtConfig {

    @Bean
    public ReactiveJwtDecoder jwtDecoder(@Value("${jwt.secret}") String base64Secret,
                                         @Value("${jwt.issuer}") String issuer,
                                         @Value("${jwt.audience}") String audience) {
        SecretKey key = new SecretKeySpec(Base64.getDecoder().decode(base64Secret), "HMACSHA256");
        
        NimbusReactiveJwtDecoder decoder = NimbusReactiveJwtDecoder.withSecretKey(key).build();

        OAuth2TokenValidator<Jwt> skew = new JwtTimestampValidator(Duration.ofSeconds(60));
        OAuth2TokenValidator<Jwt> issuerValidator = JwtValidators.createDefaultWithIssuer(issuer);
        OAuth2TokenValidator<Jwt> audienceValidator =
                new JwtClaimValidator<>(JwtClaimNames.AUD,
                        aud -> aud != null && asAudList(aud).contains(audience));

        decoder.setJwtValidator(
                new DelegatingOAuth2TokenValidator<>(skew, issuerValidator, audienceValidator));
        
        return decoder;
    }

    private static List<String> asAudList(Object aud) {
        if (aud instanceof List<?> audiences) {
            return audiences.stream().map(String::valueOf).toList();
        }
        return List.of(String.valueOf(aud));
    }
}
