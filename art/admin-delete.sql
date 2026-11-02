-- Art wall update: admins can delete ANY post (and its image file) from the website.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again.
-- (Needs add-admin.sql to have been run first.)

-- Admins may delete any post row (owners can still delete their own, as before).
drop policy if exists "art admin delete" on public.art_posts;
create policy "art admin delete" on public.art_posts for delete to authenticated
  using (public.is_art_admin());

-- Admins may delete any image file in the art bucket.
-- (Supabase's file delete may also check read access, so admins get that too; the bucket is public anyway.)
drop policy if exists "art admin delete files" on storage.objects;
drop policy if exists "art admin read files"   on storage.objects;
create policy "art admin delete files" on storage.objects for delete to authenticated
  using (bucket_id = 'art' and public.is_art_admin());
create policy "art admin read files" on storage.objects for select to authenticated
  using (bucket_id = 'art' and public.is_art_admin());

-- Same read access for owners on their own folder, so deleting your own post also removes its file.
drop policy if exists "art read own folder" on storage.objects;
create policy "art read own folder" on storage.objects for select to authenticated
  using (bucket_id = 'art' and (storage.foldername(name))[1] = auth.uid()::text);
