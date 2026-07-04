-- Michael seat — honest status lifecycle + append-only notes thread (job 383; additive, reversible).
-- Widens squawk_tickets.status to the job-263 self-heal lifecycle (back-compat with the
-- existing open/resolved/archived/dismissed values — no data rewrite) and adds an
-- append-only per-ticket notes table so Michael can leave continued notes and reopen.
--
-- Rollback (after resetting any new-status rows: update public.squawk_tickets
--   set status='open' where status not in ('open','resolved','archived','dismissed');):
--   drop table if exists public.squawk_ticket_notes;
--   alter table public.squawk_tickets drop constraint if exists squawk_tickets_status_check;
--   alter table public.squawk_tickets add constraint squawk_tickets_status_check
--     check (status in ('open','resolved','archived','dismissed'));
--   alter table public.squawk_tickets drop column if exists reopened_at;

alter table public.squawk_tickets drop constraint if exists squawk_tickets_status_check;
alter table public.squawk_tickets add constraint squawk_tickets_status_check
  check (status in (
    'open','triaged','in_progress','needs_info',
    'resolved','resolved_verified','green_soak','reopened',
    'archived','dismissed'
  ));

alter table public.squawk_tickets
  add column if not exists reopened_at timestamptz;

create table if not exists public.squawk_ticket_notes (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid not null references public.squawk_tickets(id) on delete cascade,
  org_id          uuid not null,
  author_user_id  uuid,
  author_role     text not null default 'system' check (author_role in ('rep','system','owner')),
  author_name     text not null default 'System',
  text            text not null,
  created_at      timestamptz not null default now()
);

create index if not exists squawk_ticket_notes_ticket_idx
  on public.squawk_ticket_notes (ticket_id, created_at);

alter table public.squawk_ticket_notes enable row level security;

-- Rep sees notes only on his own tickets; owner sees org-wide. Append-only:
-- insert only on own tickets, and NO update/delete policies exist at all.
create policy notes_self_select on public.squawk_ticket_notes
  for select to authenticated
  using (exists (
    select 1 from public.squawk_tickets t
    where t.id = ticket_id and t.user_id = auth.uid()
  ));

create policy notes_owner_select on public.squawk_ticket_notes
  for select to authenticated
  using (org_id = current_org_id() and current_user_role() = 'owner');

create policy notes_self_insert on public.squawk_ticket_notes
  for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1 from public.squawk_tickets t
      where t.id = ticket_id and t.user_id = auth.uid()
    )
  );
