begin;
-- crm_client_review1.sql: the client board's ONE review screen (BENAS 11-24: "the delivery draft is already done; we click the Ready
-- card, watch each Short, then approve; we see the email that will go out, edit it inside the CRM or send it as it is").
-- Prepared by Benas's Claude 11-24. NOT APPLIED. Runs as ONE transaction. Needs crm_client_items1.sql (client_items, drafts
-- category 'client_delivery', drafts_guard) applied first.
--
-- ADDITIVE ONLY. What it adds:
--   1. client_items.founder_ok_at / founder_ok_by: a founder watched this Short in the review screen and approved it (per Short).
--      Written by the CRM with the founder's own login. The existing policy "founders write client_items" (FOR UPDATE, is_admin())
--      is row-level and names no columns, so it already covers the two new columns; the CRM needs no new policy or grant.
--      Check before applying (expect UPDATE on the TABLE for authenticated, i.e. no column-only grants that would leave these out):
--        select privilege_type from information_schema.role_table_grants
--         where table_schema = 'public' and table_name = 'client_items' and grantee = 'authenticated';
--   2. a trigger on public.drafts: when a client_delivery draft becomes 'sent', its linked items (client_items.draft_id = drafts.id)
--      move to 'sent' with sent_at = now(). Items a founder marked 'changes' stay where they are (they wait for the fix), and an item
--      the client already approved ('approved') never moves back.
-- Rollback: drop trigger drafts_delivery_sent on public.drafts; drop function public.drafts_delivery_sent();
--   alter table public.client_items drop column founder_ok_by; alter table public.client_items drop column founder_ok_at;

-- 1. per-Short founder approval ------------------------------------------------------------------------------------------
alter table public.client_items add column if not exists founder_ok_at timestamptz;   -- when a founder approved this Short (review screen)
alter table public.client_items add column if not exists founder_ok_by text;          -- which founder (profiles.name)

-- 2. the delivery email went out -> its Shorts are Sent ------------------------------------------------------------------
create or replace function public.drafts_delivery_sent() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.category = 'client_delivery' and new.status = 'sent' and old.status is distinct from 'sent' then
    update public.client_items set status = 'sent', sent_at = now()
     where draft_id = new.id and status not in ('changes', 'approved', 'sent');
  end if;
  return new;
end $$;
revoke execute on function public.drafts_delivery_sent() from public, anon, authenticated;
drop trigger if exists drafts_delivery_sent on public.drafts;
create trigger drafts_delivery_sent after update of status on public.drafts for each row execute function public.drafts_delivery_sent();
commit;
