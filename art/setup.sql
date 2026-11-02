-- Art wall: run once in Supabase (same project as Idle MMO).
-- SQL Editor -> New query -> paste all of this -> Run. Safe to run again.

-- 1) Public storage bucket for the images (8 MB cap, images/GIFs only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('art', 'art', true, 8388608, array['image/png','image/jpeg','image/gif','image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Logged-in users may only upload/delete files inside their own folder: <user id>/<file>
drop policy if exists "art upload own folder" on storage.objects;
drop policy if exists "art delete own folder" on storage.objects;
create policy "art upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'art' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "art delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'art' and (storage.foldername(name))[1] = auth.uid()::text);

-- 2) One row per post
create table if not exists public.art_posts (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  username   text        not null default '',
  title      text        not null default '' check (char_length(title) <= 80),
  description text       not null default '' check (char_length(description) <= 1000),
  path       text        not null unique,
  mime       text        not null check (mime in ('image/png','image/jpeg','image/gif','image/webp')),
  width      integer     check (width  between 1 and 20000),
  height     integer     check (height between 1 and 20000),
  created_at timestamptz not null default now()
);
create index if not exists art_posts_created_idx on public.art_posts (created_at desc);
alter table public.art_posts enable row level security;

-- The server fills in who posted it (can't be faked), checks the file really exists,
-- and caps uploads at 30 per user per day.
create or replace function public.art_posts_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;
  new.user_id    := auth.uid();
  new.created_at := now();
  new.username   := coalesce((select raw_user_meta_data->>'username' from auth.users where id = auth.uid()), 'player');
  if new.path not like auth.uid()::text || '/%' then raise exception 'Bad file path'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'art' and name = new.path) then
    raise exception 'Upload the file first';
  end if;
  if (select count(*) from public.art_posts
      where user_id = auth.uid() and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Daily upload limit reached (30). Try again tomorrow.';
  end if;
  return new;
end $$;
drop trigger if exists art_posts_before_insert on public.art_posts;
create trigger art_posts_before_insert before insert on public.art_posts
  for each row execute function public.art_posts_before_insert();

drop policy if exists "art read all"   on public.art_posts;
drop policy if exists "art insert own" on public.art_posts;
drop policy if exists "art delete own" on public.art_posts;
create policy "art read all"   on public.art_posts for select using (true);
create policy "art insert own" on public.art_posts for insert to authenticated with check (auth.uid() = user_id);
create policy "art delete own" on public.art_posts for delete to authenticated using (auth.uid() = user_id);
drop policy if exists "art update own" on public.art_posts;
create policy "art update own" on public.art_posts for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select on public.art_posts to anon, authenticated;
grant insert, delete on public.art_posts to authenticated;
grant update (title, description) on public.art_posts to authenticated;  -- owners can only edit these two
