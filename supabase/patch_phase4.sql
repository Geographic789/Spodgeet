-- Spodgeet Phase 4 — Schema patch
-- Run this in Supabase SQL Editor after the original schema.sql

-- Unique constraint so we can upsert (one result per plan)
alter table race_results
  drop constraint if exists race_results_user_plan_id_key;

alter table race_results
  add constraint race_results_user_plan_id_key unique (user_plan_id);

-- Allow public insert/update on race_results (friends log without login)
drop policy if exists "public insert race_results" on race_results;
drop policy if exists "public update race_results" on race_results;

create policy "public insert race_results" on race_results for insert with check (true);
create policy "public update race_results" on race_results for update using (true);
