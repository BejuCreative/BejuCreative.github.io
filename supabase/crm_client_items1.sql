-- crm_client_items1.sql: the client delivery board (Clients page: one board per client + an all-clients board).
-- Prepared by Benas's side; apply only with a founder's go / Simas's side review. NOT applied to any database yet.
--
-- ADDITIVE ONLY. What it adds:
--   1. public.client_items: one row per Short (or other piece) we make for a client, with the batch it belongs to and where it is
--      on the board: building -> ready -> sent -> changes (the client asked for changes) -> approved (their written OK, quote stored).
--   2. clients.hold_sends: "always wait for a founder" for that client's delivery emails (no 60-minute auto-send).
--   3. drafts: the category 'client_delivery' (the batch delivery email), auto-sent 60 min after it is drafted unless a founder
--      sends, edits or sends it back, or the client has hold_sends. Same mechanics as the 'sample' category (30 min).
-- Needs: crm.sql (clients), crm_drafts1.sql + crm_drafts_sample.sql + crm_drafts_auto_send.sql (drafts, drafts_guard,
-- draft_auto_approve, drafts_waiting). The drafts_guard below is crm_drafts_auto_send.sql's function with the 'client_delivery'
-- category added; diff it against the live function before applying.
-- Rollback: drop trigger clients_hold_sends_sync on public.clients; drop function public.clients_hold_sends_sync();
--   restore drafts_guard / draft_auto_approve from crm_drafts_auto_send.sql; drop function public.drafts_auto_window(text, text);
--   restore the drafts_category_check without 'client_delivery' (only once no row uses it); alter table public.clients drop column hold_sends;
--   alter publication supabase_realtime drop table public.client_items; drop table public.client_items.

-- 1. the items ---------------------------------------------------------------------------------------------------------
create table if not exists public.client_items (
  id             bigint generated always as identity primary key,
  client_id      uuid references public.clients on delete cascade,
  client_name    text,                                  -- as shown on the board (kept if the client row is renamed)
  batch_key      text,                                  -- items with the same client + batch_key are one stacked card; null = a one-off
  title          text not null,
  kind           text,                                  -- short / long / reel / ...
  status         text not null default 'building'
                 check (status in ('building', 'ready', 'sent', 'changes', 'approved')),
  status_at      timestamptz not null default now(),    -- when the status last changed (kept by the trigger below)
  drive_link     text,
  file_name      text,
  builder        text,
  due_at         timestamptz,
  sent_at        timestamptz,
  approved_at    timestamptz,
  approved_quote text,                                  -- the client's own words; only on 'approved'
  changes_note   text,                                  -- what they asked to change; only on 'changes'
  draft_id       bigint references public.drafts on delete set null,   -- the delivery email this item goes out with
  created_by     text,
  updated_at     timestamptz not null default now()
);
create index if not exists client_items_client_status_idx on public.client_items (client_id, status);
create index if not exists client_items_batch_idx on public.client_items (batch_key);

create or replace function public.client_items_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' or new.status is distinct from old.status then new.status_at := now(); end if;
  return new;
end $$;
drop trigger if exists client_items_touch on public.client_items;
create trigger client_items_touch before insert or update on public.client_items for each row execute function public.client_items_touch();

-- same policies as public.pipeline: founders read, founders update (rows are created by the service role, like pipeline's)
alter table public.client_items enable row level security;
drop policy if exists "founders read" on public.client_items;
create policy "founders read" on public.client_items for select using (public.is_admin());
drop policy if exists "founders write client_items" on public.client_items;
create policy "founders write client_items" on public.client_items for update using (public.is_admin()) with check (public.is_admin());

-- live updates on the board (row-level security still decides who receives a row)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'client_items') then
    alter publication supabase_realtime add table public.client_items;
  end if;
end $$;

-- 2. hold_sends --------------------------------------------------------------------------------------------------------
alter table public.clients add column if not exists hold_sends boolean not null default false;

-- 3. drafts: the 'client_delivery' category -------------------------------------------------------------------------------
alter table public.drafts drop constraint if exists drafts_category_check;
alter table public.drafts add constraint drafts_category_check
  check (category in ('big_deal', 'client_problem', 'new_terms', 'big_name', 'other', 'sample', 'client_delivery'));

-- how long an untouched draft of this category waits before it sends itself; null = never (not an auto category, or the client holds)
create or replace function public.drafts_auto_window(p_category text, p_lead text) returns interval
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when p_category = 'sample' then interval '30 minutes'
    when p_category = 'client_delivery' then
      case when exists (select 1 from public.clients c where c.hold_sends and lower(p_lead) = any (c.emails)) then null else interval '60 minutes' end
  end
$$;
revoke execute on function public.drafts_auto_window(text, text) from public, anon, authenticated;

create or replace function public.drafts_guard() returns trigger
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare founder text; sys boolean := not public.drafts_founder(); auto_ok boolean; fix_ok boolean; win interval;
begin
  new.body_sha256 := encode(sha256(convert_to(new.body, 'UTF8')), 'hex');
  new.updated_at := now();
  win := public.drafts_auto_window(new.category, new.lead_email);
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then raise exception 'a new draft starts as pending'; end if;
    new.approved_sha256 := null; new.decided_by := null; new.decided_at := null;
    new.auto_send_at := case when win is not null then now() + win end;   -- sample 30 min; client_delivery 60 min unless hold_sends
    return new;
  end if;
  -- who / where / to whom never changes after the draft is written (the approval covers all of it)
  if (new.lead_email, new.inbox, new.reply_to_id, new.to_email, new.cc_list, new.created_by, new.created_at)
     is distinct from (old.lead_email, old.inbox, old.reply_to_id, old.to_email, old.cc_list, old.created_by, old.created_at) then
    raise exception 'draft % : lead, inbox, thread and recipients are fixed once written (make a new draft)', old.id;
  end if;
  if old.status in ('sent', 'rejected') then raise exception 'draft % is % and final', old.id, old.status; end if;
  -- the two system moves of an auto-sending delivery email
  --   auto_ok: the window passed with no founder action -> the sender's run approves the exact text as it stands
  --   fix_ok:  a founder sent it back ("What to change"); Claude saved the fix -> pending again, a fresh window
  auto_ok := sys and old.category in ('sample', 'client_delivery') and old.status = 'pending' and new.status = 'approved' and old.auto_send_at is not null
             and old.auto_send_at <= now() and new.body is not distinct from old.body and new.approved_sha256 = new.body_sha256;
  fix_ok := sys and old.category in ('sample', 'client_delivery') and old.status = 'held' and new.status = 'pending';
  if auto_ok then new.decided_by := 'auto: ' || (case when old.category = 'sample' then '30' else '60' end) || ' min, no founder change'; new.decided_at := now(); new.auto_send_at := null; return new; end if;
  if fix_ok then new.approved_sha256 := null; new.founder_note := null; new.decided_by := null; new.decided_at := null;
    new.auto_send_at := case when win is not null then now() + win end; return new; end if;
  if old.status = 'sending' and not sys then raise exception 'draft % is being sent right now; wait a minute', old.id; end if;
  if new.body is distinct from old.body and old.status not in ('pending', 'held') then
    if old.status = 'approved' and not sys then new.status := 'pending'; new.approved_sha256 := null;   -- founder edit: approve again
    else raise exception 'draft % can only be edited while pending or held', old.id; end if;
  end if;
  if new.status is distinct from old.status then
    if new.status in ('approved', 'held', 'rejected', 'pending') and not (old.status = 'sending' and new.status = 'approved' and sys) then
      if sys then raise exception 'only a founder can set a draft to %', new.status; end if;
      if old.status = 'unknown' and new.status <> 'rejected' then
        raise exception 'draft % may have been sent; check Instantly, then close it (rejected). It cannot be re-approved.', old.id;
      end if;
      if new.status = 'approved' then
        if old.status not in ('pending', 'held', 'failed', 'stale') then raise exception 'cannot approve from %', old.status; end if;
        if new.approved_sha256 is null or new.approved_sha256 <> new.body_sha256 then
          raise exception 'the text changed since you looked at it; reload and approve again';
        end if;
      else
        new.approved_sha256 := null;
      end if;
      select coalesce(nullif(name, ''), email) into founder from public.profiles where id = auth.uid();
      new.decided_by := founder; new.decided_at := now();
    elsif new.status = 'sending' then
      if not sys or old.status <> 'approved' or old.approved_sha256 is distinct from new.body_sha256 then
        raise exception 'only the sender can claim an approved, unchanged draft';
      end if;
    elsif new.status in ('sent', 'failed', 'unknown', 'stale') then
      if not sys or old.status <> 'sending' then raise exception 'only the sender, after claiming, can set %', new.status; end if;
    end if;
  elsif new.approved_sha256 is distinct from old.approved_sha256 then
    raise exception 'approved_sha256 changes only together with a status change';
  end if;
  if new.category in ('sample', 'client_delivery') then   -- the clock runs only while the email waits untouched
    if new.status <> 'pending' then new.auto_send_at := null;
    elsif new.body is distinct from old.body or old.status <> 'pending' then new.auto_send_at := case when win is not null then now() + win end; end if;
  end if;
  return new;
end $function$;

create or replace function public.draft_auto_approve() returns integer
language sql security definer set search_path = public, pg_temp as $$
  with x as (update public.drafts set status = 'approved', approved_sha256 = encode(sha256(convert_to(body, 'UTF8')), 'hex')
              where category in ('sample', 'client_delivery') and status = 'pending' and auto_send_at <= now() returning id)
  select count(*)::int from x;
$$;
revoke execute on function public.draft_auto_approve() from public, anon, authenticated;

-- turning "always wait for a founder" on stops the clock of that client's waiting delivery email; turning it off starts a fresh 60 minutes
create or replace function public.clients_hold_sends_sync() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.hold_sends is distinct from old.hold_sends then
    update public.drafts set auto_send_at = case when new.hold_sends then null else now() + interval '60 minutes' end
     where category = 'client_delivery' and status = 'pending' and lower(lead_email) = any (new.emails);
  end if;
  return new;
end $$;
revoke execute on function public.clients_hold_sends_sync() from public, anon, authenticated;
drop trigger if exists clients_hold_sends_sync on public.clients;
create trigger clients_hold_sends_sync after update of hold_sends on public.clients for each row execute function public.clients_hold_sends_sync();
