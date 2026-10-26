-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
create table if not exists public.saves (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  rev        integer     not null default 0,
  updated_at timestamptz not null default now(),
  constraint save_size check (pg_column_size(data) < 400000)
);
alter table public.saves enable row level security;

drop policy if exists "own select" on public.saves;
drop policy if exists "own insert" on public.saves;
drop policy if exists "own update" on public.saves;
create policy "own select" on public.saves for select using (auth.uid() = user_id);
create policy "own insert" on public.saves for insert with check (auth.uid() = user_id);
create policy "own update" on public.saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- no delete policy: players cannot delete their row

-- Makes this work even if "Automatically expose new tables" was turned off at project creation.
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.saves to authenticated;
