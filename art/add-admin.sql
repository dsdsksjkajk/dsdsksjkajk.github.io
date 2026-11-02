-- Art wall update: admin approval + in-game sprite replacements.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again.
-- (Run add-descriptions.sql first if you haven't already.)

-- 1) Who is an admin. Decided by account id, never by username (usernames can be edited by users).
create table if not exists public.art_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.art_admins enable row level security;   -- no policies: nobody can read or change it from the website

-- Make the dsdsksjkajk account an admin.
insert into public.art_admins (user_id)
select id from auth.users where email = 'u_dsdsksjkajk@dsdsksjkajk.github.io'
on conflict do nothing;

create or replace function public.is_art_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.art_admins where user_id = auth.uid())
$$;
grant execute on function public.is_art_admin() to anon, authenticated;

-- 2) New columns on posts
alter table public.art_posts add column if not exists approved boolean not null default false;
alter table public.art_posts add column if not exists replaces text[]  not null default '{}';
do $$ begin
  alter table public.art_posts add constraint art_replaces_size check (cardinality(replaces) <= 30);
exception when duplicate_object then null; end $$;
create index if not exists art_posts_approved_idx on public.art_posts (approved, created_at desc);

-- 3) Normal users can never approve their own post: the insert trigger forces these off.
create or replace function public.art_posts_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;
  new.user_id    := auth.uid();
  new.created_at := now();
  new.approved   := false;
  new.replaces   := '{}';
  new.username   := coalesce((select raw_user_meta_data->>'username' from auth.users where id = auth.uid()), 'player');
  if new.path not like auth.uid()::text || '/%' then raise exception 'Bad file path'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'art' and name = new.path) then
    raise exception 'Upload the file first';
  end if;
  if not public.is_art_admin()   -- admins have no daily limit
     and (select count(*) from public.art_posts
      where user_id = auth.uid() and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Daily upload limit reached (30). Try again tomorrow.';
  end if;
  return new;
end $$;
-- (owners can still only update title/description: that column grant is unchanged)

-- 4) The only way to approve / assign sprites: this function, which checks you're an admin.
create or replace function public.art_admin_set(p_id bigint, p_approved boolean, p_replaces text[])
returns public.art_posts
language plpgsql security definer set search_path = public as $$
declare r public.art_posts;
begin
  if not public.is_art_admin() then raise exception 'Admins only'; end if;
  update public.art_posts
     set approved = coalesce(p_approved, false),
         replaces = coalesce((
           select array_agg(distinct v order by v)
           from (select btrim(u) as v from unnest(coalesce(p_replaces, '{}'::text[])) as t(u)) s
           where v <> '' and char_length(v) <= 300), '{}')
   where id = p_id
   returning * into r;
  if not found then raise exception 'Post not found'; end if;
  return r;
end $$;
revoke execute on function public.art_admin_set(bigint, boolean, text[]) from public, anon;
grant  execute on function public.art_admin_set(bigint, boolean, text[]) to authenticated;

notify pgrst, 'reload schema';

-- Check: this should return one row with your username.
select u.email from public.art_admins a join auth.users u on u.id = a.user_id;
