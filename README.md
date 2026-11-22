# The Memory Scrapbook

A private, single-owner personal diary and self-reflection website with a warm scrapbook look.
Write freely, record how you feel, watch a Mood Garden grow, keep meaningful moments in Memory Lane,
and revisit it all later. No streaks, no scores, no public sharing.

> Photo and file attachments are intentionally **not included yet** (see [Roadmap](#roadmap)).

## What is in the box

| Area | What you get |
| --- | --- |
| **Welcome / sign-in** | First-run setup creates the single owner account (no public registration). Server-side sessions, `HttpOnly` + `SameSite=Strict` cookies, CSRF token, rate-limited login, sliding session expiry. |
| **Home** | Greeting, today's prompt, quick mood check-in, recent pages, "On this day" (only when a real past entry exists), a reflection question. |
| **My Diary** | Distraction-free-capable Markdown editor with debounced **autosave**, visible save status, retry on failure, local safety copy, leave-page protection, draft handling. Archive grouped by month, **calendar view**, search, filters (date range, feeling, emotion tag, context tag), sort, "show more". |
| **Mood Garden** | Each recorded feeling becomes a flower (colour = feeling, petals = intensity). Month view, day details linked to diary pages, and gentle, non-diagnostic observations that only appear once there is enough data. |
| **Memory Lane** | Polaroid-style timeline with title, date, story, place, people, tags and optional link to a diary page. Filter by year, tag/person, search. |
| **Reflections** | Daily prompt, weekly, monthly, "what did I learn?", "what am I carrying?", and sealed **letters to your future self**. Everything is skippable. |
| **Settings & Privacy** | Name, theme (light / dark / system), editor mode, change password, JSON / Markdown export, full backup download, AI opt-in flag, delete everything (typed confirmation). |

AI is **optional and off**: no AI provider is connected, nothing is sent to any external service,
and the setting only records your preference for a possible future phase.

## Architecture (short version)

```
client/   React 18 + TypeScript (strict) + Vite + Tailwind CSS 4 + React Router 6
server/   Node.js + Express 5 + TypeScript, REST API under /api/v1, Zod validation
          SQLite via Node's built-in `node:sqlite` (one file, easy to back up)
```

Why SQLite instead of MongoDB? This is a personal, single-owner app. A single database file needs no
extra service, is trivial to back up and restore, and keeps the "your data lives here" story simple.
Every table still carries an `ownerId`, and **every query is scoped to the signed-in owner on the
server**. Data access sits behind small per-module routers, so swapping the store later is contained.

```
server/src/
  config/      environment loading
  db/          schema and connection
  middleware/  sessions, CSRF/origin checks, errors
  modules/     auth, entries, moods, memories, reflections, export
  utils/       password hashing (scrypt), validation helpers
client/src/
  app/         router and shell (sidebar / mobile tab bar)
  components/  scrapbook UI pieces (flowers, modals, states, tag input...)
  features/    home, diary, mood, memories, reflections, settings, auth
  lib/         API client, date helpers, mood palette
  styles/      design tokens (CSS variables) + Tailwind theme
```

### Key decisions

- **Mood check-ins** are independent records. A mood chosen inside a diary entry is kept in sync as exactly one
  linked check-in (so the garden never shows duplicates). Feelings that belong to an entry are edited from the entry.
- **Dates**: stored as UTC ISO strings; the user-entered entry date is separate from `createdAt`/`updatedAt`.
  The UI shows everything in the browser's local timezone.
- **Markdown** is the single body format. Rendering never enables raw HTML.
- **Privacy**: request bodies and queries are never logged (only `METHOD path status`); errors never leak stack traces.

## Getting started

Requirements: **Node.js 22.5+** (24 recommended) and npm.

```powershell
npm install
copy .env.example .env      # optional; sensible defaults exist
npm run dev                 # API on :4000, web app on http://localhost:5173
```

Open <http://localhost:5173>. The first visit asks you to create the owner account. After that the same
page is a normal sign-in.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start API (tsx watch) and Vite dev server together |
| `npm run build` | Type-check and build the client, compile the server |
| `npm start` | Run the compiled server (also serves `client/dist`) |
| `npm test` | Server (Vitest + Supertest) and client (Vitest + Testing Library) tests |
| `npm run typecheck` | `tsc --noEmit` in both workspaces |
| `npm run lint` | ESLint across the repo |
| `npm run format` | Prettier |

### Environment variables

See [.env.example](./.env.example).

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `4000` | API/web port |
| `DATABASE_PATH` | `server/data/scrapbook.db` | SQLite file |
| `CLIENT_ORIGIN` | Vite dev origins | Extra origins allowed to send state-changing requests |
| `SESSION_TTL_DAYS` | `14` | Sliding session lifetime |
| `TRUST_PROXY` | `false` | Set `true` behind a TLS-terminating reverse proxy |
| `COOKIE_SECURE` | `true` in production | `Secure` flag on the session cookie |
| `SETUP_TOKEN` | unset | If set, first-run account creation requires this code (set it on any public deployment) |

## Deployment

### Render (recommended: one service, one persistent disk)

The repo includes a [render.yaml](./render.yaml) Blueprint.

1. Push this project to a GitHub repository.
2. In Render: **New > Blueprint**, pick the repo, and approve the plan. It creates one Node web service with a
   1 GB persistent disk at `/var/data` (SQLite lives at `/var/data/scrapbook.db`).
3. Open the service > **Environment**, reveal `SETUP_TOKEN`, then visit your `https://<name>.onrender.com` URL.
   On the first screen, create your account and enter the setup code. After that the code is no longer used.
4. Use Settings > *Download a full backup* regularly (disks are not a backup).

Notes: a persistent disk needs a paid instance (Starter). On the free plan the database is wiped on every
restart. Use one instance only (a disk can't be shared), and expect a short pause on deploys.

### Any other host

1. `npm ci && npm run build`
2. Run `NODE_ENV=production node server/dist/server.js` (or `npm start`) behind HTTPS
   (Caddy, nginx, a cloud load balancer...) with `TRUST_PROXY=true`. The server serves the built client itself,
   so the app is a single origin.
3. Put `DATABASE_PATH` on persistent storage and back it up.

Do not rely on an obscure URL for privacy: sign-in and server-side authorization protect every private route.

## Backups and restore

- **Download a backup**: Settings & Privacy > *Download a full backup* (a consistent snapshot of the database file).
  It contains your diary and your sign-in details; store it somewhere encrypted.
- **Restore**: stop the server, replace the file at `DATABASE_PATH` with the backup (delete any
  `-wal` / `-shm` files beside it), start the server, and sign in with the credentials from the time of the backup.
- **Portable exports**: JSON and Markdown exports are for reading and moving your writing, not for restoring the app.

The backup endpoint is covered by an automated test (the file is a valid SQLite database).
Please also do one manual restore rehearsal on your own machine after your first real backup.

## Testing

- `server/tests`: authentication, CSRF/origin protection, session expiry, validation, CRUD, search/filter,
  mood sync, **ownership isolation between two owners**, export, backup, deletion, and an API-level
  journey (sign in, write, mood, revisit, export).
- `client/src/**/*.test.*`: autosave debounce/serialisation, failure and retry, safety-copy recovery, finishing
  entries, archive search/filter/empty states, mood check-in, date and text helpers.
- Manual accessibility and responsive checks: [docs/accessibility-checklist.md](./docs/accessibility-checklist.md).

## Roadmap

- **Attachments / photos** for entries and memories (private storage adapter with generated keys, ownership
  checks, type and size validation). The data model and UI are ready to receive them.
- **Optional AI** behind a provider interface, strictly opt-in, grounded in the user's own entries with citations.
- Browser end-to-end suite (Playwright).
