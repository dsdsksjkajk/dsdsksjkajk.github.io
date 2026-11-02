# Art wall: one-time setup (about 2 minutes)

The art wall reuses the Idle MMO Supabase project, so `config.js` is already filled in and logins are shared.

1. Open your Supabase project -> **SQL Editor -> New query**.
2. Paste all of `art/setup.sql` and click **Run**. This creates the public `art` storage bucket and the `art_posts` table with its rules.
3. Commit and push. The page is at https://dsdsksjkajk.github.io/art/

## Rules the database enforces
- Anyone can view; only logged-in users can post.
- PNG, JPG, GIF or WEBP only, 8 MB max per file, 30 posts per user per day (admins have no daily limit; run `art/admin-unlimited.sql` if you set up admin before this).
- Users can delete their own posts; nobody can edit or delete anyone else's.
- The poster's username is filled in by the server, so it can't be faked.

## Moderating
Admins can delete any post straight from the art wall: open it and click **Delete (admin)**. That removes the post and its image file. (Run `art/admin-delete.sql` once to switch this on.) Nobody needs the Supabase login for this; to give someone moderator powers, make them an admin (see the bottom of this file).

Fallback if ever needed: Supabase -> **Table Editor -> art_posts**, delete the row, then **Storage -> art**, delete the file in that user's folder.

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
4. Get sprite names in game: 🎨 → **Sprite finder** → **Copy** next to the sprite you want replaced. The finder groups animation frames, so a name like `images/npcs/goblin*` replaces every goblin frame at once (`*` matches anything). Switch it to **By animation** or **Every frame** if you only want part of one. Player gear lives in animation folders, so **By character** gives names like `images/animations/*/head_oxygen_tank*` that cover every animation. Replacement art is fitted to where the original item actually is, so a hat replacement sits on the head.
   - **What to do with those sprites** picks the mode:
     - **Replace**: show the post's art instead of the sprite.
     - **Decorate**: keep the game's sprite, add twinkling fairy lights, and put the post's art (e.g. presents) at its base. Great for trees.
     - **Dress up**: keep the game's sprite and lay the post's art exactly over its solid area (soft shadows ignored). Draw the art at the sprite's own size with a transparent background, e.g. a hat and scarf for the snowman.
5. Players with the script pick up changes within 5 minutes, or straight away if they press **↻ Check now** or reload.

To add another admin: `insert into public.art_admins (user_id) select id from auth.users where email = 'u_<their username, lowercase>@dsdsksjkajk.github.io';`
