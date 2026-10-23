create table if not exists public.users (
  user_id text primary key check (user_id ~ '^[0-9a-f]{32}$'),
  email text not null unique,
  password_hash text not null,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant usage on schema public to service_role;
revoke all on public.users from anon, authenticated;
grant select, insert on public.users to service_role;
