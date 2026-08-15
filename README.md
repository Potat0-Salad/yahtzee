# Yahtzee

A dark, minimalist Yahtzee web app — Pass & Play locally, private lobbies over WebSockets with masked scorecards, and a ranked-ready Elo data model. Installable as a PWA.

## Stack

- **Frontend:** React + TypeScript (Vite), Tailwind CSS, Zustand. Dice are real CSS 3D objects (`transform-style: preserve-3d`), not a physics engine.
- **Backend:** Django, Django REST Framework, Django Channels (WebSocket gameplay)
- **Data:** PostgreSQL (durable state — a `GameSession` row *is* the live authoritative state for an online match), Redis (channel-layer pub/sub only, not a cache)

## Status

- ✅ Pass & Play (local, one device)
- ✅ Guest identity, persistence, game history
- ✅ Online multiplayer (private lobbies, room codes, disconnect/reconnect handling)
- ✅ Ranked groundwork — Elo model and rating math, no matchmaking UI yet
- 🚧 Deployment

## Layout

```
yahtzee/
├─ frontend/     Vite + React + TS app
├─ backend/      Django project (DRF + Channels)
└─ docker-compose.yml   Postgres + Redis for local dev
```

## Quickstart

```bash
# 1. infra
docker compose up -d

# 2. backend (ASGI, needed for Channels — not `manage.py runserver`)
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
daphne -p 8000 config.asgi:application

# 3. frontend (separate shell)
cd frontend
npm install
cp .env.example .env
npm run dev
```

App runs at **http://localhost:5190** (fixed via `server.port` in `vite.config.ts` — set `strictPort` so it fails loudly instead of drifting to another port if 5190 is taken). Backend API at `http://localhost:8000`.

Ports are just local dev defaults — change the frontend port in `frontend/vite.config.ts`, and mirror it into `CORS_ALLOWED_ORIGINS` in `backend/.env`. Change the backend port via the `daphne -p <port>` flag and `VITE_API_BASE_URL` in `frontend/.env`.

## Deploying

`backend/Dockerfile` builds a single image that serves both HTTP and WebSocket traffic via Daphne. It reads `DATABASE_URL` and `REDIS_URL` if set (what managed Postgres/Redis add-ons provide), falling back to the individual `POSTGRES_*` vars above for local dev. Set `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`, `DJANGO_ALLOWED_HOSTS`, and `CORS_ALLOWED_ORIGINS` for your real domain(s) before deploying — none of the local dev defaults are safe in production.
