-- job 1885: link a squawk_tickets row back to its squawk-engine approvals.json record.
-- Closes the gap where the Owners Dashboard's "Resolve" tap only ever flipped this
-- Supabase row and never reached approvals.json[nonce].status — the ONE field
-- squawk_sla_alarm.py (and squawk_authority.py / squawk_writeback_gate.py /
-- squawk_closeout_sweep.py) actually read, so a dashboard-resolved squawk still
-- paged Cory at its SLA deadline (the 2026-08-16 Empire Warranty false-page).
-- squawk_engine.py's sync_seat_status() now stamps this column on every status
-- transition it mirrors to the seat (job 1885). Additive, reversible, nullable —
-- existing rows and existing readers are unaffected until a row gets stamped.
--
-- Rollback:
--   alter table public.squawk_tickets drop column if exists engine_nonce;

alter table public.squawk_tickets
  add column if not exists engine_nonce text;

create index if not exists squawk_tickets_engine_nonce_idx
  on public.squawk_tickets (engine_nonce)
  where engine_nonce is not null;
