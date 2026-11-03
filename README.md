# BJJ Journal

A personal Brazilian Jiu-Jitsu learning app: technique library, class log, mistake tracking and analysis, with RPG-style progression and a skill tree map. Built to be used on the phone right after class.

**Stack:** React + TypeScript (PWA) · FastAPI · Supabase (Postgres + Auth)

See [ROADMAP.md](ROADMAP.md) for the plan, data model and phases.

## Status

Phase 0 (foundations) in place: a hello page that calls the API's `/health` endpoint, linting, tests and CI.

## Getting started

### Requirements

- [Docker](https://docs.docker.com/get-docker/) with Docker Compose (for `make dev`)
- For running checks locally: [uv](https://docs.astral.sh/uv/) and Node.js 22+

### Run the app

```bash
make dev
```

This starts Postgres, the FastAPI backend and the Vite frontend with hot reload. Open http://localhost:5173: the page should say **API is ok**. The API runs on http://localhost:8000 (interactive docs at http://localhost:8000/docs).

Stop it with `Ctrl+C`, or `make down` if it runs in the background.

### Run without Docker

```bash
make install
```

```bash
cd backend && uv run uvicorn app.main:app --reload
```

```bash
cd frontend && npm run dev
```

### Environment variables

Defaults work for local development. To override them, copy the examples:

- `backend/.env.example` → `backend/.env`
- `frontend/.env.example` → `frontend/.env.local`

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
Makefile    dev, lint, typecheck, test, check
```
