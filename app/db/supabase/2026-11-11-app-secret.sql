-- Move the shared Polygon API key out of app_setting (readable by every signed-in user)
-- into app_secret, which only the server's service-role key can read. Run once in the
-- Supabase SQL editor. Safe to run again. The server needs SUPABASE_SERVICE_ROLE_KEY set.

create table if not exists public.app_secret (
  key text primary key, value text, updated_at timestamptz not null default now()
);
alter table public.app_secret enable row level security;   -- no policies: signed-in users get nothing
revoke all on public.app_secret from anon, authenticated;

insert into public.app_secret (key, value)
  select key, value from public.app_setting where key = 'polygon_api_key'
  on conflict (key) do nothing;
delete from public.app_setting where key = 'polygon_api_key';
