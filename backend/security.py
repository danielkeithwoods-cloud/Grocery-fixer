"""Access control for a publicly reachable deployment.

Locally (no APP_ACCESS_CODE set) everything stays open, so the dev workflow is
unchanged. Once deployed, the access code keeps strangers from spending your
Anthropic credits, and the rate limit caps the damage from a shared code or a
runaway client.
"""

import hmac
import os
import time
from collections import defaultdict, deque

from fastapi import Header, HTTPException, Request

_WINDOW_SECONDS = 3600
_hits: dict[str, deque] = defaultdict(deque)
_last_prune = 0.0


def access_code() -> str:
    return (os.getenv("APP_ACCESS_CODE") or "").strip()


def protection_enabled() -> bool:
    return bool(access_code())


async def require_access(x_access_code: str | None = Header(default=None)) -> None:
    """Gate /api behind a shared code. No-op when APP_ACCESS_CODE is unset."""
    expected = access_code()
    if not expected:
        return
    provided = (x_access_code or "").strip()
    # compare_digest keeps the check constant-time.
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Access code required.")


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _prune(now: float) -> None:
    """Drop idle buckets so the dict can't grow without bound."""
    global _last_prune
    if now - _last_prune < 600:
        return
    _last_prune = now
    for ip in [k for k, q in _hits.items() if not q or now - q[-1] > _WINDOW_SECONDS]:
        _hits.pop(ip, None)


def hourly_limit() -> int:
    try:
        return int(os.getenv("AI_RATE_LIMIT_PER_HOUR", "30"))
    except ValueError:
        return 30


async def rate_limit_ai(request: Request) -> None:
    """Cap billable AI calls per client per hour. Set to 0 to disable."""
    limit = hourly_limit()
    if limit <= 0:
        return

    now = time.time()
    _prune(now)

    bucket = _hits[_client_ip(request)]
    while bucket and now - bucket[0] > _WINDOW_SECONDS:
        bucket.popleft()

    if len(bucket) >= limit:
        minutes = int((_WINDOW_SECONDS - (now - bucket[0])) // 60) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit reached ({limit} AI requests/hour). Try again in ~{minutes} min.",
        )

    bucket.append(now)
