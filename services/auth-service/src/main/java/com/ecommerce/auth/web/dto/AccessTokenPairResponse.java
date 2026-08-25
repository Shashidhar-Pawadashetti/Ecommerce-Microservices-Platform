package com.ecommerce.auth.web.dto;

/**
 * Wire shape of POST /auth/login 200 — mirrors contract schema AccessTokenPair:
 * the HS256 access token plus the SAME User object GET /auth/me returns.
 */
public record AccessTokenPairResponse(String accessToken, UserResponse user) {
}
