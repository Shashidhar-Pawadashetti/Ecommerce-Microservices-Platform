package com.ecommerce.auth.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.ecommerce.auth.user.User;
import com.ecommerce.auth.user.UserService;
import com.ecommerce.auth.web.dto.SignupRequest;
import com.ecommerce.auth.web.dto.UserResponse;

import jakarta.validation.Valid;

/**
 * Auth endpoints. At this plan's close exactly one write operation exists:
 *
 * <ul>
 *   <li>{@code POST /auth/signup} [operationId: signup] → 201 User |
 *       409 Conflict(DUPLICATE_EMAIL)</li>
 * </ul>
 *
 * <p>Login and /me land in Plan 02-03. There is intentionally NO logout
 * mapping — the frozen contract (D-03) makes logout client-side token
 * discard; no endpoint will be added without an explicit contract change.</p>
 */
@RestController
class AuthController {

    private final UserService userService;

    AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/auth/signup")
    ResponseEntity<UserResponse> signup(@Valid @RequestBody SignupRequest request) {
        User user = userService.signup(request.email(), request.password());
        return ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(user));
    }
}
