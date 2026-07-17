-- Spodgeet — Big Update Schema Patch
-- Run in Supabase SQL Editor after previous patches

-- Start time per distance (admin sets official wave start time)
ALTER TABLE distances ADD COLUMN IF NOT EXISTS start_time TEXT DEFAULT '06:00';

-- Plan name
ALTER TABLE user_plans ADD COLUMN IF NOT EXISTS plan_name TEXT;

-- Race active/archived flag
ALTER TABLE races ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- RLS for new columns (already covered by existing policies)
