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

# Keys are `bucket:ip`, so an unbounded number accumulate over a long-lived
# process even though each key's timestamp list is pruned on access. Sweep
# stale keys (nothing newer than the longest window in use) periodically so
# the dict can't grow without limit.
_STALE_AFTER_SECONDS = 60 * 60
_SWEEP_INTERVAL_SECONDS = 5 * 60
_last_sweep = 0.0


def _sweep_if_due(now: float) -> None:
    global _last_sweep
    if now - _last_sweep < _SWEEP_INTERVAL_SECONDS:
        return
    _last_sweep = now
    cutoff = now - _STALE_AFTER_SECONDS
    for key in [k for k, ts in _attempts.items() if not ts or ts[-1] < cutoff]:
        del _attempts[key]


def enforce_rate_limit(request: Request, bucket: str, max_attempts: int, window_seconds: int) -> None:
    client_ip = request.client.host if request.client else "unknown"
    key = f"{bucket}:{client_ip}"
    now = time.time()
    window_start = now - window_seconds
    _sweep_if_due(now)

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
