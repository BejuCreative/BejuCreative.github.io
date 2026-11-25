begin;
-- crm_scope_items3.sql: public.scope_items is the "What we're doing" work list of every funnel client (Simas 11-25: "make sure we're
-- tracking what we are doing for each client in the funnel, always filling it in"). Any Claude logs work with crm.funnel_work(...).
-- Simas's Claude 11-25. Applied via the Management API. ONE transaction.
--
-- What it changes (no rows change):
--   1. note: the latest short progress note on an item (the long description stays in detail). updated_at already moves on every write.
--   2. status: + 'waiting_founder' (a founder has to decide or approve before we can go on).
--   3. owner: + 'Simas''s Claude' and 'Benas''s Claude' (who does the work when it is not a founder).
-- Grants: table-level, so the new column is covered by the existing grants + row-level security (is_admin()).
-- Needs: crm_scope_items1.sql, crm_scope_items2.sql.
-- Rollback (move rows off the new values first): alter table public.scope_items drop column note; then re-add the two checks from
--   crm_scope_items1.sql (status without 'waiting_founder'; owner in ('Benas', 'Simas', 'Both', 'Claude')).

alter table public.scope_items add column if not exists note text;

alter table public.scope_items drop constraint if exists scope_items_status_check;
alter table public.scope_items add constraint scope_items_status_check
  check (status in ('not_started', 'in_progress', 'waiting_client', 'waiting_founder', 'live', 'dropped'));

alter table public.scope_items drop constraint if exists scope_items_owner_check;
alter table public.scope_items add constraint scope_items_owner_check
  check (owner is null or owner in ('Benas', 'Simas', 'Both', 'Claude', 'Simas''s Claude', 'Benas''s Claude'));

commit;
