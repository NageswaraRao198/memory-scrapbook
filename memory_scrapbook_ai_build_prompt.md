# AI Build Prompt --- The Memory Scrapbook

## A private, emotionally rich personal diary and self-reflection website

Copy the prompt below into your AI coding assistant (GitHub Copilot,
Cursor, Claude Code, or another agentic coding tool). Ask it to work in
small, verifiable phases rather than generating the entire application
at once.

------------------------------------------------------------------------

# MASTER BUILD PROMPT

You are a senior product designer, UX engineer, and full-stack
architect. Help me design and build a polished, private, personal diary
website called **The Memory Scrapbook**.

This is a personal project for one user. It is not a public social
network, not a multi-user journaling SaaS, and not a productivity
dashboard. Its main purpose is to help me capture my feelings,
understand emotional patterns, revisit meaningful memories, and reflect
on how I change over time.

Build an experience that feels like opening a beautiful, personal
scrapbook: warm, nostalgic, calm, tactile, intimate, and thoughtfully
crafted.

## 1. Product vision

Create a private digital sanctuary where I can: - Write freely about my
day, feelings, worries, hopes, and random thoughts. - Record my mood and
emotional intensity without feeling judged. - Notice recurring emotional
patterns over weeks and months. - Preserve photographs, meaningful
moments, and small details. - Revisit previous entries and see what
mattered to me at different points in life. - Complete gentle reflection
exercises that encourage self-understanding.

The product should encourage honest writing, not streaks, pressure, or
perfection. Never shame the user for missing days.

### Product principles

1.  **Private by default:** Only the owner can access the diary.
2.  **Writing comes first:** The editor must be comfortable,
    distraction-free, and autosaving.
3.  **Emotion without judgement:** Mood labels are descriptive, not
    diagnoses.
4.  **Reflection over metrics:** Visual summaries should help the user
    understand themselves, not grade their mental state.
5.  **Nostalgia and warmth:** Use scrapbook details tastefully, without
    making the interface cluttered.
6.  **User control:** The owner can export, back up, edit, and
    permanently delete their data.
7.  **AI is optional:** Core diary functionality must work without AI or
    an external AI provider.

## 2. Visual direction and design system

### Creative direction: The Memory Scrapbook

Create a warm, nostalgic scrapbook aesthetic inspired by: - Cream,
parchment, warm beige, muted terracotta, dusty rose, sage, and faded
olive. - Polaroid-like photo frames, paper cards, subtle tape and paper
textures, handwritten annotations, date stamps, and delicate dividers. -
Elegant editorial typography paired with a readable body font. - Soft
shadows, gentle rounded corners, subtle grain, and restrained motion. -
A calm, spacious layout that feels personal rather than corporate.

Avoid: - Generic admin dashboards. - Excessive glassmorphism, neon
gradients, or saturated colors. - Too many cards, charts, badges, or
decorative elements. - Childish scrapbook visuals or visual clutter. -
Gamification, streak pressure, leaderboards, or social engagement
patterns.

### Suggested design tokens

Treat these as starting points and refine them consistently: -
Background: warm ivory / paper cream (`#F6F1E8`). - Primary surface:
soft paper (`#FFFCF6`). - Main text: deep warm charcoal (`#332F2A`). -
Secondary text: muted brown-gray (`#81786D`). - Accent: muted terracotta
(`#B96F59`). - Secondary accent: dusty rose (`#C99591`). - Calm accent:
sage (`#879783`). - Borders: soft sand (`#E7DED1`).

Use CSS variables or a centralized theme system. Ensure text contrast
and accessible focus states. Support responsive layouts and a dark mode
only if it can be implemented without compromising the main visual
identity.

### Typography

Use an expressive serif for prominent headings and a highly readable
sans-serif for interface text. Handwritten fonts may be used sparingly
for small annotations, never for long-form diary content. Use locally
bundled or reliable font loading with sensible fallbacks.

### Interaction style

-   Subtle transitions, around 150--250ms for ordinary interactions.
-   Small tactile hover states for buttons and scrapbook objects.
-   Respect `prefers-reduced-motion`.
-   Make all interactions keyboard accessible.
-   Never make animation delay writing or saving.

## 3. Information architecture and navigation

Use a simple left sidebar on desktop and a compact mobile navigation
pattern.

Primary sections: 1. **Home** --- a gentle welcome, today's writing
prompt, recent entries, and a small reflection. 2. **My Diary** ---
create, browse, search, edit, and filter entries. 3. **Mood Garden** ---
a visual history of moods and emotional patterns. 4. **Memory Lane** ---
a chronological, photo-friendly timeline of meaningful moments. 5.
**Reflections** --- guided prompts, weekly reflections, and monthly
reviews. 6. **Settings & Privacy** --- security, appearance, data
export, backups, and deletion.

Keep navigation labels human and warm. Do not overwhelm the user with
every feature at once.

## 4. Required screens and detailed behavior

### Screen A --- Welcome and authentication

-   Provide a calm welcome screen that explains the site is a private
    personal space.
-   Support secure sign-in for the owner.
-   Since this is a personal private app, do not add public registration
    or social login unless there is a clear implementation reason.
-   Use secure, server-managed sessions or another established
    authentication approach.
-   Include sign-out and session expiration behavior.
-   Do not store passwords in plaintext or place secrets in frontend
    code.

### Screen B --- Home

The home screen should feel like the first page of a personal journal.

Include: - A warm greeting and today's date. - A prominent **Write
today's entry** action. - A short optional writing prompt, such as "What
stayed with you today?" - A compact mood check-in. - A few recent
entries displayed as paper snippets or photo memories. - A small "On
this day" memory, only when a real past entry exists for that date. - A
gentle reflection card, such as a question to consider.

Do not invent diary content. Empty states should be warm and
encouraging.

### Screen C --- Diary editor

This is the most important screen. Prioritize the writing experience.

Fields: - Entry title (optional). - Entry body (required only if the
user chooses to save a written entry). - Date and time, defaulting to
now; allow editing. - Mood selection (optional). - Emotion tags
(optional, multiple). - Emotional intensity (optional, e.g. 1--5). -
Context tags (optional, such as work, family, friendship, health,
personal growth). - Attachments (optional photos; support additional
attachment types only if implemented safely). - "What happened?" and
"How did it make me feel?" prompts may be offered as optional writing
scaffolds, but never force a template.

Editor behavior: - Autosave drafts with a visible status: "Saving...",
"Saved", or a clear error with retry. - Debounce autosave and protect
against data loss when navigating away. - Allow manual save. - Preserve
line breaks and formatting. - Support Markdown or a restrained rich-text
editor; choose one and implement it consistently. - Allow editing and
deleting entries with confirmation for destructive actions. - Provide a
distraction-free writing mode. - Do not impose a minimum word count. -
Avoid showing streaks or warnings for days without entries.

### Screen D --- Diary archive and calendar

Provide two complementary ways to revisit entries: - A chronological
list grouped by month. - A calendar view with subtle indicators on dates
that contain entries.

Features: - Search entry titles and body text. - Filter by date range,
mood, emotion tag, and context tag. - Sort newest/oldest. - Open an
entry in a readable detail view. - Edit or delete from the detail
view. - Use pagination or incremental loading for larger collections. -
Make empty search results helpful and easy to clear.

### Screen E --- Mood Garden

Make emotional tracking feel expressive and gentle rather than clinical.

Concept: - Each day with a mood check-in can contribute a small visual
element to a garden or scrapbook illustration. - Use a restrained,
consistent palette for mood categories. - Clicking a day or visual
element opens the corresponding mood check-in and linked diary entry, if
one exists. - Include a simple timeline or calendar for reviewing mood
history.

Suggested initial mood choices: - Happy - Peaceful - Grateful -
Excited - Content - Tired - Anxious - Sad - Frustrated - Overwhelmed -
Confused - Other / prefer not to say

Allow the user to choose a custom label later if practical. Mood is
optional and can be mixed or hard to name.

Tracking: - Optional intensity from 1 to 5. - Optional emotion tags. -
Optional note about what influenced the mood. - Allow more than one
emotion to be recorded when appropriate.

Insights: - Show mood distribution over a selected period only when
enough data exists. - Show recurring tags and gentle observations, not
definitive psychological conclusions. - Clearly distinguish recorded
data from AI-generated interpretations. - Never diagnose, predict mental
illness, or claim to know why the user feels a certain way. - Avoid
red/green "good vs bad" framing.

### Screen F --- Memory Lane

Create a chronological, visual timeline for moments worth keeping.

A memory can include: - Title. - Date. - Short description or story. -
One or more photographs. - Optional location label (user-entered; do not
collect location automatically). - People labels or custom tags, if the
user wants them. - Optional link to a diary entry.

Display memories as a scrapbook timeline with photo frames and short
captions. Support filters by year, tag, and date. Provide a pleasant
empty state.

### Screen G --- Reflections

Offer gentle, optional reflection tools.

Include: - Daily prompt suggestions. - Weekly reflection. - Monthly
reflection. - A "write a letter to my future self" exercise. - A "what
did I learn?" exercise. - A "what am I carrying with me?" exercise.

Example prompts: - What moment from today do I want to remember? - What
felt heavier than I expected? - What gave me a little energy? - What did
I need today? - What am I proud of, even if it seems small? - Is there
something I want to let go of? - What would I tell a friend who felt the
way I do?

Reflections should be saved as private entries or reflection records.
The user should be able to skip any prompt.

### Screen H --- Settings and privacy

Include: - Change password or manage authentication. - Sign out. -
Light/dark appearance preference if supported. - Export all entries and
memories in a portable format (JSON and/or Markdown; include attachment
references or files in a complete export). - Backup guidance and a way
to download a backup. - Permanently delete an entry, memory, or all
account data with explicit confirmation. - Explain where data is stored
and whether any external AI service receives content. - A setting to
disable AI features entirely.

## 5. AI features --- optional, privacy-aware, and secondary

Do not make AI necessary for the core experience. Build the app so AI
can be added behind a provider interface.

Potential features for a later phase: 1. **Reflection companion:** The
user asks questions about their own past entries. 2. **Monthly
reflection draft:** Summarize recurring themes, meaningful moments, and
self-reported moods from a chosen month. 3. **Memory resurfacing:** Find
a relevant past entry when the user asks about a date, person label, or
theme. 4. **Writing prompts:** Suggest a prompt based on user-selected
preferences, not hidden psychological profiling.

AI safety and privacy requirements: - Never send journal content to an
external service without clear, informed opt-in. - Explain which content
will be sent, to which provider, and for what purpose. - Do not use
diary content for model training. - Do not diagnose or provide
mental-health treatment. - Label generated summaries as AI-generated and
allow the user to edit or delete them. - Ground answers in retrieved
entries and show which entries informed the answer. - If there is
insufficient journal data, say so rather than inventing details. -
Provide a local-only or AI-disabled mode. - Keep AI API keys on the
server, never in the browser.

## 6. Technical architecture

Use this stack unless the existing repository requires a justified
alternative:

### Frontend

-   React
-   TypeScript with strict mode
-   Vite
-   Tailwind CSS
-   React Router
-   A reliable form and validation approach
-   A maintained editor library or Markdown editor
-   Accessible component primitives
-   Framer Motion only for subtle, purposeful transitions

### Backend

-   Node.js
-   Express
-   TypeScript
-   REST API with clear validation and error handling

### Database

-   MongoDB with Mongoose, or a well-justified equivalent.
-   Use indexes for owner ID, entry date, mood, and tags where
    appropriate.
-   Store timestamps consistently in UTC and display dates in the user's
    local timezone.
-   Store user-entered event dates separately from created/updated
    timestamps.

### File storage

-   Use private object storage or a secure local development storage
    adapter.
-   Do not expose public attachment URLs.
-   Validate file type and size.
-   Use generated storage keys rather than trusting uploaded filenames.
-   Enforce ownership checks for every attachment request.
-   Provide a clean storage abstraction so the provider can change
    later.

### Suggested project structure

``` text
memory-scrapbook/
  client/
    src/
      app/
      components/
      features/
        auth/
        home/
        diary/
        mood/
        memories/
        reflections/
        settings/
      hooks/
      lib/
      styles/
      types/
  server/
    src/
      config/
      middleware/
      modules/
        auth/
        entries/
        moods/
        memories/
        reflections/
        attachments/
        export/
      services/
      utils/
      app.ts
      server.ts
  shared/
    types/
    validation/
  docs/
  .env.example
  README.md
```

Adapt the structure if the project is smaller, but maintain clear
separation of concerns.

## 7. Database schema proposal

Design schemas with ownership, validation, timestamps, and indexes.
Adjust details as implementation requires.

### User

``` ts
{
  _id: ObjectId,
  email: string,
  passwordHash: string,
  displayName?: string,
  timezone: string,
  preferences: {
    theme: "light" | "dark" | "system",
    aiEnabled: boolean,
    defaultEditorMode: "distraction-free" | "standard"
  },
  createdAt: Date,
  updatedAt: Date
}
```

### DiaryEntry

``` ts
{
  _id: ObjectId,
  ownerId: ObjectId,
  title?: string,
  body: string,
  bodyFormat: "markdown" | "plain-text",
  entryDate: Date,
  mood?: string,
  emotions: string[],
  intensity?: number, // 1 to 5
  contextTags: string[],
  attachmentIds: ObjectId[],
  isDraft: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### MoodCheckIn

``` ts
{
  _id: ObjectId,
  ownerId: ObjectId,
  recordedAt: Date,
  mood: string,
  emotions: string[],
  intensity?: number, // 1 to 5
  note?: string,
  linkedEntryId?: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### Memory

``` ts
{
  _id: ObjectId,
  ownerId: ObjectId,
  title: string,
  description?: string,
  memoryDate: Date,
  attachmentIds: ObjectId[],
  tags: string[],
  peopleLabels: string[],
  locationLabel?: string,
  linkedEntryId?: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### Reflection

``` ts
{
  _id: ObjectId,
  ownerId: ObjectId,
  type: "daily" | "weekly" | "monthly" | "future-letter" | "custom",
  title?: string,
  prompt?: string,
  response: string,
  periodStart?: Date,
  periodEnd?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Attachment

``` ts
{
  _id: ObjectId,
  ownerId: ObjectId,
  storageKey: string,
  originalName: string,
  mimeType: string,
  sizeBytes: number,
  createdAt: Date
}
```

Important schema decisions: - Every user-owned document must include
`ownerId`. - Every read, update, delete, and attachment operation must
enforce ownership on the server. - Never rely on frontend filtering as
an authorization boundary. - Add indexes for common queries, such as
`{ ownerId: 1, entryDate: -1 }`. - Decide whether a mood check-in is
independent or embedded in an entry; avoid accidental duplicate
records. - Use soft deletion only if there is a clear recovery
requirement. Otherwise, implement clear permanent deletion semantics. -
Validate all incoming data on the server.

## 8. API outline

Create a versioned REST API, for example `/api/v1`.

Potential endpoints:

``` text
POST   /auth/login
POST   /auth/logout
GET    /auth/me

POST   /entries
GET    /entries
GET    /entries/:id
PATCH  /entries/:id
DELETE /entries/:id

POST   /mood-checkins
GET    /mood-checkins
GET    /mood-checkins/summary
PATCH  /mood-checkins/:id
DELETE /mood-checkins/:id

POST   /memories
GET    /memories
GET    /memories/:id
PATCH  /memories/:id
DELETE /memories/:id

POST   /reflections
GET    /reflections
PATCH  /reflections/:id
DELETE /reflections/:id

POST   /attachments
GET    /attachments/:id
DELETE /attachments/:id

GET    /export
DELETE /account/data
```

Requirements: - Validate route parameters, query parameters, and request
bodies. - Use consistent error response shapes. - Apply authentication
and ownership middleware. - Add pagination and safe filtering. -
Rate-limit authentication endpoints. - Do not log diary bodies,
passwords, tokens, or attachment contents. - Avoid exposing internal
stack traces to the client.

## 9. Security and privacy requirements

Treat this as sensitive personal writing.

Implement: - HTTPS in production. - Secure, HttpOnly, SameSite cookies
for session credentials where applicable. - CSRF protection when using
cookie-based authentication. - Strong password hashing with a modern
password-hashing algorithm. - Rate limiting and login abuse
protection. - Server-side authorization on every private resource. -
Input validation and output encoding. - Secure CORS configuration. -
Environment variables for secrets; commit only `.env.example`. - No
diary content in analytics, telemetry, error logs, or third-party
scripts. - Private attachment storage and safe upload validation. - Data
export and deletion. - Regular backup guidance and a tested restore
process.

If this app is hosted publicly, do not assume an obscure URL makes it
private. Authentication and authorization are mandatory.

For a single-user deployment, still use an owner identity and enforce
ownership checks. Do not hardcode a secret password in the frontend.

## 10. UX details and content tone

Use gentle, human language: - "Would you like to write a little
today?" - "There is no right way to feel." - "A moment worth keeping." -
"You can come back to this whenever you're ready." - "Your garden will
grow at its own pace."

Avoid: - "You missed your streak." - "Your mood score is low." - "You
failed to journal." - Any language that treats emotions as performance.

Every screen must include: - Loading state. - Empty state. - Error state
with a recovery action. - Success feedback where appropriate. - Keyboard
and screen-reader accessibility. - Responsive behavior.

## 11. Testing and quality expectations

Create: - Unit tests for validation, date handling, mood summaries, and
business logic. - API integration tests for authentication, ownership,
CRUD, export, and deletion. - Frontend tests for the diary editor,
autosave, filters, and mood check-in. - End-to-end tests for the main
journey: sign in → write entry → add mood → revisit entry → export
data. - Tests proving one owner cannot access another owner's entries or
attachments. - Tests for autosave failures and recovery. - A manual
accessibility and responsive-layout checklist.

Do not mark a feature complete merely because the page renders. Verify
its full behavior.

## 12. Implementation roadmap

Work in the following phases. At the end of each phase, run tests,
report what changed, list known issues, and wait for my approval before
starting the next phase.

### Phase 0 --- Discovery and foundation

-   Inspect the repository and existing tooling before changing files.
-   Propose architecture and dependencies.
-   Create the project structure and design tokens.
-   Add environment configuration and README.
-   Establish linting, formatting, and test commands.

### Phase 1 --- Visual shell and navigation

-   Build the scrapbook design system.
-   Implement responsive app shell, sidebar, mobile navigation, and home
    screen.
-   Use realistic but clearly labeled sample content only for
    development.
-   Ensure the interface feels polished before adding every backend
    feature.

### Phase 2 --- Authentication and private data foundation

-   Implement secure owner authentication.
-   Connect the database.
-   Add server-side authorization and validation.
-   Add integration tests for private data access.

### Phase 3 --- Diary core

-   Implement diary creation, editing, deletion, autosave, archive,
    calendar, search, and filters.
-   Test draft recovery and ownership.
-   Prioritize editor quality and mobile writing.

### Phase 4 --- Mood tracking and Mood Garden

-   Implement mood check-ins, emotion tags, intensity, history, and
    summaries.
-   Build the visual Mood Garden.
-   Ensure insights are descriptive and never diagnostic.

### Phase 5 --- Memory Lane and Reflections

-   Implement memories, private attachments, timeline, reflection
    prompts, and saved reflections.
-   Add data export support for these records.

### Phase 6 --- Privacy, backup, and hardening

-   Complete export and deletion flows.
-   Review logs, secrets, cookies, uploads, access controls, and error
    handling.
-   Test backup and restore instructions.
-   Complete responsive and accessibility checks.

### Phase 7 --- Optional AI

Only after the core product is stable: - Add an AI provider
abstraction. - Start with a local model if practical. - Require explicit
opt-in before external processing. - Implement grounded retrieval and
citations to the user's own entries. - Add AI-generated monthly
reflections as editable drafts.

## 13. How I want you to work as my coding agent

Follow these working rules: 1. First inspect the repository. Do not
overwrite existing work or assume it is empty. 2. Before coding, give me
a concise architecture proposal, screen map, and phased task list. 3.
Ask only essential questions. Make sensible, documented defaults for
nonessential details. 4. Implement one phase at a time. 5. Make small,
coherent changes rather than generating a huge unreviewable code dump.
6. Explain important design and architecture decisions in
beginner-friendly language. 7. After each phase, run relevant tests,
type checks, and linting; fix failures before proceeding. 8. Keep the
README current with setup, environment variables, scripts, and
deployment instructions. 9. Never claim a feature works unless you have
run or otherwise verified it. 10. Do not add unnecessary dependencies.
11. Do not add public sharing, social feeds, comments, likes, or
multi-user features. 12. Keep the visual quality high: avoid generic
scaffolding and unfinished placeholder screens. 13. If a requirement
conflicts with security or privacy, explain the issue and propose the
safer implementation. 14. Stop after the current phase and ask for my
approval before moving on.

## 14. Definition of done

The first complete release is ready when I can: - Sign in securely to my
private diary. - Write, edit, autosave, search, filter, and delete
entries. - Record optional moods and emotions. - View my emotional
history in the Mood Garden. - Save photographs and meaningful memories
in Memory Lane. - Complete and revisit personal reflections. - Export my
data and understand how to back it up. - Use the app comfortably on
desktop and mobile. - Trust that private entries and attachments are
protected by server-side authorization.

The result should feel less like software I have to maintain and more
like a beautiful personal space I want to return to.

------------------------------------------------------------------------

# FIRST TASK FOR THE AI CODING AGENT

Do not start implementing the entire application yet.

1.  Inspect my current project folder and identify the existing stack,
    files, and scripts.
2.  Tell me whether the project is empty or already has an
    implementation.
3.  Propose the architecture and the smallest sensible MVP.
4.  Show the planned screens and navigation.
5.  Identify security and privacy decisions that need to be made early.
6.  Break Phase 0 and Phase 1 into small tasks.
7.  Then wait for my approval before making changes.

**Start by inspecting the repository.**
