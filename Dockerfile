# Single-image build: the React app is compiled, then served by FastAPI from the
# same origin. One service, one URL — no CORS and no separate frontend host.

# --- Stage 1: build the frontend ---
FROM node:22-alpine AS web
WORKDIR /web

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# No VITE_API_BASE: the app calls /api on its own origin.
RUN npm run build

# --- Stage 2: Python runtime ---
FROM python:3.11-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
# main.py serves ./static when it exists.
COPY --from=web /web/dist ./static

# Don't run as root.
RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
# Hosts inject $PORT; fall back to 8000 for `docker run` locally.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
