-- Snippet Studio: Add users table and user-scoped history
-- Run this AFTER 20261023000000_init_snippet_audit.sql
-- Safe to re-run: everything is `if not exists` / `or replace`.

-- ---------------------------------------------------------------------------
-- users: authentication (email + argon2 password hash)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  user_id         text primary key check (user_id ~ '^[0-9a-f]{32}$'),
  email           text not null unique check (email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'),
  password_hash   text not null,
  display_name    text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (email);

-- ---------------------------------------------------------------------------
-- snippet_runs: add user_id FK (nullable for anonymous runs)
-- ---------------------------------------------------------------------------
alter table public.snippet_runs
  add column if not exists user_id text references public.users (user_id) on delete set null;

create index if not exists snippet_runs_user_id_idx on public.snippet_runs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: users can only see their own runs
-- ---------------------------------------------------------------------------
-- Enable RLS on snippet_runs (already enabled from migration 000000, but ensure policies)
drop policy if exists snippet_runs_select_own on public.snippet_runs;
drop policy if exists snippet_runs_insert_service on public.snippet_runs;
drop policy if exists snippet_runs_update_service on public.snippet_runs;

-- Users can SELECT their own runs
create policy snippet_runs_select_own on public.snippet_runs
  for select
  using (
    auth.uid() = user_id
    or auth.role() = 'service_role'
  );

-- Service role (backend) can INSERT/UPDATE
create policy snippet_runs_insert_service on public.snippet_runs
  for insert
  with check (auth.role() = 'service_role');

create policy snippet_runs_update_service on public.snippet_runs
  for update
  using (auth.role() = 'service_role');

-- Same for related tables (workflow_events, evidence, approvals, final_results)
-- They cascade via FK to snippet_runs, but explicit policies help

drop policy if exists workflow_events_select_own on public.workflow_events;
drop policy if exists workflow_events_insert_service on public.workflow_events;
drop policy if exists evidence_select_own on public.evidence;
drop policy if exists evidence_insert_service on public.evidence;
drop policy if exists approvals_select_own on public.approvals;
drop policy if exists approvals_insert_service on public.approvals;
drop policy if exists final_results_select_own on public.final_results;
drop policy if exists final_results_insert_service on public.final_results;

create policy workflow_events_select_own on public.workflow_events
  for select
  using (
    exists (
      select 1 from public.snippet_runs sr
      where sr.request_id = workflow_events.request_id
      and (sr.user_id = auth.uid() or auth.role() = 'service_role')
    )
  );

create policy workflow_events_insert_service on public.workflow_events
  for insert
  with check (auth.role() = 'service_role');

create policy evidence_select_own on public.evidence
  for select
  using (
    exists (
      select 1 from public.snippet_runs sr
      where sr.request_id = evidence.request_id
      and (sr.user_id = auth.uid() or auth.role() = 'service_role')
    )
  );

create policy evidence_insert_service on public.evidence
  for insert
  with check (auth.role() = 'service_role');

create policy approvals_select_own on public.approvals
  for select
  using (
    exists (
      select 1 from public.snippet_runs sr
      where sr.request_id = approvals.request_id
      and (sr.user_id = auth.uid() or auth.role() = 'service_role')
    )
  );

create policy approvals_insert_service on public.approvals
  for insert
  with check (auth.role() = 'service_role');

create policy final_results_select_own on public.final_results
  for select
  using (
    exists (
      select 1 from public.snippet_runs sr
      where sr.request_id = final_results.request_id
      and (sr.user_id = auth.uid() or auth.role() = 'service_role')
    )
  );

create policy final_results_insert_service on public.final_results
  for insert
  with check (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- run_history view: now includes user_id for user-scoped queries
-- ---------------------------------------------------------------------------
drop view if exists public.run_history;
create or replace view public.run_history with (security_invoker = true) as
select
  r.request_id,
  r.user_id,
  r.source_id,
  r.state,
  r.language_name,
  r.output_hash,
  r.created_at,
  a.decision,
  f.event_chain_verified
from public.snippet_runs r
left join public.approvals a on a.request_id = r.request_id
left join public.final_results f on f.request_id = r.request_id;

-- ---------------------------------------------------------------------------
-- Trigger to touch updated_at on users
-- ---------------------------------------------------------------------------
drop trigger if exists users_touch on public.users;
create trigger users_touch before update on public.users
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Grant permissions
-- ---------------------------------------------------------------------------
revoke all on public.users from anon, authenticated;
grant select on public.users to authenticated;
