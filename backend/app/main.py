"""OpenClaw setup engine — FastAPI application.

Minimal backend: catalog + config store + validator + deploy runner behind
a single `/setup/*` router. Nothing else lives here — this service exists to
serve the wizard, not to run agents itself.

Run with:

    uvicorn app.main:app --reload
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import setup

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("openclaw")

app = FastAPI(
    title="OpenClaw Setup Engine",
    version="0.1.0",
    description=(
        "Web-based setup wizard for OpenClaw. Configures models, agents, "
        "integrations, and deploy targets. Writes .env and an agent registry, "
        "then hot-reloads the runtime."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(setup.router)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "openclaw-setup-engine"}


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    return {
        "service": "openclaw-setup-engine",
        "docs": "/docs",
        "wizard": "http://localhost:3000/setup",
    }
