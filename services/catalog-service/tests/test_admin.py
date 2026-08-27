"""CAT-06: JWT-protected admin CRUD on the catalog (create/update/delete).

Covers:
  * missing token -> 401 UNAUTHORIZED (byte-identical envelope)
  * invalid/expired/foreign-signed/alg-swapped/tampered token -> 401 same envelope
  * valid token -> 201 (create) / 200 (update) / 204 (delete)
  * unknown id on update/delete -> 404 NOT_FOUND
  * malformed body (negative priceCents) -> 400 VALIDATION_FAILED
"""
from __future__ import annotations

import base64
import jwt
from datetime import datetime, timezone

from app.config import settings

UNAUTHORIZED_BODY = {
    "code": "UNAUTHORIZED",
    "message": "Authentication required or credentials invalid.",
}
NOT_FOUND_BODY = {
    "code": "NOT_FOUND",
    "message": "The requested resource was not found.",
}


def _valid_payload(**overrides) -> dict:
    payload = {
        "sub": "admin",
        "email": "admin@example.com",
        "roles": ["admin"],
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
    }
    payload.update(overrides)
    return payload


def _sign(payload: dict, key=None, algorithm: str = "HS256") -> str:
    return jwt.encode(payload, settings.jwt_secret_bytes if key is None else key, algorithm=algorithm)


async def test_create_requires_auth(client):
    resp = await client.post(
        "/catalog/products",
        json={"name": "x", "category": "c", "priceCents": 1},
    )
    assert resp.status_code == 401
    assert resp.json() == UNAUTHORIZED_BODY


async def test_create_valid(auth_token, client):
    resp = await client.post(
        "/catalog/products",
        json={"name": "Wireless Mouse", "category": "electronics", "priceCents": 2499, "stock": 15},
        headers={"authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Wireless Mouse"
    assert body["priceCents"] == 2499
    assert isinstance(body["id"], str) and body["id"]
    # Server-generated timestamp is present (Rule 1) and id/createdAt not client-supplied.
    assert "createdAt" in body


async def test_update_unknown_404(auth_token, client):
    resp = await client.put(
        "/catalog/products/does-not-exist",
        json={"name": "x", "category": "c", "priceCents": 1},
        headers={"authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 404
    assert resp.json() == NOT_FOUND_BODY


async def test_delete_unknown_404(auth_token, client):
    resp = await client.delete(
        "/catalog/products/does-not-exist",
        headers={"authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 404
    assert resp.json() == NOT_FOUND_BODY


async def test_update_valid_then_delete(auth_token, client):
    created = await client.post(
        "/catalog/products",
        json={"name": "Keyboard", "category": "electronics", "priceCents": 12999, "stock": 42},
        headers={"authorization": f"Bearer {auth_token}"},
    )
    assert created.status_code == 201
    pid = created.json()["id"]

    updated = await client.put(
        f"/catalog/products/{pid}",
        json={"name": "Keyboard", "category": "electronics", "priceCents": 11999, "stock": 40},
        headers={"authorization": f"Bearer {auth_token}"},
    )
    assert updated.status_code == 200
    assert updated.json()["priceCents"] == 11999

    deleted = await client.delete(
        f"/catalog/products/{pid}",
        headers={"authorization": f"Bearer {auth_token}"},
    )
    assert deleted.status_code == 204

    gone = await client.get(f"/catalog/products/{pid}")
    assert gone.status_code == 404


async def test_invalid_token_401(client):
    cases = []

    # expired (exp in the past)
    cases.append(_sign(_valid_payload(exp=int(datetime.now(timezone.utc).timestamp()) - 120)))

    # foreign-signed (wrong secret)
    cases.append(_sign(_valid_payload(), key=base64.b64encode(b"forged-forged-forged-0")))

    # alg swap (HS384 instead of the pinned HS256)
    cases.append(_sign(_valid_payload(), algorithm="HS384"))

    # alg none
    cases.append(_sign(_valid_payload(), key="", algorithm="none"))

    # tampered signature (flip a character in an otherwise valid token)
    valid = _sign(_valid_payload())
    tampered = valid[:-3] + ("aaa" if valid[-1] != "a" else "bbb")
    cases.append(tampered)

    for token in cases:
        resp = await client.post(
            "/catalog/products",
            json={"name": "x", "category": "c", "priceCents": 1},
            headers={"authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 401, f"token {token[:12]}... expected 401"
        # byte-identical envelope for every auth failure (anti-enumeration)
        assert resp.json() == UNAUTHORIZED_BODY


async def test_bad_body_400(auth_token, client):
    resp = await client.post(
        "/catalog/products",
        json={"name": "x", "category": "c", "priceCents": -1},
        headers={"authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 400
    body = resp.json()
    assert body["code"] == "VALIDATION_FAILED"
