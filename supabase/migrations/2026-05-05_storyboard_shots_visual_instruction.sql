alter table public.storyboard_shots
  add column if not exists script_excerpt text,
  add column if not exists visual_instruction text,
  add column if not exists content_type_slug text;

create index if not exists idx_storyboard_shots_content_type
  on public.storyboard_shots (content_type_slug);

notify pgrst, 'reload schema';
