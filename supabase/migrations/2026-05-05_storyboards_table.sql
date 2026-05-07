-- SOON Storyboard Handoff: storyboards table

create extension if not exists pgcrypto;

create table if not exists public.storyboards (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.scripts (id) on delete cascade,
  title text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_storyboards_script_id
  on public.storyboards (script_id);

alter table public.storyboards enable row level security;

drop policy if exists "authenticated_read" on public.storyboards;
create policy "authenticated_read"
  on public.storyboards
  for select
  to authenticated
  using (true);

