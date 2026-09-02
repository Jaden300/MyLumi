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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import anomaly, correlation, forecast, health, insights, nlp

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
app.include_router(nlp.router)


@app.get("/")
def root():
    return {
        "service": "mylumi-inference",
        "stateless": True,
        "storesData": False,
        "docs": "/docs",
    }
