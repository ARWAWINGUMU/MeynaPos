#!/bin/sh
set -e

echo "Preparing database..."
python -m app.database.prepare_database

exec uvicorn main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}"
