-- A3 lane for the Teach-the-Assistant correction window (additive, reversible).
-- Widen squawk_corrections.applies_to CHECK to allow the A3 engagement-engine lane,
-- so an applies_to='a3' correction records a row (it previously failed the CHECK and 500'd).
-- Rollback: re-add the constraint without 'a3' (no a3 rows must exist).
alter table public.squawk_corrections
  drop constraint squawk_corrections_applies_to_check;
alter table public.squawk_corrections
  add constraint squawk_corrections_applies_to_check
  check (applies_to in ('michael','erika','both','a3'));
