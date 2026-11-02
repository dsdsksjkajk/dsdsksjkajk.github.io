# Art wall: one-time setup (about 2 minutes)

The art wall reuses the Idle MMO Supabase project, so `config.js` is already filled in and logins are shared.

1. Open your Supabase project -> **SQL Editor -> New query**.
2. Paste all of `art/setup.sql` and click **Run**. This creates the public `art` storage bucket and the `art_posts` table with its rules.
3. Commit and push. The page is at https://dsdsksjkajk.github.io/art/

## Rules the database enforces
- Anyone can view; only logged-in users can post.
- PNG, JPG, GIF or WEBP only, 8 MB max per file, 30 posts per user per day.
- Users can delete their own posts; nobody can edit or delete anyone else's.
- The poster's username is filled in by the server, so it can't be faked.

## Moderating
Anything public can attract junk. To remove a post: Supabase -> **Table Editor -> art_posts**, delete the row, then **Storage -> art**, delete the file in that user's folder (the folder name is the user's id, and the `path` column tells you the exact file).

## Update: descriptions (2 Nov 2026)
If you set the art wall up before descriptions existed, run `art/add-descriptions.sql` once in the SQL Editor. It adds a description to each post and lets people edit the title and description of their own posts.
