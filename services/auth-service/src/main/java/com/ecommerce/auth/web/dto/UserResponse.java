package com.ecommerce.auth.web.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.ecommerce.auth.user.User;
import com.fasterxml.jackson.annotation.JsonFormat;

/**
 * Wire shape of a user profile — mirrors contract schema User. The id is a
 * UUID rendered as a string (interop Rule 3); createdAt carries an explicit
 * millisecond-Z format so serialization always matches the interop Rule 1
 * canonical form "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'" regardless of fractional
 * precision in the stored Instant (research Pitfall 3 guard).
 */
public record UserResponse(
        UUID id,
        String email,
        List<String> roles,
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC") Instant createdAt) {

    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getRoles(), user.getCreatedAt());
    }
}
