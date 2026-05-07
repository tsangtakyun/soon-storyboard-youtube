-- SOON Storyboard Handoff: storyboard_shots table

create extension if not exists pgcrypto;

create table if not exists public.storyboard_shots (
  id uuid primary key default gen_random_uuid(),
  storyboard_id uuid not null references public.storyboards (id) on delete cascade,
  script_part_role text not null,
  display_order int not null,
  part_order int not null,
  description text not null default '',
  visual_mode_slug text not null,
  footage_source_slug text not null,
  duration_seconds numeric,
  generation_url text,
  generation_status text default 'pending',
  generation_metadata jsonb,
  stock_keyword text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_storyboard_shots_storyboard_id
  on public.storyboard_shots (storyboard_id);

create index if not exists idx_storyboard_shots_visual_mode
  on public.storyboard_shots (visual_mode_slug);

create index if not exists idx_storyboard_shots_footage_source
  on public.storyboard_shots (footage_source_slug);

alter table public.storyboard_shots enable row level security;

drop policy if exists "authenticated_read" on public.storyboard_shots;
create policy "authenticated_read"
  on public.storyboard_shots
  for select
  to authenticated
  using (true);
