-- Art wall update: descriptions + editing your own title/description.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again.
alter table public.art_posts
  add column if not exists description text not null default ''
  check (char_length(description) <= 1000);

drop policy if exists "art update own" on public.art_posts;
create policy "art update own" on public.art_posts for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- owners can change only the title and description, nothing else
grant update (title, description) on public.art_posts to authenticated;

-- make Supabase's API notice the new column right away
notify pgrst, 'reload schema';
