create table if not exists public.game_catalog (
  id uuid primary key default gen_random_uuid(),
  game_name text not null check (length(trim(game_name)) between 1 and 120),
  platform text not null check (platform in ('android', 'ios')),
  minimum_os_version text,
  recommended_ram_gb numeric check (
    recommended_ram_gb is null or recommended_ram_gb > 0
  ),
  minimum_opengles_version text,
  processor_requirement text,
  graphics_requirement text,
  source_url text,
  created_at timestamptz not null default now()
);

create unique index if not exists game_catalog_name_platform_unique
  on public.game_catalog (lower(game_name), platform);

create table if not exists public.game_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game_name text not null check (length(trim(game_name)) between 1 and 120),
  platform text not null check (platform in ('android', 'ios')),
  minimum_os_version text,
  recommended_ram_gb numeric check (
    recommended_ram_gb is null or recommended_ram_gb > 0
  ),
  minimum_opengles_version text,
  processor_requirement text,
  graphics_requirement text,
  source_url text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.game_catalog enable row level security;
alter table public.game_requests enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "Anyone can read the game catalog"
  on public.game_catalog;
create policy "Anyone can read the game catalog"
  on public.game_catalog for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can read own requests and admins can read all"
  on public.game_requests;
create policy "Users can read own requests and admins can read all"
  on public.game_requests for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.admin_users
      where admin_users.user_id = (select auth.uid())
    )
  );

drop policy if exists "Signed-in users can submit their own pending requests"
  on public.game_requests;
create policy "Signed-in users can submit their own pending requests"
  on public.game_requests for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and admin_note is null
    and reviewed_by is null
    and reviewed_at is null
  );

drop policy if exists "Users can check their own admin status"
  on public.admin_users;
create policy "Users can check their own admin status"
  on public.admin_users for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.game_catalog from anon, authenticated;
grant select on public.game_catalog to anon, authenticated;
revoke all on public.game_requests from anon, authenticated;
grant select on public.game_requests to authenticated;
grant insert (
  user_id,
  game_name,
  platform,
  minimum_os_version,
  recommended_ram_gb,
  minimum_opengles_version,
  processor_requirement,
  graphics_requirement,
  source_url
) on public.game_requests to authenticated;
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;

create or replace function public.approve_game_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.game_requests%rowtype;
  catalog_game_id uuid;
begin
  if not exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  ) then
    raise exception 'Administrator access required';
  end if;

  select * into request_row
  from public.game_requests
  where id = p_request_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Pending request not found';
  end if;

  insert into public.game_catalog (
    game_name,
    platform,
    minimum_os_version,
    recommended_ram_gb,
    minimum_opengles_version,
    processor_requirement,
    graphics_requirement,
    source_url
  ) values (
    request_row.game_name,
    request_row.platform,
    request_row.minimum_os_version,
    request_row.recommended_ram_gb,
    request_row.minimum_opengles_version,
    request_row.processor_requirement,
    request_row.graphics_requirement,
    request_row.source_url
  )
  on conflict ((lower(game_name)), platform) do update set
    minimum_os_version = excluded.minimum_os_version,
    recommended_ram_gb = excluded.recommended_ram_gb,
    minimum_opengles_version = excluded.minimum_opengles_version,
    processor_requirement = excluded.processor_requirement,
    graphics_requirement = excluded.graphics_requirement,
    source_url = excluded.source_url
  returning id into catalog_game_id;

  update public.game_requests
  set status = 'approved',
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where id = request_row.id;

  return catalog_game_id;
end;
$$;

create or replace function public.reject_game_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  ) then
    raise exception 'Administrator access required';
  end if;

  update public.game_requests
  set status = 'rejected',
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where id = p_request_id and status = 'pending';

  if not found then
    raise exception 'Pending request not found';
  end if;
end;
$$;

revoke all on function public.approve_game_request(uuid) from public;
revoke all on function public.reject_game_request(uuid) from public;
grant execute on function public.approve_game_request(uuid) to authenticated;
grant execute on function public.reject_game_request(uuid) to authenticated;
