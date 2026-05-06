-- WalletLens — admin roster lives in the database (no env-based admin lists).
--
-- Bootstrap (one-off, run in Supabase SQL Editor after the user has signed up):
--   insert into public.admin_users (user_id, email, role, note)
--   select id, email, 'admin', 'bootstrap'
--   from auth.users where lower(email) = lower('you@example.com');
--
-- After that, manage admins exclusively via /admin/users.

create table if not exists public.admin_users (
  user_id     uuid        primary key references auth.users(id) on delete cascade,
  email       text        not null,
  role        text        not null default 'admin',
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users(id),
  constraint admin_users_role_check check (role in ('admin', 'analyst'))
);

create unique index if not exists admin_users_email_lower_idx on public.admin_users (lower(email));

alter table public.admin_users enable row level security;

-- Only the user themselves can see whether they are in the admin roster.
-- Listing every admin is done server-side via the service role.
drop policy if exists admin_users_select_self on public.admin_users;
create policy admin_users_select_self
  on public.admin_users for select
  using (auth.uid() = user_id);

-- All writes go through the server (service role); deny direct writes from
-- end-user tokens to avoid privilege escalation.
drop policy if exists admin_users_no_client_write on public.admin_users;
create policy admin_users_no_client_write
  on public.admin_users for all
  using (false)
  with check (false);
