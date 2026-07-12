-- Apprentice Window — shadow draft ledger + optional coach notes (job 663; additive, reversible).
-- Backs the read-only "Apprentice" panel on Michael's /protected seat: the shadow lane's
-- draft-vs-sent pairs, match-quality trend, and per-category maturity. Service-role writes only
-- (n8n shadow lane / local scorer bypass RLS); authenticated users get org-scoped SELECT.
-- Compartmentalization: this stores apprentice progress ONLY — no replication/multiplication data.
--
-- Rollback:
--   drop table if exists public.apprentice_coach_notes;
--   drop table if exists public.shadow_draft_ledger;

create table if not exists public.shadow_draft_ledger (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null,
  lane             text not null default 'michael',
  thread_id        text,
  inbound_msg_id   text unique,
  inbound_excerpt  text,
  category         text,                 -- price|coverage|claim|objection|escalation|other
  shadow_draft     text not null,        -- what the apprentice would have written
  sent_reply       text,                 -- Michael's actual sent reply (null until harvested)
  drafted_at       timestamptz not null default now(),
  sent_at          timestamptz,
  normalized_edit  numeric,              -- 0..1 substantive-rewrite fraction (lower = closer)
  similarity       numeric,              -- 1 - normalized_edit
  raw_edit         numeric,
  edit_category    text,                 -- template_paste|rewrite|light|unchanged
  judge_min_dim    numeric,
  judge_scores     jsonb,
  edit_ok          boolean,
  judge_ok         boolean,
  scored_at        timestamptz,
  source           text not null default 'shadow_live',  -- shadow_live|backfill
  created_at       timestamptz not null default now()
);

create index if not exists shadow_draft_ledger_org_scored_idx
  on public.shadow_draft_ledger (org_id, scored_at desc nulls last);
create index if not exists shadow_draft_ledger_org_cat_idx
  on public.shadow_draft_ledger (org_id, category);

alter table public.shadow_draft_ledger enable row level security;

-- Org members (owner + the rep) may READ apprentice progress. No authenticated writes:
-- the shadow lane and scorer write via the service role (RLS-bypassing). Read-only by construction.
drop policy if exists shadow_ledger_org_select on public.shadow_draft_ledger;
create policy shadow_ledger_org_select on public.shadow_draft_ledger
  for select to authenticated
  using (org_id = current_org_id());

-- Optional coach affordance: the rep may leave an improved version of a past shadow draft.
-- Append-only, zero obligation. Highest-weight training signal (harvested later by the flywheel).
create table if not exists public.apprentice_coach_notes (
  id               uuid primary key default gen_random_uuid(),
  ledger_id        uuid not null references public.shadow_draft_ledger(id) on delete cascade,
  org_id           uuid not null,
  author_user_id   uuid,
  author_name      text not null default 'rep',
  improved_text    text not null,
  why              text,
  created_at       timestamptz not null default now()
);

create index if not exists apprentice_coach_notes_ledger_idx
  on public.apprentice_coach_notes (ledger_id, created_at);

alter table public.apprentice_coach_notes enable row level security;

-- Rep/owner in the org may read coach notes; a rep may insert on their own org's rows.
-- Append-only: NO update/delete policies exist at all.
drop policy if exists coach_notes_org_select on public.apprentice_coach_notes;
create policy coach_notes_org_select on public.apprentice_coach_notes
  for select to authenticated
  using (org_id = current_org_id());

drop policy if exists coach_notes_self_insert on public.apprentice_coach_notes;
create policy coach_notes_self_insert on public.apprentice_coach_notes
  for insert to authenticated
  with check (author_user_id = auth.uid() and org_id = current_org_id());
