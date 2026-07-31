-- Spodgeet Phase 6 — Schema patch
-- Run in Supabase SQL Editor after patch_phase5.sql

alter table aid_stations add column if not exists leg_gain_m numeric default 0;
alter table aid_stations add column if not exists leg_loss_m numeric default 0;
