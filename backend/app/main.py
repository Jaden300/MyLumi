"""MyLumi inference API.

STATELESS BY DESIGN. This service has no database, no disk writes, and no
session state. A request arrives with de-identified feature rows, a model is fit
on them, an answer is returned, and everything is discarded when the request
ends. The clinical record never leaves the user's browser.

That is what lets MyLumi run real ML on Render while keeping the local-first
promise in CLAUDE.md.

    DO NOT LOG REQUEST BODIES.

Not in a handler, not in middleware, not "temporarily" while debugging. A log
line containing symptom scores or journal text is clinical data at rest on a
server, which is precisely what this architecture promises does not exist. Log
status codes, paths and latency - never payloads. The same rule applies to
exception handlers: the one below deliberately returns a generic message rather
than echoing the offending input.
"""

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .routers import (
    anomaly,
    correlation,
    forecast,
    health,
    insights,
    nlp,
    state,
    symptoms,
    validation,
)

app = FastAPI(
    title="MyLumi Inference API",
    version="0.1.0",
    description=(
        "Stateless inference for MyLumi. Accepts de-identified feature rows, "
        "returns explainable predictions. Stores nothing."
    ),
)

# The frontend is static-hosted on a different origin, so CORS is required.
# Explicit list, not "*": this API should be callable from the app, not embedded
# in someone else's page.
DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
]
extra = os.environ.get("FRONTEND_ORIGINS", "")
origins = DEFAULT_ORIGINS + [o.strip() for o in extra.split(",") if o.strip()]

# Unset in production, this used to fall back to localhost-only and start
# happily. The deployed frontend's requests were then blocked by the browser,
# which the app could only report as "can't reach the model service" - a config
# mistake wearing a network outage's clothes, and invisible from both sides.
# Refuse to start instead. Render sets RENDER=true on every service it runs.
if os.environ.get("RENDER") and not extra.strip():
    raise RuntimeError(
        "FRONTEND_ORIGINS is unset. In production this would leave the CORS "
        "allowlist at localhost only, and every request from the deployed "
        "frontend would be blocked by the browser and reported to the user as "
        "an unreachable service. Set it to the frontend's origin, comma "
        "separated for more than one."
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,  # no cookies, no sessions - there is nothing to authenticate
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(health.router)
app.include_router(insights.router)
app.include_router(forecast.router)
app.include_router(correlation.router)
app.include_router(anomaly.router)
app.include_router(symptoms.router)
app.include_router(validation.router)
app.include_router(state.router)
app.include_router(nlp.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """The generic 500 this module's docstring promises.

    Without it, an unhandled error reaches Starlette's default handler, which
    logs a full traceback - and traceback frames hold local variables, which on
    this service means feature rows. That is the payload in the log, arriving by
    the one route nobody writes a log line for.

    So: no body echo, no exception text, no stack trace. The client gets the
    same shape it already knows how to render as "can't reach the service", and
    the logs get a status code and a path.

    `routers/insights.py` wraps each model in `_section` for a related but
    different reason - a model that *raises* is already contained there. This
    catches what that cannot: a model that returns successfully and fails later
    during response serialisation, which is exactly how a non-finite float used
    to take the endpoint down.
    """
    return JSONResponse(
        status_code=500,
        content={
            "available": False,
            "reason": "MyLumi's model service hit an unexpected problem. Your data is safe on this device.",
        },
    )


@app.get("/")
def root():
    return {
        "service": "mylumi-inference",
        "stateless": True,
        "storesData": False,
        "docs": "/docs",
    }
