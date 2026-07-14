#!/bin/sh
set -e

echo "Preparing database..."
python -m app.database.prepare_database

echo "Starting MeynaPOS API..."
exec uvicorn main:app --host 0.0.0.0 --port 8000
