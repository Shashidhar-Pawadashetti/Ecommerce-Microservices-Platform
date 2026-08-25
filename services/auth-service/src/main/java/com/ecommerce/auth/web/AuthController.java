package com.ecommerce.auth.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.ecommerce.auth.security.RestAuthenticationEntryPoint;
import com.ecommerce.auth.support.ApiError;
import com.ecommerce.auth.user.User;
import com.ecommerce.auth.user.UserService;
import com.ecommerce.auth.web.dto.AccessTokenPairResponse;
import com.ecommerce.auth.web.dto.LoginRequest;
import com.ecommerce.auth.web.dto.SignupRequest;
import com.ecommerce.auth.web.dto.UserResponse;

import jakarta.validation.Valid;

/**
 * Auth endpoints. At this plan's close:
 *
 * <ul>
 *   <li>{@code POST /auth/signup} [operationId: signup] → 201 User |
 *       409 Conflict(DUPLICATE_EMAIL)</li>
 *   <li>{@code POST /auth/login} [operationId: login] → 200 AccessTokenPair |
 *       401 Unauthorized</li>
 * </ul>
 *
 * <p>GET /auth/me lands in this plan's Task 2. There is intentionally NO
 * logout mapping — the frozen contract (D-03) makes logout client-side token
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

    @PostMapping("/auth/login")
    ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        // Empty for BOTH wrong-password and unknown-email: ONE byte-identical
        // 401 envelope, shared with the filter-chain entry point (T-02-02).
        return userService.login(request.email(), request.password())
                .<ResponseEntity<?>>map(session -> ResponseEntity.ok(
                        new AccessTokenPairResponse(session.accessToken(),
                                UserResponse.from(session.user()))))
                .orElseGet(AuthController::unauthorized);
    }

    /** Shared failure path reusing the entry point's single envelope source. */
    static ResponseEntity<ApiError> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(RestAuthenticationEntryPoint.UNAUTHORIZED_ENVELOPE);
    }
}
