# Deploying BJJ Journal

Three free-tier services: **Supabase** (Postgres + login), **Render** (API), **Vercel** (web app).
Do the steps in order; each one needs a value from the step before.

## 1. Supabase: database and the owner account

1. Create a project at [supabase.com](https://supabase.com). Pick a region near you and save the database password.
2. **Turn off sign-ups:** Authentication → Sign In / Providers → turn off **Allow new users to sign up**. Leave the **Email** provider on with password sign-in.
3. **Create your account:** Authentication → Users → **Add user** → **Create new user**. Enter your email and a password, and tick **Auto Confirm User**.
4. Copy the new user's **UID**. This is `OWNER_USER_ID`.
5. Collect the rest:
   - **Project URL** (`https://<ref>.supabase.co`): Project Settings → Data API. This is `SUPABASE_URL` / `VITE_SUPABASE_URL`.
   - **Anon / publishable key**: Project Settings → API Keys. This is `VITE_SUPABASE_ANON_KEY`. It's meant to be public.
   - **Database URL**: **Connect** button at the top → **Session pooler** URI, with your password filled in. This is `DATABASE_URL`. Use the session pooler (port 5432): Render's free plan has no IPv6, so the direct connection won't work, and the transaction pooler (port 6543) doesn't work with the prepared statements psycopg uses.

The API verifies tokens against the project's public keys (`/auth/v1/.well-known/jwks.json`), so no JWT secret is needed. Only an older project still on the legacy shared secret also needs `SUPABASE_JWT_SECRET` (Project Settings → JWT Keys → Legacy JWT secret).

## 2. Render: the API

1. Render → **New** → **Blueprint** → connect this GitHub repo. Render reads [`render.yaml`](../render.yaml).
2. Fill in the secrets it asks for:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Supabase session pooler URI |
   | `SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `OWNER_USER_ID` | your user's UID |
   | `CORS_ORIGINS` | `["https://<your-app>.vercel.app"]`. You'll know the URL after step 3; put a placeholder for now and update it then. |

3. Deploy. Each deploy runs `alembic upgrade head` and then the seed loader before starting (see `backend/scripts/start.sh`). The seed loader only adds techniques that are missing, so your notes and mastery levels are kept. If a migration fails, the new version doesn't start and the old one keeps serving.
4. Check `https://<service>.onrender.com/health` returns `{"status":"ok",...}` and `/techniques` returns 401 (no token).

The free plan sleeps after 15 minutes idle. The first request after that takes up to a minute.

## 3. Vercel: the web app

1. Vercel → **Add New** → **Project** → import this repo. Set **Root Directory** to `frontend`. The rest comes from [`frontend/vercel.json`](../frontend/vercel.json).
2. Environment variables (Production):

   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | `https://<service>.onrender.com` |
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | the anon / publishable key |

3. Deploy, then put the Vercel URL into `CORS_ORIGINS` on Render (exact origin, no trailing slash) and let Render redeploy.
4. Optional: Supabase → Authentication → URL Configuration → set **Site URL** to the Vercel URL.

## 4. Install on the phone

- **iPhone (Safari):** open the site → Share → **Add to Home Screen**. The installed app keeps its own login, separate from Safari, so sign in once inside it.
- **Android (Chrome):** open the site → menu → **Install app** (or accept the install banner).

New deploys are picked up automatically the next time the app is opened.

## Checklist

- [ ] Sign-ups disabled in Supabase
- [ ] `https://<api>/health` → ok; `https://<api>/techniques` without a token → 401
- [ ] Logging in on the Vercel URL shows the technique library
- [ ] App installed on the phone's home screen and opens full screen
