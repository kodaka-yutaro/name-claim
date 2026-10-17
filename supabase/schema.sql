-- Name Claim: database setup for Supabase.
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Table and function names start with nc_ so this can share a project with other sites.
--
-- Each visitor is a Supabase anonymous user, so auth.uid() identifies the device.
-- The page never touches the tables directly: it calls nc_propose() and nc_stats(),
-- which count each (name, device) pair once.

create table if not exists public.nc_names (
  id           bigint generated always as identity primary key,
  name         text        not null unique check (char_length(name) between 1 and 50),
  first_device uuid        not null,
  count        integer     not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.nc_proposals (
  name_id    bigint      not null references public.nc_names (id) on delete cascade,
  device     uuid        not null,
  created_at timestamptz not null default now(),
  primary key (name_id, device)
);
create index if not exists nc_proposals_device_time on public.nc_proposals (device, created_at);
create index if not exists nc_names_first_device on public.nc_names (first_device);

-- No policies: nobody reads or writes the tables except through the functions below.
alter table public.nc_names     enable row level security;
alter table public.nc_proposals enable row level security;

-- Names are compared exactly as typed: only surrounding spaces are dropped,
-- so "Alice", "alice" and "ＡＬＩＣＥ" are three different names.
create or replace function public.nc_propose(p_name text) returns json
language plpgsql volatile security definer set search_path = public as $$
declare
  me       uuid := auth.uid();
  clean    text := regexp_replace(normalize(coalesce(p_name, ''), NFC), '^\s+|\s+$', '', 'g');
  row      public.nc_names;
  new_name boolean := false;
  counted  integer;
begin
  if me is null then return json_build_object('error', 'no_session'); end if;
  if clean = '' then return json_build_object('error', 'empty'); end if;
  if char_length(clean) > 50 then return json_build_object('error', 'too_long'); end if;
  if clean ~ '[[:cntrl:]]' then return json_build_object('error', 'empty'); end if;
  if (select count(*) from nc_proposals where device = me and created_at > now() - interval '1 minute') >= 30 then
    return json_build_object('error', 'rate_limited');
  end if;

  insert into nc_names (name, first_device) values (clean, me)
    on conflict (name) do nothing
    returning * into row;
  new_name := found;
  if not new_name then
    select * into row from nc_names where name = clean;
  end if;

  -- A device is counted once per name, however often it retries.
  insert into nc_proposals (name_id, device) values (row.id, me) on conflict do nothing;
  get diagnostics counted = row_count;
  if counted > 0 then
    update nc_names set count = count + 1 where id = row.id returning * into row;
  end if;

  return json_build_object(
    'result', case when new_name then 'success' when row.first_device = me then 'yours' else 'taken' end,
    'name',   row.name,
    'count',  row.count,
    'repeat', not new_name and counted = 0,
    'wins',   (select count(*) from nc_names where first_device = me)
  );
end;
$$;

-- How many names this device proposed first. Drives the trophy on the page.
create or replace function public.nc_my_wins() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from nc_names where first_device = auth.uid();
$$;

create or replace function public.nc_stats() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('names', count(*), 'proposals', coalesce(sum(count), 0)) from nc_names;
$$;

revoke all on function public.nc_propose(text) from public, anon;
revoke all on function public.nc_stats() from public;
revoke all on function public.nc_my_wins() from public, anon;
grant execute on function public.nc_my_wins() to authenticated;
grant execute on function public.nc_propose(text) to authenticated;
grant execute on function public.nc_stats() to anon, authenticated;
