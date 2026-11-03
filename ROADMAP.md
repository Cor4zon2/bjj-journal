# BJJ Journal — Roadmap

A personal web app for learning Brazilian Jiu-Jitsu: a technique library, a class log, mistake tracking and analysis, with progress tracking (technique mastery, stats, streak) and a skill tree map.

- **User:** one person (the owner). Single account, no sign-up.
- **Use:** log a class from the phone right after training; review techniques and mistakes on laptop or phone.
- **Discipline:** Gi.
- **Starting point:** white belt, 1 stripe. Focus: **guard pulling** and **De La Riva**.

---

## 1. Product overview

### Screens

Design mockups for every screen: [BJJ Journal — App Design](https://claude.ai/artifact/BZQyPysf1rjCGPnzTGjT44).

| Tab | Purpose |
|---|---|
| **Home** | Belt & stripes, classes and mat time, stats (Guard, Sweeps, Passing, Escapes, Submissions, Takedowns), training streak, current focus techniques, top mistake this month, **Log today's class** button |
| **Map** | Skill tree of positions and techniques. Nodes are locked / learning / mastered. Tap a node to open the technique |
| **Log** | Class entries: date, rolling notes (the main field), techniques covered, mistakes. All classes are Gi and 2 hours, so there is no class type, duration or energy field |
| **Mistakes** | My mistakes (status: Open → Working on it → Fixed), analysis charts, common mistakes per technique |
| **Technique page** | Steps, key details, common mistakes + fixes, YouTube / Instagram Reels links, my notes, mastery level, times hit in rolling |

### Progress rules

**Technique mastery levels**

| Level | Name | Meaning |
|---|---|---|
| 0 | Not started | Not seen yet |
| 1 | Seen | Shown in class or watched |
| 2 | Drilled | Drilled with a cooperative partner |
| 3 | Hit in rolling | Landed it in sparring at least once |
| 4 | Hit on resisting partners | Landed it repeatedly against resistance |
| 5 | Mastered | Reliable; can teach it |

No XP, player levels or achievements: progress is shown by technique mastery, stats and the training streak.

- **Stats:** each stat (Guard, Sweeps, …) = sum of mastery levels of techniques in that category, scaled 0–10 against the most it could hold (every technique Mastered). A stat with no techniques is 0.
- **Unlocks:** a technique is **locked** until all of its prerequisites reach **Drilled**. Locked is shown alongside the mastery level, not as a level: a locked technique can still be Seen in class.
- **Logging raises mastery:** a technique logged as taught goes to at least Seen, drilled to at least Drilled, hit in rolling to at least Hit in rolling. It never lowers a level; levels 4 and 5 are set by hand.
- **Streak:** consecutive weeks (Monday to Sunday) with at least one logged class. The current week counts as in progress, so the streak is kept until a week ends without a class.
- **Top mistake this month:** the most frequent not-yet-fixed mistake this month, grouped by technique (or position) and category.
- **Belt:** set manually. The app never promotes you.

---

## 2. Architecture

```
 Phone / Laptop (PWA)
        │  HTTPS
        ▼
 ┌──────────────────┐      ┌───────────────────────┐
 │ Frontend         │      │ Backend               │
 │ React + TS + Vite│ ───▶ │ FastAPI (Python)      │
 │ Tailwind         │ JWT  │ stats / unlocks       │
 │ React Flow       │      │ mistake analysis      │
 │ Recharts         │      │ SQLAlchemy + Alembic  │
 └──────────────────┘      └──────────┬────────────┘
        │ login                       │ SQL
        ▼                             ▼
 ┌─────────────────────────────────────────────────┐
 │ Supabase: Auth (one account) + Postgres         │
 └─────────────────────────────────────────────────┘
```

- **Supabase** provides login and the Postgres database only. All business logic lives in FastAPI.
- The frontend signs in with Supabase Auth and sends the Supabase JWT to FastAPI, which verifies it and checks the user id against `OWNER_USER_ID`.
- The database is accessed through SQLAlchemy, so moving off Supabase later means changing a connection string.

### Repository layout

```
bjj-journal/
├── frontend/            React + TypeScript app (PWA)
│   └── src/
│       ├── api/         typed API client (generated from OpenAPI)
│       ├── features/    home, map, log, mistakes, techniques
│       └── components/  shared UI (belt, stat bars, cards)
├── backend/             FastAPI app
│   ├── app/
│   │   ├── api/         routers
│   │   ├── models/      SQLAlchemy models
│   │   ├── schemas/     Pydantic schemas
│   │   ├── services/    stats, unlocks, analysis
│   │   └── seed/        starting techniques (YAML)
│   ├── alembic/         migrations
│   └── tests/
├── docker-compose.yml   local Postgres + backend + frontend
├── ROADMAP.md
└── README.md
```

### Hosting (free tiers)

| Part | Host |
|---|---|
| Frontend | Vercel |
| Backend | Render (or Fly.io) |
| Database + Auth | Supabase |

Alternative if running on a personal VPS: the same `docker-compose.yml` with a reverse proxy (Caddy) for HTTPS.

---

## 3. Data model

```
profile          id (single row), belt, stripes (0–4), focus_technique_ids[] (max 5), created_at
position         id, name, category (guard/top/bottom/standing/back), description
technique        id, name, type (pull/sweep/submission/pass/escape/takedown/entry/control),
                 stat (guard/sweeps/passing/escapes/submissions/takedowns),
                 from_position_id, to_position_id, steps[], key_details[],
                 mastery (0–5), times_hit, notes, gi_only
technique_prereq technique_id, prereq_id
video_link       id, technique_id, url, source (youtube/instagram/other), title, start_seconds
common_mistake   id, technique_id, title, why_it_happens, fix
class_session    id, date, rolling_notes, created_at
session_technique session_id, technique_id, kind (taught/drilled/hit_in_rolling)
my_mistake       id, session_id, technique_id?, position_id?, category
                 (posture/grips/timing/hook retention/defense/other),
                 description, status (open/working/fixed), fixed_at
```

Every class is a 2-hour Gi class, so `class_session` has no type, duration or energy; totals such as mat time are `classes × 2 h`.

---

## 4. Phases

Each phase ends with something usable and deployed-ready. Check boxes are updated as work lands.

### Phase 0 — Foundations
- [x] Monorepo scaffold: `frontend/` (Vite + React + TS + Tailwind) and `backend/` (FastAPI + uv)
- [x] `docker-compose.yml` with local Postgres; `make dev` starts everything
- [x] Linting and formatting: ESLint + Prettier, Ruff + mypy
- [x] Tests: Vitest (frontend), pytest (backend)
- [x] GitHub Actions CI: lint, type-check, test on every push
- [x] `.env.example` files and README setup steps

**Done when:** `make dev` opens a hello page that calls `/health` on the API, and CI is green.

### Phase 1 — Technique library
- [x] Database models + Alembic migrations for positions, techniques, prereqs, video links, common mistakes
- [x] CRUD API for techniques and positions
- [x] Seed data loader (YAML → database)
- [x] Seed content (see section 5)
- [x] Technique list (filter by position, type, mastery) and technique page
- [x] YouTube and Instagram Reels links: YouTube embeds inline, Reels open in the Instagram app
- [x] Edit notes, steps and mastery level from the technique page

**Done when:** all seed techniques are browsable and editable on a phone-sized screen.

### Phase 2 — Auth and deployment
- [ ] Supabase project: Postgres + Auth (email + password, sign-ups disabled). Steps in [docs/DEPLOY.md](docs/DEPLOY.md)
- [x] FastAPI verifies the Supabase JWT and enforces `OWNER_USER_ID`
- [x] Frontend login screen and session handling
- [x] Deploy config: `render.yaml` (backend), `frontend/vercel.json`, migrations run on deploy (Alembic)
- [ ] First deploy to Render and Vercel
- [x] PWA: manifest, icons, installable on iOS and Android

**Done when:** the app is live at a public URL, only the owner can sign in, and it installs on the phone's home screen.

Deploying this early means every later phase can be used after class straight away.

### Phase 3 — Class log and mistakes
- [x] Class session API + "Log today's class" form, built for under 2 minutes on a phone
- [x] Pick techniques covered (taught / drilled / hit in rolling) with quick search
- [x] Add my mistakes inline in the log, linked to a technique or position
- [x] Mistakes list with status changes: Open → Working on it → Fixed
- [x] Class history with edit and delete
- [x] Offline draft: a half-filled log survives losing signal in the gym

**Done when:** a full class can be logged on the phone in under 2 minutes, mistakes included.

### Phase 4 — Progress and Home
- [x] Stats calculation and weekly streak
- [x] Unlock rules from prerequisites
- [x] Home screen: belt & stripes, classes and mat time, stats, streak, focus techniques, top mistake, log button
- [x] Unit tests for every stats and unlock rule

**Done when:** logging a class updates the stats and streak on Home, and raising a technique to Drilled unlocks the next one.

### Phase 5 — Skill tree map
- [ ] Map API: positions as groups, techniques as nodes, prerequisites as edges
- [ ] React Flow map with locked / learning / mastered states
- [ ] Auto-layout (dagre/elk), pinch-zoom and pan on phone
- [ ] Tap a node → technique page; filter by tree (Guard pulls, DLR, Closed guard, Escapes)
- [ ] Highlight current focus techniques

**Done when:** the DLR tree reads clearly on a phone and reflects real mastery levels.

### Phase 6 — Mistake analysis
- [ ] Analysis API: frequency by category, by technique, by position, over time
- [ ] Charts: top mistakes this month, mistakes per class over time, fixed vs open
- [ ] "Recurring" flag: same mistake 3+ times in the last 5 classes
- [ ] Links from a recurring mistake to the matching common-mistake fix and videos
- [ ] Monthly summary card on Home

**Done when:** the Mistakes tab answers "what do I keep getting wrong, and is it getting better?"

### Phase 7 — Polish
- [ ] Training calendar heatmap
- [ ] Data export (JSON / CSV) and backup
- [ ] Dark mode
- [ ] Search across techniques, notes and mistakes
- [ ] Performance and accessibility pass

### Later ideas (not scheduled)
- Upload own training clips (Supabase Storage)
- Competition log
- Spaced-repetition review of techniques ("revisit this week")
- AI summary of the month's notes and mistakes
- No-gi tag and techniques

---

## 5. Seed content

Gi techniques, matched to a 1-stripe white belt focusing on guard pulling and De La Riva. Each comes with steps, key details and 2–4 common mistakes.

**Guard pulls**
- Sit-down guard pull (to closed guard)
- Collar-sleeve guard pull
- Pull to De La Riva

**De La Riva tree**
- DLR hook entry and retention
- DLR grips: collar-sleeve, sleeve-ankle, belt
- Tripod sweep
- Sickle sweep
- DLR to back take — *locked at start*
- Berimbolo — *locked, long-term goal*

**White belt fundamentals**
- Closed guard posture break
- Scissor sweep
- Hip bump sweep
- Armbar from closed guard
- Cross-collar choke from closed guard
- Mount escape: trap and roll (upa)
- Mount escape: elbow-knee
- Side control escape: shrimp to guard

**Example common mistakes**
- DLR: hook too shallow, no control of the far sleeve, sitting flat on the butt, letting the opponent's knee drop inside
- Guard pull: pulling without grips, landing flat on the back, leaving the foot on the mat in front of the opponent
- Closed guard: crossing ankles too low, no posture break before attacking

---

## 6. Milestones

| Milestone | Phases | Outcome |
|---|---|---|
| **M1 — Library** | 0, 1 | Technique library runs locally |
| **M2 — On my phone** | 2 | Live online, installable, login protected |
| **M3 — Training journal** | 3 | Log classes and mistakes after training |
| **M4 — Progress** | 4, 5 | Stats, streak, unlocks, skill tree map |
| **M5 — Insight** | 6, 7 | Mistake analysis and polish |
