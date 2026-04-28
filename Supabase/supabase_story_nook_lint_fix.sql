-- Story Nook Supabase linter fixes
-- Run this after the main setup if Supabase reports function exposure or avatar listing warnings.

create schema if not exists story_nook_private;
grant usage on schema story_nook_private to anon, authenticated;

create or replace function story_nook_private.is_nook_admin()
returns boolean language sql stable security definer set search_path = public as $$
    select coalesce(auth.jwt() ->> 'email', '') = 'chdrey@gmail.com'
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.username = 'PenPaleto');
$$;
grant execute on function story_nook_private.is_nook_admin() to anon, authenticated;

create or replace function public.is_nook_admin()
returns boolean language sql stable set search_path = public as $$
    select story_nook_private.is_nook_admin();
$$;
revoke execute on function public.is_nook_admin() from public, anon, authenticated;

create or replace function public.like_story(p_story_id bigint)
returns integer language plpgsql security invoker set search_path = public as $$
declare v_votes integer;
begin
    if auth.uid() is null then
        raise exception 'You must be logged in to like a story.';
    end if;

    if not exists (
        select 1
        from public.stories s
        where s.id = p_story_id
          and s.deleted_at is null
    ) then
        raise exception 'Story is unavailable.';
    end if;

    insert into public.story_likes (story_id, user_id)
    values (p_story_id, auth.uid())
    on conflict do nothing;

    select count(*)::integer
      into v_votes
      from public.story_likes sl
     where sl.story_id = p_story_id;

    return coalesce(v_votes, 0);
end;
$$;
revoke execute on function public.like_story(bigint) from public, anon;
grant execute on function public.like_story(bigint) to authenticated;

create or replace function public.sync_story_vote_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare
    v_story_id bigint;
begin
    v_story_id = coalesce(new.story_id, old.story_id);

    update public.stories s
       set votes = (
               select count(*)::integer
               from public.story_likes sl
               where sl.story_id = v_story_id
           ),
           updated_at = now()
     where s.id = v_story_id
       and s.deleted_at is null;

    return coalesce(new, old);
end;
$$;
revoke execute on function public.sync_story_vote_count() from public, anon, authenticated;

drop trigger if exists story_likes_sync_vote_count_insert on public.story_likes;
create trigger story_likes_sync_vote_count_insert after insert on public.story_likes
for each row execute function public.sync_story_vote_count();

drop trigger if exists story_likes_sync_vote_count_delete on public.story_likes;
create trigger story_likes_sync_vote_count_delete after delete on public.story_likes
for each row execute function public.sync_story_vote_count();

revoke execute on function public.protect_profile_engagement_fields() from public, anon, authenticated;
revoke execute on function public.record_point_event(uuid, text, integer, bigint, bigint, bigint, uuid, text) from public, anon, authenticated;
revoke execute on function public.award_story_post_points() from public, anon, authenticated;
revoke execute on function public.award_story_like_points() from public, anon, authenticated;
revoke execute on function public.award_story_comment_points() from public, anon, authenticated;

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin on public.profiles for update using (auth.uid() = id or story_nook_private.is_nook_admin()) with check (auth.uid() = id or story_nook_private.is_nook_admin());
drop policy if exists profiles_delete_own_or_admin on public.profiles;
create policy profiles_delete_own_or_admin on public.profiles for delete using (auth.uid() = id or story_nook_private.is_nook_admin());

drop policy if exists flairs_admin_write on public.flairs;
create policy flairs_admin_write on public.flairs for all using (story_nook_private.is_nook_admin()) with check (story_nook_private.is_nook_admin());
drop policy if exists user_flairs_admin_write on public.user_flairs;
create policy user_flairs_admin_write on public.user_flairs for all using (story_nook_private.is_nook_admin()) with check (story_nook_private.is_nook_admin());

drop policy if exists prompts_read_published on public.prompts;
create policy prompts_read_published on public.prompts for select using (status in ('active', 'archived') or story_nook_private.is_nook_admin());
drop policy if exists prompts_admin_write on public.prompts;
create policy prompts_admin_write on public.prompts for all using (story_nook_private.is_nook_admin()) with check (story_nook_private.is_nook_admin());

drop policy if exists stories_read_live on public.stories;
create policy stories_read_live on public.stories for select using (deleted_at is null or user_id = auth.uid() or story_nook_private.is_nook_admin());
drop policy if exists stories_update_owner_or_admin on public.stories;
create policy stories_update_owner_or_admin on public.stories for update using (user_id = auth.uid() or story_nook_private.is_nook_admin()) with check (user_id = auth.uid() or story_nook_private.is_nook_admin());
drop policy if exists stories_delete_owner_or_admin on public.stories;
create policy stories_delete_owner_or_admin on public.stories for delete using (user_id = auth.uid() or story_nook_private.is_nook_admin());

drop policy if exists story_likes_delete_own on public.story_likes;
create policy story_likes_delete_own on public.story_likes for delete using (auth.uid() = user_id or story_nook_private.is_nook_admin());
drop policy if exists saved_stories_read_own on public.saved_stories;
create policy saved_stories_read_own on public.saved_stories for select using (auth.uid() = user_id or story_nook_private.is_nook_admin());
drop policy if exists saved_stories_delete_own on public.saved_stories;
create policy saved_stories_delete_own on public.saved_stories for delete using (auth.uid() = user_id or story_nook_private.is_nook_admin());

drop policy if exists comments_read_live on public.comments;
create policy comments_read_live on public.comments for select using (deleted_at is null or user_id = auth.uid() or story_nook_private.is_nook_admin());
drop policy if exists comments_update_owner_or_admin on public.comments;
create policy comments_update_owner_or_admin on public.comments for update using (user_id = auth.uid() or story_nook_private.is_nook_admin()) with check (user_id = auth.uid() or story_nook_private.is_nook_admin());
drop policy if exists comments_delete_owner_or_admin on public.comments;
create policy comments_delete_owner_or_admin on public.comments for delete using (user_id = auth.uid() or story_nook_private.is_nook_admin());

drop policy if exists point_events_read_own_or_admin on public.point_events;
create policy point_events_read_own_or_admin on public.point_events for select using (auth.uid() = user_id or story_nook_private.is_nook_admin());
drop policy if exists point_events_admin_write on public.point_events;
create policy point_events_admin_write on public.point_events for all using (story_nook_private.is_nook_admin()) with check (story_nook_private.is_nook_admin());

drop policy if exists achievements_read_active on public.achievements;
create policy achievements_read_active on public.achievements for select using (is_active or story_nook_private.is_nook_admin());
drop policy if exists achievements_admin_write on public.achievements;
create policy achievements_admin_write on public.achievements for all using (story_nook_private.is_nook_admin()) with check (story_nook_private.is_nook_admin());
drop policy if exists user_achievements_admin_write on public.user_achievements;
create policy user_achievements_admin_write on public.user_achievements for all using (story_nook_private.is_nook_admin()) with check (story_nook_private.is_nook_admin());

drop policy if exists reports_admin_read on public.content_reports;
create policy reports_admin_read on public.content_reports for select using (story_nook_private.is_nook_admin());
drop policy if exists feedback_admin_read on public.feedback;
create policy feedback_admin_read on public.feedback for select using (story_nook_private.is_nook_admin());
drop policy if exists site_settings_admin_write on public.site_settings;
create policy site_settings_admin_write on public.site_settings for all using (story_nook_private.is_nook_admin()) with check (story_nook_private.is_nook_admin());

drop policy if exists avatars_read_public on storage.objects;
