-- Story Nook avatar storage policy fix
-- Run this in Supabase Dashboard -> SQL Editor if custom avatar uploads fail with RLS.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists avatars_read_public on storage.objects;
drop policy if exists avatars_upload_own on storage.objects;
drop policy if exists avatars_upload_authenticated on storage.objects;
create policy avatars_upload_own on storage.objects
for insert to authenticated
with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and name like auth.uid()::text || '/%'
);

drop policy if exists avatars_update_own on storage.objects;
drop policy if exists avatars_update_authenticated on storage.objects;
create policy avatars_update_own on storage.objects
for update to authenticated
using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and name like auth.uid()::text || '/%'
)
with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and name like auth.uid()::text || '/%'
);

drop policy if exists avatars_delete_own on storage.objects;
drop policy if exists avatars_delete_authenticated on storage.objects;
create policy avatars_delete_own on storage.objects
for delete to authenticated
using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and name like auth.uid()::text || '/%'
);
