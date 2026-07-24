# MeynaPOS

**MeynaPOS** is a professional web-based Point of Sale and Inventory Management System for small and medium businesses.

Slogan: **“Tecnología para crecer juntos”**

This repository was created as a Software Engineering II final project and includes a production-style base architecture with FastAPI, PostgreSQL, SQLAlchemy, Alembic, JWT authentication, React, Vite, TailwindCSS, Docker, CI/CD, and automated tests.

## Deployment Quick Start

Requirements:

- Docker Desktop with Docker Compose.
- Python 3.12+ for local backend tests.
- Node.js 20+ only when building the frontend outside Docker.

Environment:

- Copy `.env.example` to `.env` for Docker deployments.
- Set a strong `SECRET_KEY` and database password before production use.
- Set `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, and `INITIAL_ADMIN_NAME` before the first deployment.
- In production, never keep `INITIAL_ADMIN_PASSWORD=change-me`.
- Set `BUSINESS_NAME` and `BUSINESS_NIT` to show the real business identity in the application header.
- Keep `DATABASE_URL` pointing to `db` inside Docker: `postgresql+psycopg://USER:PASSWORD@db:5432/DB`.
- `VITE_API_URL` must point to the browser-accessible backend API, by default `http://localhost:8000/api`.
- Media files are stored in the named Docker volume `pos_media_data` and served through `/media`.

Deploy:

```bash
docker compose up -d --build
```

Local URLs:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:8000/health`
- API docs: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`

Stop and restart:

```bash
docker compose stop
docker compose restart
docker compose up -d --no-build
```

Logs:

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

Known external issue:

- If Docker Hub or CloudFront DNS fails while building, reuse existing local images with `docker compose up -d --no-build` and retry the build later. Do not remove volumes; `pos_postgres_data` and `pos_media_data` contain persistent data.

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
- Centralized visual toast notifications for success, error, warning, and information messages.
- Roles: `ADMIN` and `CASHIER`.
- Product CRUD with SKU and barcode support.
- Product removal protected by administrator reauthentication.
- Products can be deactivated while preserving all historical records.
- Permanent product deletion preserves sale history through immutable sale-detail snapshots.
- Permanent deletion is rejected when purchase history cannot be safely snapshotted; administrators should deactivate the product instead.
- Inactive products are hidden by default and can be listed or reactivated by administrators.
- Categories show their product count and can only be deleted when no products are associated.
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

Initial administrator:

```text
Email: configured with INITIAL_ADMIN_EMAIL
Temporary password: configured with INITIAL_ADMIN_PASSWORD
```

The initial password is temporary. On first login the administrator must define a personal password before accessing the dashboard or any functional module.

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
| `INITIAL_ADMIN_EMAIL` | First administrator email, used only when no admin exists | `admin@meynapos.com` |
| `INITIAL_ADMIN_PASSWORD` | First administrator temporary password | `change-me` |
| `INITIAL_ADMIN_NAME` | First administrator display name | `Administrador` |
| `TEMP_PASSWORD_EXPIRE_HOURS` | Expiration window for temporary passwords created after setup | `24` |
| `BUSINESS_NAME` | Business name displayed in the application header and seeded in business settings | `MeynaPOS` |
| `BUSINESS_NIT` | Business tax identifier displayed in the application header and seeded in business settings | `000000000-0` |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile server-side verification key | `1x0000000000000000000000000000000AA` |
| `RECAPTCHA_SECRET_KEY` | Optional Google reCAPTCHA fallback secret | empty |
| `MEDIA_ROOT` | Persistent media storage path inside the backend container | `/app/media` |
| `MEDIA_URL_PREFIX` | Public URL prefix for served media files | `/media` |
| `MAX_UPLOAD_SIZE_BYTES` | Maximum accepted upload size for images | `5242880` |

Frontend:

| Variable | Description | Example |
| --- | --- | --- |
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000/api` |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile public site key | `1x00000000000000000000AA` |
| `VITE_RECAPTCHA_SITE_KEY` | Optional Google reCAPTCHA fallback site key | empty |

## API Endpoints

Authentication:

- `POST /api/auth/login`
- `POST /api/auth/change-required-password`
- `POST /api/auth/change-password`

Products:

- `GET /api/products`
- `GET /api/products/barcode/{barcode}`
- `POST /api/products`
- `PUT /api/products/{id}`
- `DELETE /api/products/{id}`
- `POST /api/products/{id}/remove`
- `PATCH /api/products/{id}/deactivate`
- `DELETE /api/products/{id}/permanent`
- `PATCH /api/products/{id}/reactivate`

Categories:

- `GET /api/categories`
- `POST /api/categories`
- `PUT /api/categories/{id}`
- `DELETE /api/categories/{id}`

Sales:

- `POST /api/sales`
- `GET /api/sales`

Reports:

- `GET /api/reports/sales?page=1&page_size=20`
- `GET /api/reports/inventory`

The sales report is paginated, ordered by newest records first using `created_at desc, id desc`, and returns `items`, `page`, `page_size`, `total`, and `total_pages`.

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
- Temporary password, mandatory change, reset, and token invalidation coverage.
- Product creation and barcode lookup integration tests.
- Sale creation and automatic inventory decrement integration tests.

## Temporary Passwords and Mandatory Password Change

MeynaPOS uses temporary passwords for first access, user creation, and administrator password resets.

- The first administrator is created by the seed process only if no administrator exists.
- The seed reads `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, and `INITIAL_ADMIN_NAME`.
- The first administrator password is stored only as a bcrypt hash and starts with `must_change_password=true`.
- The seed is idempotent: it does not duplicate administrators, reset passwords, or overwrite later profile changes.
- Users created by an administrator receive a temporary password. If the administrator leaves the field empty, the backend generates a cryptographically secure password and returns it once.
- Password resets require the current administrator password in the request.
- Temporary passwords expire after `TEMP_PASSWORD_EXPIRE_HOURS`, except the initial administrator password before the first mandatory change.
- Login with a temporary password returns `must_change_password=true` and a limited JWT.
- Limited JWTs cannot access dashboard, sales, inventory, reports, users, or other functional endpoints.
- The only allowed flow is `POST /api/auth/change-required-password`.
- After the user defines a personal password, the backend increments `token_version`, clears the temporary state, and the frontend closes the session.
- The user must log in again with the new password.
- Passwords are never logged, returned by public endpoints, or stored in plain text.

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
