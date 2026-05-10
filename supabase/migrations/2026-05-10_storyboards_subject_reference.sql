-- SOON Storyboard Cycle 25-B.1 subject reference field
-- Date: 2026-05-10

alter table public.storyboards
  add column if not exists subject_reference text;

notify pgrst, 'reload schema';
