# MeynaPOS

**MeynaPOS** is a professional web-based Point of Sale and Inventory Management System for small and medium businesses.

Slogan: **“Tecnología para crecer juntos”**

This repository was created as a Software Engineering II final project and includes a production-style base architecture with FastAPI, PostgreSQL, SQLAlchemy, Alembic, JWT authentication, React, Vite, TailwindCSS, Docker, CI/CD, and automated tests.

## Architecture

The backend follows Clean Architecture principles:

- `api`: HTTP controllers and route declarations.
- `schemas`: Pydantic DTOs for request and response validation.
- `services`: Business use cases such as authentication, product management, sales, stock validation, and reporting.
- `repositories`: Persistence abstractions over SQLAlchemy queries.
- `models`: Relational SQLAlchemy domain models.
- `database`: database connection, session management, seeding, and migrations.
- `dependencies`: FastAPI dependency providers for auth and role checks.
- `middleware`: request logging and cross-cutting web concerns.
- `utils`: reusable helpers and design pattern implementations.

Required design patterns are implemented:

- **Singleton Pattern**: `DatabaseManager` in `backend/app/database/session.py` centralizes engine and session factory lifecycle.
- **Factory Pattern**: `ProductFactory` in `backend/app/utils/product_factory.py` creates a complete Product aggregate with its Inventory record.

## Main Features

- JWT login with role-based authorization.
- Roles: `ADMIN` and `CASHIER`.
- Product CRUD with SKU and barcode support.
- Barcode scanner workflow for keyboard-emulating scanners.
- Inventory stock validation and low stock alerts.
- Sales creation with automatic totals and stock decrement.
- Daily sales and inventory reports.
- React dashboard, POS sales interface, inventory, products, and reports pages.
- Docker Compose stack with PostgreSQL, backend, and frontend.
- GitHub Actions workflow for tests and Docker image builds.

## Technology Stack

Backend:

- Python 3.12+
- FastAPI
- SQLAlchemy 2
- PostgreSQL
- Alembic
- Pydantic
- JWT with `python-jose`
- Pytest and pytest-asyncio

Frontend:

- React 18
- Vite
- TypeScript
- TailwindCSS
- Axios
- React Router
- Lucide React icons

DevOps:

- Docker
- Docker Compose
- GitHub Actions

## Setup

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload
```

Default local API URL:

```text
http://localhost:8000
```

Interactive API documentation:

```text
http://localhost:8000/docs
```

Default seeded admin account:

```text
Email: admin@meynapos.com
Password: Admin123!
```

### Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Default frontend URL:

```text
http://localhost:5173
```

## Docker

Run the complete stack:

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- PostgreSQL: `localhost:5432`

## Environment Variables

Backend:

| Variable | Description | Example |
| --- | --- | --- |
| `ENVIRONMENT` | Runtime environment | `development` |
| `DATABASE_URL` | SQLAlchemy database URL | `postgresql+psycopg://meynapos:meynapos@localhost:5432/meynapos` |
| `SECRET_KEY` | JWT signing key | `replace-with-a-strong-secret` |

Frontend:

| Variable | Description | Example |
| --- | --- | --- |
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000/api` |

## API Endpoints

Authentication:

- `POST /api/auth/login`

Products:

- `GET /api/products`
- `GET /api/products/barcode/{barcode}`
- `POST /api/products`
- `PUT /api/products/{id}`
- `DELETE /api/products/{id}`

Sales:

- `POST /api/sales`
- `GET /api/sales`

Reports:

- `GET /api/reports/sales`
- `GET /api/reports/inventory`

## Database Migrations

Alembic is configured in `backend/alembic.ini`.

Run migrations:

```bash
cd backend
alembic upgrade head
```

Create a new migration:

```bash
alembic revision --autogenerate -m "describe change"
```

## Testing

Run backend tests:

```bash
cd backend
pytest
```

The test suite includes:

- Authentication unit/integration coverage.
- Product creation and barcode lookup integration tests.
- Sale creation and automatic inventory decrement integration tests.

## Barcode Scanner Support

Most barcode scanners behave as keyboard input devices. The POS page includes a dedicated barcode input and the `useBarcodeScanner` hook, which:

- Detects barcode-like fast input.
- Calls `/api/products/barcode/{barcode}` instantly.
- Adds the product to the shopping cart automatically.

## CI/CD

The workflow at `.github/workflows/ci.yml` runs on pushes and pull requests to `main` and `develop`.

It performs:

- Python dependency installation.
- Backend test execution.
- Backend Docker image build.
- Node dependency installation.
- Frontend production build.
- Frontend Docker image build.

## Project Structure

```text
backend/
  app/
    api/
    core/
    models/
    schemas/
    services/
    repositories/
    database/
    middleware/
    dependencies/
    utils/
    tests/
  alembic/
  Dockerfile
  requirements.txt
  main.py

frontend/
  src/
    pages/
    components/
    services/
    hooks/
    context/
    layouts/
    routes/
    types/
    assets/
  Dockerfile
  package.json
  vite.config.ts

.github/workflows/ci.yml
docker-compose.yml
README.md
```
