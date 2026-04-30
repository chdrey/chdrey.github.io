-- Story Nook admin + site content settings update
-- Run this once in Supabase Dashboard -> SQL Editor for the existing project.

create schema if not exists story_nook_private;
grant usage on schema story_nook_private to anon, authenticated;

create or replace function story_nook_private.is_nook_admin()
returns boolean language sql stable security definer set search_path = public as $$
    select lower(coalesce(auth.jwt() ->> 'email', '')) = 'chdrey@gmail.com';
$$;

grant execute on function story_nook_private.is_nook_admin() to anon, authenticated;

create table if not exists public.site_settings (
    key text primary key,
    value text not null,
    updated_by uuid references public.profiles(id) on delete set null,
    updated_at timestamptz not null default now()
);

alter table public.site_settings add column if not exists value text not null default '';
alter table public.site_settings add column if not exists updated_by uuid references public.profiles(id) on delete set null;
alter table public.site_settings add column if not exists updated_at timestamptz not null default now();
alter table public.site_settings enable row level security;

drop policy if exists site_settings_read_all on public.site_settings;
create policy site_settings_read_all on public.site_settings
for select using (true);

drop policy if exists site_settings_admin_write on public.site_settings;
create policy site_settings_admin_write on public.site_settings
for all
using (story_nook_private.is_nook_admin())
with check (story_nook_private.is_nook_admin());

insert into public.site_settings (key, value)
values
    ('header_quote', 'It''s the job that never gets started that takes longest to finish.'),
    ('header_quote_author', 'J.R.R. Tolkien')
on conflict (key) do nothing;
