-- job 1966: "WHAT'S CHANGING THIS WEEK" context strip on Michael's Squawk Box seat.
-- A small, chat-Claude-writable table (service-role only — no client insert/update
-- policy exists, by design) that surfaces 1-2 plain-English heads-up lines at the
-- top of /protected. Empty table -> the strip renders nothing (no row, no card).
-- Additive, reversible.
--
-- Rollback:
--   drop table if exists public.cockpit_michael_context;

create table if not exists public.cockpit_michael_context (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  message     text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz
);

alter table public.cockpit_michael_context enable row level security;

-- Any authenticated seat (rep or owner) in the org can READ. No insert/update/delete
-- policy for `authenticated` -- writes are service-role only (chat-Claude seat, via
-- the admin client / direct SQL), never the app itself.
drop policy if exists cockpit_michael_context_org_select on public.cockpit_michael_context;
create policy cockpit_michael_context_org_select on public.cockpit_michael_context
  for select to authenticated
  using (org_id = current_org_id());

create index if not exists cockpit_michael_context_org_created_idx
  on public.cockpit_michael_context (org_id, created_at desc);
