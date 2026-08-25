package com.ecommerce.auth.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request body for POST /auth/signup — mirrors contract schema EmailPassword.
 *
 * <p>Deliberately two fields only: identity, roles, and timestamps are
 * server-assigned, so request bodies can never mass-assign them
 * (threat register T-02-mass).</p>
 */
public record SignupRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(min = 8) String password) {
}
