package com.ecommerce.auth.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request body for POST /auth/login — mirrors contract schema EmailPassword
 * (same shape as SignupRequest: exactly two fields, nothing else bindable).
 */
public record LoginRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(min = 8) String password) {
}
