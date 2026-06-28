-- Operator Console — squawk ticket lifecycle (additive, reversible).
-- Adds a status lifecycle to squawk_tickets so the owner console can mark tickets
-- resolved / archived / dismissed (test+PROOF junk) instead of only reading them.
-- Soft-state only — no hard deletes, no data rewrite. Existing rows default to 'open'.
--
-- Rollback (no data loss; only console management features stop working):
--   alter table public.squawk_tickets drop column if exists status;
--   alter table public.squawk_tickets drop column if exists resolved_at;
--   alter table public.squawk_tickets drop column if exists archived_at;
--   alter table public.squawk_tickets drop column if exists status_updated_at;

alter table public.squawk_tickets
  add column if not exists status text not null default 'open'
    check (status in ('open','resolved','archived','dismissed'));

alter table public.squawk_tickets
  add column if not exists resolved_at timestamptz;

alter table public.squawk_tickets
  add column if not exists archived_at timestamptz;

alter table public.squawk_tickets
  add column if not exists status_updated_at timestamptz;

create index if not exists squawk_tickets_status_idx
  on public.squawk_tickets (org_id, status, created_at desc);
