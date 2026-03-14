#!/usr/bin/env python3
"""SettleGrid smoke test auth helper — gate token + Clerk JWT acquisition.

Outputs JSON: { "gate_cookie": "...", "clerk_jwt": "...", "user_id": "..." }
On failure: { "error": "..." }

Uses only Python stdlib (no pip dependencies).
"""

import base64
import hashlib
import hmac
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


def env(name: str) -> str:
    val = os.environ.get(name, "").strip()
    if not val:
        raise ValueError(f"Missing env var: {name}")
    return val


def compute_gate_token(secret: str, message: str) -> str:
    """Compute HMAC-SHA256 gate token locally — no HTTP call needed."""
    return hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()


def derive_fapi_url(publishable_key: str) -> str:
    """Decode Clerk publishable key to get FAPI base URL."""
    prefix = "pk_live_" if publishable_key.startswith("pk_live_") else "pk_test_"
    encoded = publishable_key[len(prefix):]
    padding = 4 - (len(encoded) % 4)
    if padding != 4:
        encoded += "=" * padding
    decoded = base64.b64decode(encoded).decode("utf-8").rstrip("$")
    return f"https://{decoded}"


UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


def _request(url: str, data=None, method="GET", headers=None):
    """Make an HTTP request with a browser-like User-Agent (Cloudflare blocks urllib)."""
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("User-Agent", UA)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    return urllib.request.urlopen(req, timeout=15)


def ensure_user_exists(secret_key: str, email: str, password: str) -> str:
    """Find or create user via Clerk Backend API. Returns user_id."""
    clerk_api = "https://api.clerk.com"

    # Look up user by email
    params = urllib.parse.urlencode({"email_address[]": email})
    resp = _request(
        f"{clerk_api}/v1/users?{params}",
        headers={"Authorization": f"Bearer {secret_key}"},
    )
    users = json.loads(resp.read().decode())

    if users:
        return users[0]["id"]

    # Create user
    data = json.dumps({
        "email_address": [email],
        "password": password,
        "skip_password_checks": True,
    }).encode()
    resp = _request(
        f"{clerk_api}/v1/users",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {secret_key}",
            "Content-Type": "application/json",
        },
    )
    user = json.loads(resp.read().decode())
    return user["id"]


def create_sign_in_token(secret_key: str, user_id: str) -> str:
    """Create a sign-in token via Clerk Backend API (bypasses 2FA)."""
    data = json.dumps({"user_id": user_id}).encode()
    resp = _request(
        "https://api.clerk.com/v1/sign_in_tokens",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {secret_key}",
            "Content-Type": "application/json",
        },
    )
    result = json.loads(resp.read().decode())
    token = result.get("token")
    if not token:
        raise ValueError(f"No token in sign_in_tokens response: {json.dumps(result)[:200]}")
    return token


def get_clerk_jwt(fapi_url: str, ticket: str) -> str:
    """Exchange sign-in token for session JWT via Clerk FAPI ticket strategy."""
    url = f"{fapi_url}/v1/client/sign_ins"
    data = urllib.parse.urlencode({
        "strategy": "ticket",
        "ticket": ticket,
    }).encode()
    resp = _request(
        url,
        data=data,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    result = json.loads(resp.read().decode())

    # Navigate to JWT: response.client.sessions[0].last_active_token.jwt
    client = result.get("client", {})
    if not client:
        client = result.get("response", {}).get("client", {})
    sessions = client.get("sessions", [])
    if not sessions:
        raise ValueError("No sessions in FAPI ticket response")

    jwt = sessions[0].get("last_active_token", {}).get("jwt")
    if not jwt:
        raise ValueError("No JWT in FAPI session response")

    return jwt


def main():
    try:
        gate_secret = env("SMOKE_GATE_SECRET")
        gate_msg = env("SMOKE_GATE_TOKEN_MSG")
        clerk_secret = env("SMOKE_CLERK_SECRET_KEY")
        clerk_pub = env("SMOKE_CLERK_PUBLISHABLE_KEY")
        clerk_email = env("SMOKE_CLERK_USER_EMAIL")
        clerk_password = env("SMOKE_CLERK_USER_PASSWORD")

        # Step 1: Compute gate token locally
        gate_cookie = compute_gate_token(gate_secret, gate_msg)

        # Step 2: Ensure user exists in Clerk
        user_id = ensure_user_exists(clerk_secret, clerk_email, clerk_password)

        # Step 3: Create sign-in token (bypasses 2FA)
        ticket = create_sign_in_token(clerk_secret, user_id)

        # Step 4: Exchange token for JWT via FAPI
        fapi_url = derive_fapi_url(clerk_pub)
        clerk_jwt = get_clerk_jwt(fapi_url, ticket)

        import time
        print(json.dumps({
            "gate_cookie": gate_cookie,
            "clerk_jwt": clerk_jwt,
            "client_uat": str(int(time.time())),
            "user_id": user_id,
        }))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
