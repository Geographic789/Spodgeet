-- Spodgeet Phase 5 — Schema patch
-- Run in Supabase SQL Editor after patch_phase4.sql

alter table distances add column if not exists start_time text default '06:00';
alter table distances add column if not exists sort_order int default 0;
alter table races add column if not exists status text default 'active';
alter table user_plans add column if not exists plan_name text default '';
