# BJJ Journal

A personal Brazilian Jiu-Jitsu learning app: technique library, class log, mistake tracking and analysis, with RPG-style progression and a skill tree map. Built to be used on the phone right after class.

**Stack:** React + TypeScript (PWA) · FastAPI · Supabase (Postgres + Auth)

See [ROADMAP.md](ROADMAP.md) for the plan, data model and phases.

## Status

- Phase 0 (foundations): linting, tests and CI.
- Phase 2 (auth and deployment): Supabase login for a single owner account, JWT checks on the API, Render + Vercel deploy config, installable PWA. See [docs/DEPLOY.md](docs/DEPLOY.md) to put it online.

## Getting started

### Requirements

- [Docker](https://docs.docker.com/get-docker/) with Docker Compose (for `make dev`)
- For running checks locally: [uv](https://docs.astral.sh/uv/) and Node.js 22+

### Run the app

```bash
make dev
```

This starts Postgres, the FastAPI backend and the Vite frontend with hot reload, and applies database migrations. Open http://localhost:5173: the page should say **API is ok**.

Locally there is no login: without Supabase settings the frontend skips the login screen and the backend runs with `AUTH_DISABLED=true` (refused when `ENVIRONMENT=production`). The API runs on http://localhost:8000 (interactive docs at http://localhost:8000/docs).

Stop it with `Ctrl+C`, or `make down` if it runs in the background.

### Run without Docker

```bash
make install
```

```bash
cd backend && uv run alembic upgrade head && uv run uvicorn --factory app.main:create_app --reload
```

```bash
cd frontend && npm run dev
```

### Environment variables

Defaults work for local development. To override them, copy the examples:

- `backend/.env.example` → `backend/.env`
- `frontend/.env.example` → `frontend/.env.local`

To try real login locally, set `SUPABASE_URL` and `OWNER_USER_ID` in `backend/.env`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `frontend/.env.local`, then run `AUTH_DISABLED=false make dev`.

### Database migrations

Alembic, in `backend/alembic/`. Migrations run automatically on `make dev` and on every deploy.

```bash
cd backend && uv run alembic revision --autogenerate -m "add techniques"
```

```bash
make migrate
```

### Checks

| Command | What it runs |
|---|---|
| `make lint` | Ruff (backend), ESLint + Prettier (frontend) |
| `make typecheck` | mypy (backend), tsc (frontend) |
| `make test` | pytest (backend), Vitest (frontend) |
| `make check` | All of the above, same as CI |
| `make format` | Auto-fix formatting |

GitHub Actions runs the same checks (plus a production build of the frontend) on every push and pull request; see `.github/workflows/ci.yml`.

## Project layout

```
backend/    FastAPI app (uv, Ruff, mypy, pytest)
frontend/   React + TypeScript + Vite + Tailwind (ESLint, Prettier, Vitest)
docker-compose.yml   local Postgres + backend + frontend
render.yaml          Render Blueprint for the API
docs/DEPLOY.md       Supabase, Render and Vercel setup
Makefile    dev, lint, typecheck, test, check
```
