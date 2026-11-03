# BJJ Journal

A personal Brazilian Jiu-Jitsu learning app: technique library, class log, mistake tracking and analysis, with RPG-style progression and a skill tree map. Built to be used on the phone right after class.

**Stack:** React + TypeScript (PWA) · FastAPI · Supabase (Postgres + Auth)

See [ROADMAP.md](ROADMAP.md) for the plan, data model and phases.

## Status

- Phase 1 (technique library): 17 seed techniques across guard pulls, the De La Riva tree and white belt fundamentals. Browse and filter them, then edit steps, key details, notes and mastery from a phone. YouTube links play inline and Instagram Reels open in the app. No video links are seeded; add your own from a technique page, and when a technique has none, the page offers a YouTube search.
- Phase 2 (auth and deployment): Supabase login for a single owner account, JWT checks on every API route except `/health`, Render + Vercel deploy config, installable PWA. See [docs/DEPLOY.md](docs/DEPLOY.md) to put it online.
- Phase 3 (class log and mistakes): a "Log today's class" form built for the phone. Date, class type, duration and energy are one-tap chips; techniques are picked by quick search and marked taught / drilled / hit in rolling; mistakes are added inline, linked to a technique or a position. Hits in rolling count towards the technique's "times hit". Class history with edit and delete, and a Mistakes tab to move each mistake Open → Working on it → Fixed. A half-filled log is kept on the phone, survives losing signal or closing the app, and is sent once the phone is back online; a retried save never creates the class twice.

## Getting started

### Requirements

- [Docker](https://docs.docker.com/get-docker/) with Docker Compose (for `make dev`)
- For running checks locally: [uv](https://docs.astral.sh/uv/) and Node.js 22+

### Run the app

```bash
make dev
```

This starts Postgres, applies migrations, loads the seed techniques, and runs the FastAPI backend and the Vite frontend with hot reload. Open http://localhost:5173 to see the technique library. The API runs on http://localhost:8000 (interactive docs at http://localhost:8000/docs).

Locally there is no login: without Supabase settings the frontend skips the login screen and the backend runs with `AUTH_DISABLED=true` (refused when `ENVIRONMENT=production`).

Stop it with `Ctrl+C`, or `make down` if it runs in the background.

### Run without Docker

```bash
make install
```

Start Postgres yourself (or `docker compose up db`), then:

```bash
make migrate
```

```bash
make seed
```

```bash
cd backend && uv run uvicorn --factory app.main:create_app --reload
```

```bash
cd frontend && npm run dev
```

### Environment variables

Defaults work for local development. To override them, copy the examples:

- `backend/.env.example` → `backend/.env`
- `frontend/.env.example` → `frontend/.env.local`

To try real login locally, set `SUPABASE_URL` and `OWNER_USER_ID` in `backend/.env`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `frontend/.env.local`, then run `AUTH_DISABLED=false make dev`. Running the backend without Docker and without those settings needs `AUTH_DISABLED=true` in `backend/.env`.

### Database and seed data

- Migrations live in `backend/alembic/`. After changing a model, create one with `cd backend && uv run alembic revision --autogenerate -m "what changed"`.
- Migrations and the seed loader run automatically on `make dev` and on every deploy (`backend/scripts/start.sh`).
- Seed techniques live in `backend/app/seed/techniques.yaml`. `make seed` adds the techniques and positions that are missing, matched by slug. It never overwrites existing ones, so your notes and mastery levels are safe.
- `cd backend && uv run python -m app.seed --reset` wipes the library and reloads the seed. This deletes your notes and mastery levels.

### API types

The frontend's TypeScript types come from the backend's OpenAPI schema. After changing an API schema, run `make api-types`. CI fails if `frontend/openapi.json` or `frontend/src/api/schema.ts` is out of date.

### Checks

| Command | What it runs |
|---|---|
| `make lint` | Ruff (backend), ESLint + Prettier (frontend) |
| `make typecheck` | mypy (backend), tsc (frontend) |
| `make test` | pytest (backend), Vitest (frontend) |
| `make check` | All of the above, same as CI |
| `make format` | Auto-fix formatting |

Backend tests use in-memory SQLite by default. Set `TEST_DATABASE_URL` to run them against a Postgres database, which the tests will wipe. GitHub Actions runs the same checks on every push and pull request, with backend tests on both SQLite and Postgres, plus a production build of the frontend; see `.github/workflows/ci.yml`.

## Project layout

```
backend/    FastAPI app (uv, Ruff, mypy, pytest)
frontend/   React + TypeScript + Vite + Tailwind (ESLint, Prettier, Vitest)
docker-compose.yml   local Postgres + backend + frontend
render.yaml          Render Blueprint for the API
docs/DEPLOY.md       Supabase, Render and Vercel setup
Makefile    dev, lint, typecheck, test, check
```
