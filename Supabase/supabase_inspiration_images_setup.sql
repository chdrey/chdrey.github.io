-- Optional setup for the Weekly Inspiration Image upload feature.
-- Run in Supabase SQL Editor if the inspiration image upload fails because the bucket does not exist.
-- Adjust policies if your project uses stricter admin checks.

insert into storage.buckets (id, name, public)
values ('inspiration-images', 'inspiration-images', true)
on conflict (id) do nothing;

-- Public images can be read by anyone.
drop policy if exists "Public read inspiration images" on storage.objects;
create policy "Public read inspiration images"
on storage.objects
for select
using (bucket_id = 'inspiration-images');

-- Logged-in users can upload. If only chdrey/admin should upload, tighten this policy.
drop policy if exists "Authenticated upload inspiration images" on storage.objects;
create policy "Authenticated upload inspiration images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'inspiration-images');

drop policy if exists "Authenticated update inspiration images" on storage.objects;
create policy "Authenticated update inspiration images"
on storage.objects
for update
to authenticated
using (bucket_id = 'inspiration-images')
with check (bucket_id = 'inspiration-images');
