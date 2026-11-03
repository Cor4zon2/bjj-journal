#!/bin/sh
# Production entrypoint: apply migrations, then serve. Render sets $PORT.
set -e
alembic upgrade head
exec uvicorn --factory app.main:create_app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*'
