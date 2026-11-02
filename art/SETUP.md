## Rules the database enforces
- Anyone can view; only logged-in users can post.
- PNG, JPG, GIF or WEBP only, 8 MB max per file, 30 posts per user per day.
- Users can delete their own posts; nobody can edit or delete anyone else's.
- The poster's username is filled in by the server, so it can't be faked.

## Moderating notes
Anything public can attract junk. For and admin to remove a post: Supabase -> **Table Editor -> art_posts**, delete the row, then **Storage -> art**, delete the file in that user's folder (the folder name is the user's id, and the `path` column tells you the exact file).

## Update: descriptions (2 Nov 2026)
If you set the art wall up before descriptions existed, run `art/add-descriptions.sql` once in the SQL Editor. It adds a description to each post and lets people edit the title and description of their own posts.

## Update: admin approval + festive sprites (2 Nov 2026)
Run `art/add-admin.sql` once in the SQL Editor (after `add-descriptions.sql`). It makes the **dsdsksjkajk** account the admin; the last line of its output should show your account.

How it works:
1. Players post art on the wall as usual. New posts are never shown in game until you approve them.
2. Log in on the art wall as dsdsksjkajk (you'll see "(admin)" next to your name). Use the **All art / In game / Waiting for approval** filter to find new posts.
3. Open a post. In the **ADMIN** box, tick **Approved for the FlatMMO script**.
   - Leave "Replaces these game sprites" empty to just show it in the in-game gallery.
   - Or paste sprite names (one per line) to swap those game sprites for this art.
4. Get sprite names in game: 🎨 → **Sprite finder** → **Copy** next to the sprite you want replaced.
5. Players with the script pick up changes within 5 minutes, or straight away if they press **↻ Check now** or reload.

To add another admin: `insert into public.art_admins (user_id) select id from auth.users where email = 'u_<their username, lowercase>@dsdsksjkajk.github.io';`
