-- SOON Storyboard Cycle 25-B production prompt columns
-- Date: 2026-05-09

alter table public.storyboard_shots
  add column if not exists production_prompt text,
  add column if not exists production_prompt_generated_at timestamptz,
  add column if not exists production_prompt_for_source text;

notify pgrst, 'reload schema';
