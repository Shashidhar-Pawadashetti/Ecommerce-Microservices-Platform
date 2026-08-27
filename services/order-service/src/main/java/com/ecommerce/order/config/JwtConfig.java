package com.ecommerce.order.config;

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
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.OctetSequenceKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;

/**
 * HS256 token plane (D-JWT, frozen contract): the SAME base64-decoded secret
 * feeds both directions. order-service is a JWT holder in Phase 5 (deviation
 * A3) — it only VERIFIES inbound tokens to derive {@code sub} for ownership.
 * See docs/runbook.md "Phase 5 deviations (DOCS-02)".
 */
@Configuration
class JwtConfig {

    @Bean
    JwtEncoder jwtEncoder(@Value("${jwt.secret}") String base64Secret) {
        byte[] secretBytes = Base64.getDecoder().decode(base64Secret);
        OctetSequenceKey jwk = new OctetSequenceKey.Builder(secretBytes)
                .algorithm(JWSAlgorithm.HS256)
                .build();
        return new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(jwk)));
    }

    @Bean
    JwtDecoder jwtDecoder(@Value("${jwt.secret}") String base64Secret,
                          @Value("${jwt.issuer}") String issuer,
                          @Value("${jwt.audience}") String audience) {
        SecretKey key = new SecretKeySpec(Base64.getDecoder().decode(base64Secret), "HMACSHA256");
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).build();

        OAuth2TokenValidator<Jwt> skew = new JwtTimestampValidator(Duration.ofSeconds(60));
        OAuth2TokenValidator<Jwt> issuerValidator = JwtValidators.createDefaultWithIssuer(issuer);
        OAuth2TokenValidator<Jwt> audienceValidator =
                new JwtClaimValidator<>(JwtClaimNames.AUD,
                        aud -> aud != null && asAudList(aud).contains(audience));

        decoder.setJwtValidator(
                new DelegatingOAuth2TokenValidator<>(skew, issuerValidator, audienceValidator));
        return decoder;
    }

    /** RFC 7519 allows aud as a single string or an array — normalize both. */
    private static List<String> asAudList(Object aud) {
        if (aud instanceof List<?> audiences) {
            return audiences.stream().map(String::valueOf).toList();
        }
        return List.of(String.valueOf(aud));
    }
}
