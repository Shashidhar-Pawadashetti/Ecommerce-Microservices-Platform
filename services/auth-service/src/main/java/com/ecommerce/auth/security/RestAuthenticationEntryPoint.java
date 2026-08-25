package com.ecommerce.auth.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import com.ecommerce.auth.support.ApiError;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Writes the exact _shared.yaml Unauthorized envelope on every filter-chain
 * rejection — missing, malformed, expired, foreign-signed, or wrong-algorithm
 * tokens all collapse into ONE byte-identical 401 body (anti-enumeration and
 * anti-oracle posture, T-02-02). The login failure path reuses
 * {@link #UNAUTHORIZED_ENVELOPE} so no code path can drift from the contract.
 */
@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    /** Single source of the contracted 401 body (exact _shared.yaml example). */
    public static final ApiError UNAUTHORIZED_ENVELOPE =
            new ApiError("UNAUTHORIZED", "Authentication required or credentials invalid.");

    private static final Logger log = LoggerFactory.getLogger(RestAuthenticationEntryPoint.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
            AuthenticationException authException) throws IOException {
        // Internals stay server-side only; the wire carries the static envelope.
        log.debug("Rejected {} {}: {}", request.getMethod(), request.getRequestURI(),
                authException.getMessage());
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        MAPPER.writeValue(response.getOutputStream(), UNAUTHORIZED_ENVELOPE);
    }
}
