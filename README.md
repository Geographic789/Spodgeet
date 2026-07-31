# Spodgeet (สะโปดกรี้ด) — Trail Running Pace Planner

A คำผวน of "Speedgoat" · Built for trail runners who plan seriously.

## Stack
Next.js 14 · Supabase (Postgres + Auth) · Vercel · Leaflet · Recharts · Tailwind

---

## Setup

### 1. Supabase — run SQL files in order

In Supabase → SQL Editor, run each file from `supabase/`:

| File | When |
|---|---|
| `schema.sql` | First time only |
| `patch_phase4.sql` | After schema.sql |
| `patch_phase5.sql` | After phase4 patch |
| `seed_comments.sql` | After schema (populates roast comments) |

### 2. Environment variables

Copy `.env.local.example` → `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=      # Supabase Project Settings → API → Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Settings → API → Legacy anon key
SUPABASE_SERVICE_ROLE_KEY=     # Settings → API → Legacy service_role key
ADMIN_PASSWORD=                # Your chosen admin password
```

Same 4 vars go into Vercel → Project Settings → Environment Variables.

### 3. Run locally
```
npm install
npm run dev
```

### 4. Deploy
Push to GitHub → Vercel auto-deploys on every commit.

### 5. Keep Supabase alive (free tier)
Set up a free cron job at cron-job.org hitting:
`https://your-app.vercel.app/api/ping` — every 3 days keeps the DB from pausing.

---

## Features by phase

### Phase 1 — Admin & data model
- Race management (name, date, location, status)
- Distance management with official start time per distance
- GPX upload → auto-parses distance, elevation (calibrated to Suunto), gradient per point
- GPX waypoints auto-detected as aid stations (editable after creation)
- Aid stations: inline edit, delete, manual add when no GPX
- Mandatory gear list per distance
- Shared admin password (no individual accounts)

### Phase 2 — Map & elevation engine
- OpenTopoMap → CartoDB Positron base map (route colors pop clearly)
- Gradient-colored route: 🔴 Climb >8% · 🟠 Uphill 3–8% · 🔵 Flat ±3% · 🟢 Downhill -3 to -8% · 🟩 Descent <-8%
- Direction arrows along route every 2km
- START / FINISH label pins (combined if loop course)
- Aid station pins colored by cutoff status (red/amber/green)
- Hover/touch elevation chart → tracking marker moves on map simultaneously

### Phase 3 — Pacing engine
- Plan creation: pick race → distance (start time auto-fills) → name → finish time goal
- Engine back-calculates base pace from goal time
- Pacing table: Station · Cum km · Dist · ↑ · ↓ · Cum↑ · Pace · Leg time · Rest · Arrival · Cutoff · Buffer · Note
- Bidirectional editing: edit Pace → Leg time recalculates · edit Leg time → Pace recalculates
- Rest time per station — affects all arrival times downstream
- Domino cascade: change any row → all subsequent rows recalculate instantly
- 🔒 Manual lock per row · tap 🔒 to unlock and return to auto
- Red warning when over cutoff · amber when buffer < 15 min
- Summary row: totals for distance, elevation, moving time, rest, finish time
- Cumulative elevation gain column (running total)
- Auto-save every 30 seconds · manual Save now button
- Share link — unique URL for friends to view any plan (no login)
- Plan name field (Plan A / Plan B labeling)

### Phase 4 — Gamification & post-race review
- XP formula: distance km + (elevation gain / 100)
- 8 level titles from เจ้าชายทางราบ → มนุษย์กลายพันธุ์กินนอนในป่า
- Post-race entry: Finished / DNF · rank · total finishers · top 100
- Percentile groups: G1 top 25% · G2 top 50% · G3 51–75% · G4 76–100% · DNF
- Multi-trigger roast comment engine (rank + pace + top100 combos)
- Funny Thai trail runner comments seeded in `seed_comments.sql`
- Admin: manage level titles and comment pools per trigger condition
- XP progress bar · reroll comments button

### Phase 5 — Polish & UX (current)
- Elevation accuracy: 13m accumulation threshold (calibrated: +1636m vs Suunto +1632m on RFTW50)
- Elevation profile: colored bars matching gradient colors on map
- Elevation chart: brush drag-to-zoom · 1km tick marks
- Single scroll layout: Map → Elevation → Pacing table (no tabs)
- Creative SPODGEET header with mountain silhouette and trail squiggle
- Race countdown (🐯 X days to race) on plan page
- Version label (v0.5) bottom-right corner
- Keep-alive ping route at /api/ping for cron-job.org

---

## Planned (not yet built)
- Plan A / Plan B switching
- Direct image upload to Supabase Storage
- Lock-screen wallpaper export (Phase 5 PRD)
- Print / PDF pacing card
- Race status (Active / Archived) filter in plan creation

---

*v0.5 · Spodgeet · สะโปดกรี้ด*
