-- Story Nook avatar uploads update
-- Run this in Supabase Dashboard -> SQL Editor if avatar uploads or centering controls fail.

alter table public.profiles add column if not exists avatar_position_x integer not null default 50;
alter table public.profiles add column if not exists avatar_position_y integer not null default 50;

alter table public.profiles drop constraint if exists profiles_avatar_position_x_range;
alter table public.profiles add constraint profiles_avatar_position_x_range check (avatar_position_x between 0 and 100);
alter table public.profiles drop constraint if exists profiles_avatar_position_y_range;
alter table public.profiles add constraint profiles_avatar_position_y_range check (avatar_position_y between 0 and 100);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists avatars_read_public on storage.objects;
drop policy if exists avatars_upload_own on storage.objects;
create policy avatars_upload_own on storage.objects
for insert
with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
for update
using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
for delete
using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
);
