begin;
-- crm_scope_items1.sql: the Funnel clients page (founder CRM, ?p=funnel). Clients who paid for more than videos, and every thing
-- their scope promised (sites we build, lead magnets, posting, Shorts, SEO, reports, ...), so the founders see whether we are on track.
-- Prepared by Benas's Claude 11-24 (founder ask, Simas 11-24). NOT applied yet: review, then run it once in the SQL editor. ONE transaction.
--
-- ADDITIVE ONLY. What it adds:
--   1. public.scope_items: one row per promise in a funnel client's scope, in an area (websites / lead_magnets / posting / shorts /
--      seo / reports / setup / other), with a due date, an owner and a status: not_started -> in_progress -> waiting_client -> live
--      (or dropped). done_at is kept by the trigger (set when an item goes live, cleared when it leaves live).
--      Founders read, tick (update) and add (insert) items from the CRM; the service role (Claude's scripts) writes everything.
--   2. clients.funnel: marks a client who paid for more than videos (they show on the Funnel clients page). Set by the service role
--      only: a founder's login cannot change it (guard trigger below), so the page never moves a client in or out by accident.
-- Needs: crm.sql (clients, is_admin()).
-- Rollback: drop trigger clients_funnel_guard on public.clients; drop function public.clients_funnel_guard();
--   alter table public.clients drop column funnel;
--   alter publication supabase_realtime drop table public.scope_items; drop table public.scope_items; drop function public.scope_items_touch();

-- 1. the scope items ----------------------------------------------------------------------------------------------------
create table if not exists public.scope_items (
  id          bigint generated always as identity primary key,
  client_id   uuid references public.clients on delete cascade,
  area        text not null
              check (area in ('websites', 'lead_magnets', 'posting', 'shorts', 'seo', 'reports', 'setup', 'other')),
  title       text not null,
  detail      text,                                  -- the scope's own words: what exactly we promised
  due_at      timestamptz,                           -- for a recurring item: the next time it is due
  owner       text check (owner is null or owner in ('Benas', 'Simas', 'Both', 'Claude')),
  status      text not null default 'not_started'
              check (status in ('not_started', 'in_progress', 'waiting_client', 'live', 'dropped')),
  link        text,                                  -- the live site / doc / folder
  sort        int default 0,                         -- order inside its area
  recurring   text check (recurring is null or recurring in ('weekly', 'monthly')),
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  done_at     timestamptz                            -- when it went live (kept by the trigger below)
);
create index if not exists scope_items_client_idx on public.scope_items (client_id, area, sort);
create index if not exists scope_items_due_idx on public.scope_items (due_at) where status not in ('live', 'dropped');

create or replace function public.scope_items_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'live' then
    if tg_op = 'INSERT' or old.status is distinct from 'live' then new.done_at := coalesce(new.done_at, now()); end if;
  else
    new.done_at := null;
  end if;
  return new;
end $$;
drop trigger if exists scope_items_touch on public.scope_items;
create trigger scope_items_touch before insert or update on public.scope_items for each row execute function public.scope_items_touch();

-- founders read, founders tick an item's status and add items from the CRM; the service role (no RLS) writes everything
alter table public.scope_items enable row level security;
drop policy if exists "founders read" on public.scope_items;
create policy "founders read" on public.scope_items for select using (public.is_admin());
drop policy if exists "founders write scope_items" on public.scope_items;
create policy "founders write scope_items" on public.scope_items for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "founders add scope_items" on public.scope_items;
create policy "founders add scope_items" on public.scope_items for insert with check (public.is_admin());

-- live updates on the page (row-level security still decides who receives a row)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scope_items') then
    alter publication supabase_realtime add table public.scope_items;
  end if;
end $$;

-- 2. clients.funnel -----------------------------------------------------------------------------------------------------
alter table public.clients add column if not exists funnel boolean not null default false;

-- a signed-in user (a founder's login from the CRM) cannot flip it; the service role and the SQL editor (no auth.uid()) can
create or replace function public.clients_funnel_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.funnel is distinct from old.funnel and auth.uid() is not null then
    raise exception 'clients.funnel is set by the service role only';
  end if;
  return new;
end $$;
revoke execute on function public.clients_funnel_guard() from public, anon, authenticated;
drop trigger if exists clients_funnel_guard on public.clients;
create trigger clients_funnel_guard before update of funnel on public.clients for each row execute function public.clients_funnel_guard();
commit;
