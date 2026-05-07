-- SOON Storyboard Handoff: scripts table

create extension if not exists pgcrypto;

create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  background text,
  framework text not null,
  hook_variant text not null,
  tone text not null,
  target_minutes int not null,
  outline_id uuid,
  parts jsonb not null,
  pivot_sentences jsonb,
  title text,
  generated_at timestamptz default now(),
  model text,
  storyboard_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scripts_outline_id
  on public.scripts (outline_id);

create index if not exists idx_scripts_created_at
  on public.scripts (created_at desc);

alter table public.scripts enable row level security;

drop policy if exists "authenticated_read" on public.scripts;
create policy "authenticated_read"
  on public.scripts
  for select
  to authenticated
  using (true);

