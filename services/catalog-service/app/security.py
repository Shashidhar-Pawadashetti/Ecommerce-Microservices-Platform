"""JWT bearer verification dependency for the Catalog Service.

Catalog is a holder of JWT_SECRET in v1 (the third, after auth-service and the
gateway — recorded as a deviation in DOCS-02). Self-verification here is
defense-in-depth and is enforced on mutating routes from Plan 04.

Cross-cutting rules (docs/json-interop.md + auth-service analog):
  * Decode JWT_SECRET from base64 into raw bytes before PyJWT (matches signer).
  * Pin alg HS256; never negotiate. Validate iss=ecommerce-auth, aud=ecommerce-api.
  * One byte-identical 401 envelope for every auth failure (anti-enumeration).
"""
from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings

bearer_scheme = HTTPBearer(auto_error=False)

UNAUTHORIZED_BODY = {
    "code": "UNAUTHORIZED",
    "message": "Authentication required or credentials invalid.",
}


def require_auth(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    """Verify a bearer token; return its claims dict or raise 401.

    Defined now so Plan 04 admin routes import it without refactor. Not yet
    wired to any public route in this tracer slice.
    """
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=401, detail=UNAUTHORIZED_BODY)
    try:
        return jwt.decode(
            creds.credentials,
            settings.jwt_secret_bytes,
            algorithms=["HS256"],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            # Contract accepts a ±60s clock skew on exp (docs/json-interop.md §JWT Claims).
            leeway=60,
        )
    except jwt.PyJWTError:
        # One byte-identical envelope for every auth failure (missing, expired,
        # wrong iss/aud, alg swap, foreign signature) — no enumeration signal.
        raise HTTPException(status_code=401, detail=UNAUTHORIZED_BODY)
