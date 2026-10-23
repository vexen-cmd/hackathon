-- Snippet Studio: persistent audit store for the deterministic snippet harness.
-- Mirrors contracts/schemas.py + agent/harness/*. Paste into the Supabase SQL editor
-- (or `supabase db push`). Safe to re-run: everything is `if not exists` / `or replace`.
--
-- Access model: only the FastAPI backend writes, using the service_role key.
-- RLS is enabled with NO policies, so anon/authenticated keys can read or write nothing.

-- ---------------------------------------------------------------------------
-- snippet_runs: one row per successful /api/analyze (request_id = uuid4().hex)
-- ---------------------------------------------------------------------------
create table if not exists public.snippet_runs (
  request_id          text primary key check (request_id ~ '^[0-9a-f]{32}$'),
  source_id           text not null,
  code                text not null check (length(code) < 50000),
  snippet_hash        text,
  submitted_at        timestamptz not null,
  state               text not null check (state in (
                        'received','detecting','explaining','proposing_docs',
                        'awaiting_review','formatting','delivered',
                        'needs_input','rejected','failed','cancelled')),
  language_name       text,
  language_confidence double precision check (language_confidence between 0 and 1),
  language_source     text,
  explanation         text,
  documentation       text,
  output_hash         text,
  tags                text[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists snippet_runs_created_at_idx on public.snippet_runs (created_at desc);
create index if not exists snippet_runs_state_idx      on public.snippet_runs (state);
create index if not exists snippet_runs_output_hash_idx on public.snippet_runs (output_hash);

-- ---------------------------------------------------------------------------
-- workflow_events: hash-chained state transitions (agent/harness/event_chain.py)
-- seq 1 ("received") is created by StateMachine.__init__ and is NOT part of the
-- chain, so prev_hash/fingerprint are null for it. Chain starts at seq 2 with
-- prev_hash = 'GENESIS'.
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_events (
  request_id  text not null references public.snippet_runs (request_id) on delete cascade,
  seq         integer not null check (seq >= 1),
  state       text not null,
  at          timestamptz not null,
  detail      jsonb not null default '{}'::jsonb,
  prev_hash   text,
  fingerprint text,
  primary key (request_id, seq),
  check ((prev_hash is null) = (fingerprint is null))
);

-- ---------------------------------------------------------------------------
-- evidence: ledger entries in insertion order (idx = position in the ledger)
-- ---------------------------------------------------------------------------
create table if not exists public.evidence (
  request_id   text not null references public.snippet_runs (request_id) on delete cascade,
  idx          integer not null check (idx >= 0),
  source_id    text not null,
  source_url   text,
  retrieved_at timestamptz not null,
  extracted    jsonb not null default '{}'::jsonb,
  trust        text not null check (trust in ('trusted','untrusted')),
  note         text not null default '',
  primary key (request_id, idx)
);

-- ---------------------------------------------------------------------------
-- approvals: the human decision bound to a proposal hash (agent/harness/approval.py)
-- ---------------------------------------------------------------------------
create table if not exists public.approvals (
  request_id            text primary key references public.snippet_runs (request_id) on delete cascade,
  proposal_hash         text not null,
  approver_id           text not null,
  approved_at           timestamptz not null,
  decision              text not null check (decision in ('approve','reject')),
  edited_explanation    text,
  edited_documentation  text,
  approval_receipt_hash text not null default ''
);

-- ---------------------------------------------------------------------------
-- final_results: delivered output + the four statuses
-- ---------------------------------------------------------------------------
create table if not exists public.final_results (
  request_id          text primary key references public.snippet_runs (request_id) on delete cascade,
  detected_language   text not null,
  explanation_hash    text not null,
  approved_at         timestamptz,
  formatted_markdown  text,
  four_statuses       jsonb not null check (
                        jsonb_typeof(four_statuses) = 'object'
                        and four_statuses ?& array['approved','delivered','detected','explained']
                        and (four_statuses - array['approved','delivered','detected','explained']) = '{}'::jsonb),
  event_chain_verified boolean not null default false,
  delivered_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists snippet_runs_touch on public.snippet_runs;
create trigger snippet_runs_touch before update on public.snippet_runs
  for each row execute function public.touch_updated_at();

-- The audit trail is append-only: events can be inserted, never edited or removed.
-- (TRUNCATE is not blocked, so you can still wipe the dev database.)
create or replace function public.forbid_event_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'workflow_events is append-only (% blocked)', tg_op;
end $$;

drop trigger if exists workflow_events_append_only on public.workflow_events;
create trigger workflow_events_append_only before update or delete on public.workflow_events
  for each row execute function public.forbid_event_mutation();

-- ---------------------------------------------------------------------------
-- History view for the sidebar (GET /api/history)
-- security_invoker => the view obeys the caller's RLS instead of the owner's.
-- ---------------------------------------------------------------------------
create or replace view public.run_history with (security_invoker = true) as
select
  r.request_id,
  r.source_id,
  r.state,
  r.language_name,
  r.output_hash,
  r.tags,
  r.created_at,
  a.decision,
  f.event_chain_verified
from public.snippet_runs r
left join public.approvals a on a.request_id = r.request_id
left join public.final_results f on f.request_id = r.request_id;

-- ---------------------------------------------------------------------------
-- Row Level Security: enabled, no policies => only service_role (bypasses RLS) gets in.
-- ---------------------------------------------------------------------------
alter table public.snippet_runs    enable row level security;
alter table public.workflow_events enable row level security;
alter table public.evidence        enable row level security;
alter table public.approvals       enable row level security;
alter table public.final_results   enable row level security;

revoke all on public.snippet_runs, public.workflow_events, public.evidence,
              public.approvals, public.final_results, public.run_history
  from anon, authenticated;