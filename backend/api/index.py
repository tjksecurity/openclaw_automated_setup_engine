"""Vercel serverless entry point for the OpenClaw setup engine.

Vercel's Python runtime looks for `api/*.py` at the project root and runs
each file as a serverless function. We expose the FastAPI app as `app`;
Vercel's built-in ASGI adapter routes requests to it.
"""

import os
import sys
from pathlib import Path

# The FastAPI code lives in ../app/ relative to this file. Add the backend
# directory to sys.path so `from app.main import app` resolves.
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Vercel gives us /tmp for ephemeral filesystem writes. Point the config
# store at it so the deploy runner has a writable location. This is
# per-instance and lost on cold start — fine for a demo, not for prod.
os.environ.setdefault("OPENCLAW_REPO_ROOT", "/tmp/openclaw")
Path("/tmp/openclaw/config").mkdir(parents=True, exist_ok=True)
Path("/tmp/openclaw/backend/app").mkdir(parents=True, exist_ok=True)
# The deploy runner touches backend/app/main.py to trigger a hot reload —
# create the file so the touch doesn't error.
(Path("/tmp/openclaw/backend/app/main.py")).touch(exist_ok=True)

from app.main import app  # noqa: E402  (path setup must run first)

# Vercel's Python runtime looks for a WSGI/ASGI callable named `app`.
