-- Art wall update: admins can post without the 30-per-day limit.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again.
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
