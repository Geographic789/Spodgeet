# Spodgeet — Admin (Phase 1)

This is Phase 1 of Spodgeet (สะโปดกรี้ด — a คำผวน of "Speedgoat"): the **Admin panel and
master data model** for races, distances, GPX routes, and aid stations.
Later phases (interactive map, pacing engine, gear checklist, gamification,
export) build on top of the database schema already set up here.

## What's in this phase

- Admin login gated by one shared password (no individual accounts — built
  for a closed friend group)
- Create races (name, date, location, logo/route map links, timezone)
- Add distances to a race by **uploading a GPX file** — distance, elevation
  gain, and elevation loss are computed automatically in your browser
- Add/remove aid stations per distance (name, cumulative km, cutoff time)
- Add/remove mandatory gear items per distance
- Database schema already includes the tables for fatigue-tier config,
  level titles, comment pools, user plans, and race results, so the next
  phases don't require migrations — just new pages

## 1. Set up Supabase (free tier)

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Open **SQL Editor** → New query, paste the contents of
   `supabase/schema.sql`, and run it. This creates all tables, default
   fatigue tiers, and default level titles, with public read access.
3. Go to **Project Settings → API** and copy:
   - Project URL
   - `anon` `public` key
   - `service_role` key (keep this one secret — never put it in client code)

## 2. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in the four values:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
```

`ADMIN_PASSWORD` is whatever password you want to use to log into `/admin`.

## 3. Run locally

```
npm install
npm run dev
```

Visit `http://localhost:3000` — it redirects to `/admin/login`.

## 4. Deploy (free)

Same flow as Splitmate:

1. Push this folder to a new GitHub repo.
2. Go to [vercel.com](https://vercel.com) → New Project → import the repo.
3. In Vercel's project settings, add the same four environment variables
   from `.env.local`.
4. Deploy. Vercel will give you a URL like `spodgeet-xyz.vercel.app`.

## Notes on the GPX upload

GPX files are parsed entirely in your browser (no server upload of the raw
file) — it reads `trkpt`/`rtept`/`wpt` points, computes cumulative distance
with the haversine formula, and sums elevation gain/loss. The parsed points
are stored as JSON in `distances.route_geojson`, ready for the Module 1 map
and elevation chart in the next phase.

## Phase 2 — Map & elevation engine

- Public route viewer at `/route/[distanceId]` (no login needed — this is
  what the future "User" role will see)
- OpenTopoMap base layer with the GPX route plotted as a line, plus pins for
  each aid station
- Elevation chart (distance vs. elevation) with aid stations marked as
  reference lines
- **Hover sync**: moving the mouse over the elevation chart moves a tracking
  marker on the map and shows the nearest aid station — exactly as
  specified in the PRD
- Responsive layout: side-by-side map/chart on desktop and tablet landscape,
  tabbed Map/Elevation/Race Info on mobile
- A "View map & elevation →" link was added to each distance's admin page

## What's next (not built yet)

- Module 2: Pacing engine (fatigue multiplier + domino recalculation,
  cut-off/buffer warnings)
- Module 3: User-facing gear checklist
- Module 4: XP, leveling, post-race review, roast comments
- Module 5: Public share links + lock-screen wallpaper export

Say the word when you're ready for the next phase and we'll build on this
same schema.
