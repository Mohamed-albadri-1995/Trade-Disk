-- Applied to the hosted project 2026-11-12.
-- A signed-in user may create their own profile row and edit their name/email, but may
-- not set or change role or plan (those gate the global settings: the feed switch, the
-- market snapshot, the Polygon key). New accounts are members; existing accounts keep
-- their role. Roles are changed only with the service role or in the SQL editor, e.g.
--   update public.profile set role = 'admin' where email = '…';
alter table public.profile alter column role set default 'member';
revoke insert, update, delete, truncate, references, trigger on public.profile from authenticated, anon;
grant insert (id, email, display_name) on public.profile to authenticated;
grant update (email, display_name) on public.profile to authenticated;
