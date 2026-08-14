# Single image for HTTP + WebSocket — Daphne serves both, no separate
# WSGI/ASGI split needed for a project this size.
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# libpq-dev + build-essential cover psycopg's build path on platforms
# without a prebuilt wheel (e.g. building for linux/arm64 on Apple
# Silicon); harmless if the wheel install skips straight past them.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# No secrets are needed at build time — every setting that touches one
# falls back to a dev-only default (see config/settings.py), which is
# fine since collectstatic never reads the database or makes requests.
RUN python manage.py collectstatic --noinput

EXPOSE 8000

# Migrating on boot keeps this a single deployable unit — reasonable for
# one Daphne process; a multi-instance deploy would want migrate split
# into its own release step so N boots don't race the same migration.
CMD ["sh", "-c", "python manage.py migrate --noinput && daphne -b 0.0.0.0 -p ${PORT:-8000} config.asgi:application"]
