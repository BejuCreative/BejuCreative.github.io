begin;
-- crm_scope_items2.sql: a 5th area on public.scope_items, 'asks' = the concrete things a funnel client asked for in her/his emails.
-- The Funnel client board groups areas into 4 categories (Simas 11-25): Website (websites + seo) · Content (shorts + posting) ·
-- Funnel & sales (lead_magnets + setup + reports + other) · What the client asked (asks + the client's inbound emails).
-- Simas's Claude 11-25. Applied via the Management API. ONE transaction.
--
-- What it changes: the area check only (drop + re-add with 'asks'). No rows change.
-- Needs: crm_scope_items1.sql.
-- Rollback (move or delete the 'asks' rows first): alter table public.scope_items drop constraint scope_items_area_check;
--   alter table public.scope_items add constraint scope_items_area_check check (area in ('websites', 'lead_magnets', 'posting', 'shorts', 'seo', 'reports', 'setup', 'other'));

alter table public.scope_items drop constraint if exists scope_items_area_check;
alter table public.scope_items add constraint scope_items_area_check
  check (area in ('websites', 'lead_magnets', 'posting', 'shorts', 'seo', 'reports', 'setup', 'other', 'asks'));

commit;
