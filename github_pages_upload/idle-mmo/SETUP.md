# Idle MMO: one-time setup (about 5 minutes, free)

GitHub Pages only serves static files, so accounts and saves live in Supabase (hosted Postgres + login).

1. Create a free project at https://supabase.com (any name, pick a database password, nearest region).
2. **Authentication -> Providers -> Email**: turn **OFF** "Confirm email" (players log in with a username, not a real email) and save.
3. **SQL Editor -> New query**: paste all of `setup.sql`, click Run.
4. **Project Settings -> API**: copy the *Project URL* and the *anon public* key into `js/config.js`.
5. Commit and push. The game is at https://dsdsksjkajk.github.io/idle-mmo/

Notes: the anon key is public by design; row-level security in setup.sql means each player can only read/write their own save. Never put the `service_role` key in this repo.
