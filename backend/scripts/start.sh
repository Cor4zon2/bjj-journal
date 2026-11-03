#!/bin/sh
# Production entrypoint: apply migrations, add any new seed techniques, then serve.
# Render sets $PORT. The seed loader skips techniques that already exist, so your notes
# and mastery levels are never overwritten.
set -e
alembic upgrade head
python -m app.seed
exec uvicorn --factory app.main:create_app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*'
