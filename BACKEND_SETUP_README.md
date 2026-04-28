# Story Nook backend setup

Run `supabase_story_nook_setup.sql` in Supabase Dashboard → SQL Editor.

This adds/updates:
- profiles with username, avatar, bio, and selected flair
- stories and comments
- one-like-per-user story likes through the `like_story` RPC
- profile stats support
- flairs/user_flairs
- reports and feedback tables
- row level security policies
- public avatar upload bucket

After running the SQL, upload the website files to GitHub as usual. Keep the `CNAME` file in the root of the repo.
