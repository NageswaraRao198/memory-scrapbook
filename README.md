# The Memory Scrapbook

A private, single-owner personal diary and self-reflection website with a warm scrapbook look.
Write freely, record how you feel, watch a Mood Garden grow, keep meaningful moments in Memory Lane,
and revisit it all later. No streaks, no scores, no public sharing.

> Photo and file attachments are intentionally **not included yet** (see [Roadmap](#roadmap)).

## What is in the box

| Area | What you get |
| --- | --- |
| **Welcome / sign-in** | First-run setup creates the single owner account (no public registration). Sign-in needs email, password **and a 6-digit PIN** that browsers are told not to save, so a saved password alone cannot open your diary. Server-side sessions, `HttpOnly` + `SameSite=Strict` cookies, CSRF token, rate-limited login, sliding session expiry. |
| **Home** | Greeting, today's prompt, quick mood check-in, recent pages, "On this day" (only when a real past entry exists), a reflection question. |
| **My Diary** | Distraction-free-capable Markdown editor with debounced **autosave**, visible save status, retry on failure, local safety copy, leave-page protection, draft handling. Archive grouped by month, **calendar view**, search, filters (date range, feeling, emotion tag, context tag), sort, "show more". |
| **Mood Garden** | Each recorded feeling becomes a flower (colour = feeling, petals = intensity). Month view, day details linked to diary pages, and gentle, non-diagnostic observations that only appear once there is enough data. |
| **Memory Lane** | Polaroid-style timeline with title, date, story, place, people, tags and optional link to a diary page. Filter by year, tag/person, search. |
| **Reflections** | Daily prompt, weekly, monthly, "what did I learn?", "what am I carrying?", and sealed **letters to your future self**. Everything is skippable. |
| **Settings & Privacy** | Name, theme (light / dark / system), editor mode, change password, JSON / Markdown export, AI opt-in flag, delete everything (typed confirmation). |

AI is **optional and off**: no AI provider is connected, nothing is sent to any external service,
and the setting only records your preference for a possible future phase.

## Architecture (short version)

```
client/   React 18 + TypeScript (strict) + Vite + Tailwind CSS 4 + React Router 6
server/   Node.js + Express 5 + TypeScript, REST API under /api/v1, Zod validation
          PostgreSQL (hosted, e.g. Neon, via `pg`); embedded Postgres (PGlite) for local dev and tests
```

Why Postgres instead of MongoDB? It is free to host (Neon), durable, and keeps the app's relational data
(entries, linked moods, memories) consistent. The same SQL runs against the hosted database in production and
against an embedded Postgres locally, so `npm run dev` needs no setup.
Every table still carries an `ownerId`, and **every query is scoped to the signed-in owner on the
server**.

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

Requirements: **Node.js 22+** (24 recommended) and npm. No database install needed for local development.

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
| `DATABASE_URL` | unset | Postgres connection string (Neon). **Required in production.** If unset in development, an embedded Postgres is stored in `server/data/pglite` |
| `CLIENT_ORIGIN` | Vite dev origins | Extra origins allowed to send state-changing requests |
| `SESSION_TTL_DAYS` | `14` | Sliding session lifetime |
| `TRUST_PROXY` | `false` | Set `true` behind a TLS-terminating reverse proxy |
| `COOKIE_SECURE` | `true` in production | `Secure` flag on the session cookie |
| `SETUP_TOKEN` | unset | If set, first-run account creation requires this code (set it on any public deployment) |

## Deployment

### Render (free web service + free Neon Postgres)

Your diary lives in Neon, so Render's free plan (which has no persistent disk and sleeps when idle) is enough
and your entries survive sleeps and redeploys.

1. **Neon**: create a free project at neon.com, copy the connection string (it ends in `?sslmode=require`).
2. **Render**: New > Web Service > this repo. Build `npm ci --include=dev && npm run build`, start `npm start`,
   instance type **Free**, health check path `/api/v1/health`.
3. Environment variables: `NODE_VERSION=24`, `NODE_ENV=production`, `TRUST_PROXY=true`,
   `DATABASE_URL=<your Neon string>`, `SETUP_TOKEN=<a long random string>`.
4. Open the service URL, create your account on the first screen using the setup code.

(The [render.yaml](./render.yaml) Blueprint describes the same service; you must fill in `DATABASE_URL` in the dashboard.)
Free instances sleep after ~15 minutes idle, so the first visit afterwards takes ~30-60 seconds.

### Any other host

1. `npm ci --include=dev && npm run build` (the build needs dev dependencies even when `NODE_ENV=production`)
2. Run `NODE_ENV=production DATABASE_URL=... node server/dist/server.js` (or `npm start`) behind HTTPS
   (Caddy, nginx, a cloud load balancer...) with `TRUST_PROXY=true`. The server serves the built client itself,
   so the app is a single origin.

Do not rely on an obscure URL for privacy: sign-in and server-side authorization protect every private route.

## Backups

- Neon keeps a short history of your database automatically (point-in-time restore from its console; the
  window depends on your Neon plan).
- Settings & Privacy > *Export as JSON* is your own portable backup. Download one now and then and store it
  somewhere safe; it contains your diary but not your password.
- The Markdown export is a readable copy of your writing.

## Testing

- `server/tests`: authentication, CSRF/origin protection, session expiry, validation, CRUD, search/filter,
  mood sync, **ownership isolation between two owners**, export, deletion, and an API-level
  journey (sign in, write, mood, revisit, export).
- `client/src/**/*.test.*`: autosave debounce/serialisation, failure and retry, safety-copy recovery, finishing
  entries, archive search/filter/empty states, mood check-in, date and text helpers.
- Manual accessibility and responsive checks: [docs/accessibility-checklist.md](./docs/accessibility-checklist.md).

## Roadmap

- **Attachments / photos** for entries and memories (private storage adapter with generated keys, ownership
  checks, type and size validation). The data model and UI are ready to receive them.
- **Optional AI** behind a provider interface, strictly opt-in, grounded in the user's own entries with citations.
- Browser end-to-end suite (Playwright).
