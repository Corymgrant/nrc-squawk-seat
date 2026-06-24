-- Squawk Box Rebuild: "Teach the Assistant" corrections + image attachments
-- Mirrors squawk_tickets conventions (current_org_id(), current_user_role(), RLS).

-- 1) Corrections table (flywheel source of truth) ---------------------------------
create table if not exists public.squawk_corrections (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null,
  user_id           uuid not null,
  reporter          text,
  not_say           text not null,
  should_say        text not null,
  context           text,
  category          text not null check (category in ('compliance','wording','factual')),
  applies_to        text not null default 'michael' check (applies_to in ('michael','erika','both')),
  distilled_rule    text,
  hindsight_memory_id text,
  status            text not null default 'pending' check (status in ('pending','active','error')),
  promote_to_gate   boolean not null default false,
  gate_promoted_at  timestamptz,
  error             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table public.squawk_corrections enable row level security;

drop policy if exists corrections_insert on public.squawk_corrections;
create policy corrections_insert on public.squawk_corrections
  for insert to authenticated
  with check ((user_id = auth.uid()) and (org_id = current_org_id()));

drop policy if exists corrections_self_select on public.squawk_corrections;
create policy corrections_self_select on public.squawk_corrections
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists corrections_owner_select on public.squawk_corrections;
create policy corrections_owner_select on public.squawk_corrections
  for select to authenticated
  using ((org_id = current_org_id()) and (current_user_role() = 'owner'::user_role));

drop policy if exists corrections_self_update on public.squawk_corrections;
create policy corrections_self_update on public.squawk_corrections
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists squawk_corrections_org_created_idx
  on public.squawk_corrections (org_id, created_at desc);

-- 2) Image attachment on tickets --------------------------------------------------
alter table public.squawk_tickets add column if not exists image_path text;

-- 3) Private storage bucket for squawk images -------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('squawk-images', 'squawk-images', false, 10485760,
        array['image/png','image/jpeg','image/jpg','image/webp','image/gif','image/heic'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;
