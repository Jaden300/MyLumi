"""Health check.

Also the wake-up endpoint: the frontend pings this on mount so a sleeping
free-tier instance starts spinning up before the user reaches a screen that
needs a prediction. Keep it dependency-free and instant.
"""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}
