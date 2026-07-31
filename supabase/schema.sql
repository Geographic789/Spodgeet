-- Trail Running Planner Platform — Database Schema
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query)

create extension if not exists "uuid-ossp";

-- ============================================================
-- MODULE 0: Races & Distances (Master Data, Admin-only writes)
-- ============================================================

create table if not exists races (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  race_date date,
  logo_url text,
  route_map_url text,
  location text,
  official_link text,
  timezone text default 'Asia/Bangkok',
  created_at timestamptz default now()
);

create table if not exists distances (
  id uuid primary key default uuid_generate_v4(),
  race_id uuid not null references races(id) on delete cascade,
  label text not null,              -- e.g. "20km", "100km"
  distance_km numeric not null,
  elevation_gain_m numeric,
  elevation_loss_m numeric,
  gpx_filename text,
  route_geojson jsonb,              -- parsed [{lat, lon, ele, cum_km}, ...]
  mandatory_gear jsonb default '[]'::jsonb,  -- [{item, required}]
  created_at timestamptz default now()
);

create table if not exists aid_stations (
  id uuid primary key default uuid_generate_v4(),
  distance_id uuid not null references distances(id) on delete cascade,
  name text not null,
  cumulative_km numeric not null,
  cutoff_time text,                 -- "HH:MM" or offset, kept flexible for Phase 2
  lat numeric,
  lon numeric,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- MODULE 2 (config, used later): Fatigue multiplier tiers
-- ============================================================

create table if not exists fatigue_tiers (
  id uuid primary key default uuid_generate_v4(),
  min_pct numeric not null,   -- 0
  max_pct numeric not null,   -- 30
  multiplier numeric not null -- 1.0
);

insert into fatigue_tiers (min_pct, max_pct, multiplier)
select * from (values
  (0, 30, 1.0),
  (31, 60, 1.15),
  (61, 90, 1.30),
  (91, 100, 1.40)
) as t(min_pct, max_pct, multiplier)
where not exists (select 1 from fatigue_tiers);

-- ============================================================
-- MODULE 4 (config, used later): Levels & Comments
-- ============================================================

create table if not exists level_titles_pool (
  id uuid primary key default uuid_generate_v4(),
  min_xp numeric not null,
  max_xp numeric not null,
  title_name text not null,
  sort_order int default 0
);

insert into level_titles_pool (min_xp, max_xp, title_name, sort_order)
select * from (values
  (0, 30, 'เจ้าชายทางราบ', 1),
  (31, 70, 'นักล่าสะพานลอย', 2),
  (71, 120, 'มนุษย์ตะคริวแดด', 3),
  (121, 180, 'ขุนพลเนินซึม', 4),
  (181, 250, 'นักสู้รถส้วม', 5),
  (251, 330, 'ตัวตึงสันคมมีด', 6),
  (331, 420, 'เทพเจ้าดอยอินทนนท์', 7),
  (421, 999999, 'มนุษย์กลายพันธุ์กินนอนในป่า', 8)
) as t(min_xp, max_xp, title_name, sort_order)
where not exists (select 1 from level_titles_pool);

create table if not exists comments_pool (
  id uuid primary key default uuid_generate_v4(),
  trigger_condition text not null, -- Percentile_G1 / G2 / G3 / G4 / DNF / High_Photo_Count / Exact_Pace / Ahead_Pace / Behind_Pace
  comment_text text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- USER PLANNING DATA (Phase 3+, table created now so schema is stable)
-- ============================================================

create table if not exists user_plans (
  id uuid primary key default uuid_generate_v4(),
  distance_id uuid not null references distances(id) on delete cascade,
  user_name text not null,          -- simple friend-group identifier, no auth table
  share_token text unique default uuid_generate_v4(),
  pacing_table jsonb default '[]'::jsonb,
  gear_checklist jsonb default '[]'::jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists race_results (
  id uuid primary key default uuid_generate_v4(),
  user_plan_id uuid references user_plans(id) on delete cascade,
  status text check (status in ('Finished','DNF')),
  overall_rank int,
  gender_rank int,
  age_group_rank int,
  total_finishers int,
  top_100 boolean default false,
  xp_earned numeric,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- Admin writes happen via server-side service role key (bypasses RLS).
-- Public read access for the friend group, no public write access.
-- ============================================================

alter table races enable row level security;
alter table distances enable row level security;
alter table aid_stations enable row level security;
alter table fatigue_tiers enable row level security;
alter table level_titles_pool enable row level security;
alter table comments_pool enable row level security;
alter table user_plans enable row level security;
alter table race_results enable row level security;

create policy "public read races" on races for select using (true);
create policy "public read distances" on distances for select using (true);
create policy "public read aid_stations" on aid_stations for select using (true);
create policy "public read fatigue_tiers" on fatigue_tiers for select using (true);
create policy "public read level_titles_pool" on level_titles_pool for select using (true);
create policy "public read comments_pool" on comments_pool for select using (true);
create policy "public read user_plans" on user_plans for select using (true);
create policy "public read race_results" on race_results for select using (true);

-- Friends can write their own plan/results without an account (Phase 3+).
create policy "public insert user_plans" on user_plans for insert with check (true);
create policy "public update user_plans" on user_plans for update using (true);
create policy "public insert race_results" on race_results for insert with check (true);
