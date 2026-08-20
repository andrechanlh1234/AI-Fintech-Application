"""Minimal in-memory rate limiting for auth endpoints.

No external dependency (no Redis, no slowapi) — this is a single-process
local dev server, so an in-memory fixed window is enough to stop the
obvious abuse (password brute-forcing, signup spam). Keyed by client IP;
would need a shared store instead if this backend ever ran as multiple
replicas behind a load balancer.
"""

import time
from collections import defaultdict

from fastapi import HTTPException, Request

_attempts: dict[str, list[float]] = defaultdict(list)


def enforce_rate_limit(request: Request, bucket: str, max_attempts: int, window_seconds: int) -> None:
    client_ip = request.client.host if request.client else "unknown"
    key = f"{bucket}:{client_ip}"
    now = time.time()
    window_start = now - window_seconds

    attempts = [t for t in _attempts[key] if t > window_start]
    if len(attempts) >= max_attempts:
        retry_after = int(attempts[0] + window_seconds - now) + 1
        raise HTTPException(
            429,
            f"Too many attempts — try again in {retry_after}s",
            headers={"Retry-After": str(retry_after)},
        )
    attempts.append(now)
    _attempts[key] = attempts
