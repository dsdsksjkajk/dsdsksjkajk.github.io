
## Rules the database enforces
- Anyone can view; only logged-in users can post.
- PNG, JPG, GIF or WEBP only, 8 MB max per file, 30 posts per user per day.
- Users can delete their own posts; nobody can edit or delete anyone else's.
- The poster's username is filled in by the server, so it can't be faked.

## Moderating note
Anything public can attract junk. For an admin to remove a post: Supabase -> **Table Editor -> art_posts**, delete the row, then **Storage -> art**, delete the file in that user's folder (the folder name is the user's id, and the `path` column tells you the exact file).
