# Yahtzee

A dark, minimalist Yahtzee web app — Pass & Play locally, private lobbies over WebSockets, and a ranked-ready data model. Full architecture writeup: see the "Felt & Dice" blueprint.

## Stack

- **Frontend:** React + TypeScript (Vite), Tailwind CSS, React Three Fiber + Rapier, Zustand
- **Backend:** Django, Django REST Framework, Django Channels
- **Data:** PostgreSQL (durable state), Redis (channel layer + hot game-state cache)

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

Ports are just local dev defaults — change the frontend port in `frontend/vite.config.ts`, and mirror it into `CORS_ALLOWED_ORIGINS` in `backend/.env`. Change the backend port via the `daphne -p <port>` flag and `VITE_API_BASE_URL`/`VITE_WS_BASE_URL` in `frontend/.env`.
