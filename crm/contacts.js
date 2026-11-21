/* BEJÚ founder CRM: Contacts page (?p=contacts). BENAS 11-21 17:37 / 19:31: one list of every PERSON we talk to.
   Reads public.contacts ONCE per visit (one row per person; the view recomputes on every query, so search and filters run here
   in the browser). Tap a row: a client opens the client drill, anyone else the lead drawer (both live in crm.js).
   "Edit details" writes public.contact_info (phone, role, LinkedIn, tags, notes) by contact_id, as the signed-in founder (RLS is_admin).
   Registered with side.js through window.BEJU_SIDE_PAGES, so this file loads before side.js. CSP: no inline styles. */
(() => {
"use strict";
const COLS = "contact_id,primary_email,emails,name,company,role,phone,linkedin,tags,notes,client_id,is_client,lifetime_usd,stage,owner,next_step,next_at,last_contact_at,open_orders,open_tasks,open_promises,on_hold";
const STAGE_L = { replied: "Replied", engaged: "Engaged", proposal: "Proposal", committed: "Committed", won: "Won", parked: "Parked", lost: "Lost" };
const OPEN_ST = new Set(["replied", "engaged", "proposal", "committed"]);
const FILTERS = [["all", "All", () => true], ["clients", "Clients", c => c.is_client], ["open", "Open deals", c => OPEN_ST.has(c.stage)], ["hold", "On hold", c => c.on_hold], ["simas", "Simas", c => c.owner === "Simas"], ["benas", "Benas", c => c.owner === "Benas"]];
let A = null, D = null, Q = "", F = "all", QFOCUS = false;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const keyOf = c => A.lc([c.name, c.company, c.role, ...(c.emails || []), c.primary_email, ...(c.tags || [])].filter(Boolean).join(" "));
function prep(c) {
  c.lifetime_usd = +c.lifetime_usd || 0; c.tags = Array.isArray(c.tags) ? c.tags : []; c.emails = Array.isArray(c.emails) ? c.emails : [];
  c.k = keyOf(c); return c;
}
/* clients first by lifetime $, then the newest conversation */
const byOrder = (a, b) => (b.is_client - a.is_client) || (a.is_client ? b.lifetime_usd - a.lifetime_usd : 0) || String(b.last_contact_at || "").localeCompare(String(a.last_contact_at || ""));

function shown() {
  const f = (FILTERS.find(x => x[0] === F) || FILTERS[0])[2], q = A.lc(Q).split(/\s+/).filter(Boolean);
  return D.rows.filter(c => f(c) && q.every(w => c.k.includes(w)));
}
function row(c) {
  const { esc, ic, usd, dLabel, dayOf, initials } = A, nm = c.name || c.primary_email || "No email on file";
  const sub = [c.company, c.role].filter(Boolean).join(" · ") || (c.name ? c.primary_email : "") || "";
  const open = c.client_id ? `data-act="drill" data-k="client" data-a="c:${esc(c.client_id)}" title="Open the client: payments, videos, conversation"`
    : `data-act="lead" data-email="${esc(c.primary_email)}" title="Open the lead"`;
  const late = c.next_at && new Date(c.next_at) < Date.now(), st = c.stage ? `<span class="chip ${OPEN_ST.has(c.stage) ? "b" : c.stage === "won" ? "g" : ""}">${esc(STAGE_L[c.stage] || c.stage)}</span>` : "";
  const counts = [c.open_orders && plural(c.open_orders, "open order", "open orders"), c.open_tasks && plural(c.open_tasks, "task", "tasks"), c.open_promises && plural(c.open_promises, "promise", "promises")].filter(Boolean);
  return `<div class="ct-row tile" data-id="${esc(c.contact_id)}">
    <button type="button" class="ct-main" ${open}>
      <span class="av">${esc(initials(nm))}</span>
      <span class="ct-who"><span class="ct-nl"><b>${esc(nm)}</b>${c.is_client ? `<span class="chip g">Client</span>` : ""}${c.on_hold ? `<span class="chip r">${ic("flag")}On hold</span>` : ""}</span>${sub ? `<small>${esc(sub)}</small>` : ""}${c.tags.length ? `<span class="ct-tags">${c.tags.map(t => `<span class="chip">${esc(t)}</span>`).join("")}</span>` : ""}</span>
      <span class="ct-next">${c.next_step ? `<span class="ct-nx" title="${esc(c.next_step)}">${c.next_at ? `<i class="${late ? "late" : ""}">${esc(dLabel(dayOf(c.next_at)))}</i>` : ""}${esc(c.next_step)}</span>` : ""}${counts.length ? `<small class="ct-cn">${esc(counts.join(" · "))}</small>` : ""}</span>
      <span class="ct-meta">${st}${c.owner ? `<small>${esc(c.owner)}</small>` : ""}</span>
      <span class="ct-usd">${c.lifetime_usd > 0 ? esc(usd(c.lifetime_usd)) : ""}</span>
    </button>
    <button type="button" class="icon-btn ct-ed" data-ct-edit="${esc(c.contact_id)}" aria-expanded="false" aria-label="Edit details: ${esc(nm)}" title="Edit details">${ic("edit")}</button>
  </div>`;
}
function form(c) {
  const { esc } = A, v = k => esc(c[k] == null ? "" : c[k]);
  return `<form class="ct-form" data-keep data-id="${esc(c.contact_id)}" novalidate>
    <p class="ct-fh"><b>Edit details</b><small>${esc(c.name || c.primary_email || "")}</small></p>
    <label><span>Phone</span><input name="phone" type="tel" maxlength="40" autocomplete="off" value="${v("phone")}"></label>
    <label><span>Role</span><input name="role" type="text" maxlength="120" placeholder="e.g. Host, marketing lead" value="${v("role")}"></label>
    <label class="w2"><span>LinkedIn</span><input name="linkedin" type="text" inputmode="url" maxlength="300" placeholder="linkedin.com/in/…" autocapitalize="none" spellcheck="false" value="${v("linkedin")}"></label>
    <label class="w4"><span>Tags (comma between them)</span><input name="tags" type="text" maxlength="400" placeholder="e.g. podcast, referral" value="${esc(c.tags.join(", "))}"></label>
    <label class="w4"><span>Notes</span><textarea name="notes" rows="3" maxlength="4000">${v("notes")}</textarea></label>
    <p class="ct-err w4" role="alert" hidden></p>
    <div class="ct-fb w4"><span class="sp-note">Founders only. It stays with this person on all their addresses.</span><button type="button" class="act" data-ct-cancel>Cancel</button><button type="submit" class="act go">Save</button></div>
  </form>`;
}
function view(d, api) {
  A = api; D = d;
  return `<section class="card sp-card ct-card">
    <div class="ct-tools"><input class="cl-q ct-q" id="ct-q" type="search" placeholder="Search a name, email, company or tag" aria-label="Search contacts" autocomplete="off" spellcheck="false" value="${api.esc(Q)}">
      <div class="ct-chips" role="group" aria-label="Show">${FILTERS.map(([k, l, f]) => `<button type="button" class="chip${F === k ? " acc" : ""}" data-ctf="${k}" aria-pressed="${F === k}">${l}<span class="ct-cnt">${d.rows.filter(f).length}</span></button>`).join("")}</div></div>
    <p class="ct-n sp-note" id="ct-n" aria-live="polite"></p>
    <div class="stack ct-list" id="ct-list"></div>
  </section>`;
}
function paint() {
  const list = A.el.querySelector("#ct-list"), n = A.el.querySelector("#ct-n"); if (!list) return;
  const rows = shown(), keep = list.querySelector(".ct-form"), cl = rows.filter(c => c.is_client), all = D.rows.length;
  n.textContent = `${rows.length === all ? plural(all, "person", "people") : `${rows.length} of ${plural(all, "person", "people")}`}${cl.length ? ` · ${plural(cl.length, "client", "clients")} · ${A.usd(cl.reduce((s, c) => s + c.lifetime_usd, 0))} paid in total` : ""}`;
  list.innerHTML = rows.map(row).join("") || `<p class="empty">No one matches. Try part of a name, an email or a tag.</p>`;
  if (keep) { const r = list.querySelector(`.ct-row[data-id="${CSS.escape(keep.dataset.id)}"]`); if (r) { r.after(keep); r.querySelector(".ct-ed").setAttribute("aria-expanded", "true"); } }
}
function closeForm(focus) {
  const f = A.el.querySelector(".ct-form"); if (!f) return;
  const b = A.el.querySelector(`.ct-ed[data-ct-edit="${CSS.escape(f.dataset.id)}"]`); f.remove();
  if (b) { b.setAttribute("aria-expanded", "false"); if (focus) b.focus(); }
}
function clean(v, max) { v = String(v || "").trim(); return v ? v.slice(0, max) : null; }
async function save(f) {
  const c = D.rows.find(x => x.contact_id === f.dataset.id), err = f.querySelector(".ct-err"), go = f.querySelector('button[type="submit"]'); if (!c) return;
  const say = t => { err.hidden = false; err.textContent = t; };
  let li = clean(f.elements.linkedin.value, 300);
  if (li && !/^https?:\/\//i.test(li)) li = "https://" + li;
  if (li) { try { const u = new URL(li); if (!/\./.test(u.hostname)) throw 0; } catch { say("LinkedIn: paste the profile link, e.g. linkedin.com/in/name."); f.elements.linkedin.focus(); return; } }
  const seen = new Set(), tags = String(f.elements.tags.value || "").split(",").map(t => t.trim().slice(0, 40)).filter(t => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, 12);
  const me = await A.me().catch(() => null);
  const rec = { contact_id: c.contact_id, phone: clean(f.elements.phone.value, 40), role: clean(f.elements.role.value, 120), linkedin: li, tags, notes: clean(f.elements.notes.value, 4000),
    updated_by: (me && (me.who !== "Both" ? me.who : me.name)) || null, updated_at: new Date().toISOString() };
  go.disabled = true; err.hidden = true;
  try {
    const { data, error } = await A.sb().from("contact_info").upsert(rec, { onConflict: "contact_id" }).select("contact_id,phone,role,linkedin,tags,notes");
    if (error) throw error;
    if (!data || !data.length) throw { code: "42501" };   // nothing came back: the row-level security refused it
    Object.assign(c, data[0]); prep(c);
    closeForm(false); paint();
    const b = A.el.querySelector(`.ct-ed[data-ct-edit="${CSS.escape(c.contact_id)}"]`); if (b) b.focus();
    A.toast(`Saved: ${c.name || c.primary_email || "contact"}`);
  } catch (e) {
    go.disabled = false;
    const rls = e && (e.code === "42501" || /row-level security|permission denied/i.test(e.message || ""));
    say(rls ? "Not saved: the database refused it (founders only). Your 2-step login may have expired: sign out, sign in again, then save."
      : `Couldn't save: ${String((e && e.message) || e).slice(0, 160)}`);
  }
}
function wire(api) {
  A = api; const el = api.el, q = el.querySelector("#ct-q"), list = el.querySelector("#ct-list");
  paint();
  q.addEventListener("input", () => { Q = q.value; paint(); });
  q.addEventListener("focus", () => { QFOCUS = true; }); q.addEventListener("blur", () => { QFOCUS = false; });
  if (QFOCUS) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }   // the 5-minute refresh redraws the page: keep typing
  el.querySelectorAll("[data-ctf]").forEach(b => b.addEventListener("click", () => {
    F = b.dataset.ctf; el.querySelectorAll("[data-ctf]").forEach(x => { const on = x.dataset.ctf === F; x.classList.toggle("acc", on); x.setAttribute("aria-pressed", on); }); paint();
  }));
  list.addEventListener("click", ev => {
    const e = ev.target.closest("[data-ct-edit]"), x = ev.target.closest("[data-ct-cancel]");
    if (x) return closeForm(true);
    if (!e) return;
    const was = e.getAttribute("aria-expanded") === "true", c = D.rows.find(r => r.contact_id === e.dataset.ctEdit); closeForm(false);
    if (was || !c) return;
    e.closest(".ct-row").insertAdjacentHTML("afterend", form(c)); e.setAttribute("aria-expanded", "true"); list.querySelector(".ct-form input").focus();
  });
  list.addEventListener("submit", ev => { const f = ev.target.closest(".ct-form"); if (!f) return; ev.preventDefault(); save(f); });
  list.addEventListener("keydown", ev => { if (ev.key === "Escape" && ev.target.closest(".ct-form")) { ev.stopPropagation(); closeForm(true); } });
}
(window.BEJU_SIDE_PAGES = window.BEJU_SIDE_PAGES || {}).contacts = {
  title: "Contacts",
  head: ["All <em class=\"sf\">contacts</em>", "Everyone we talk to, one row per person: clients first by money paid, then the newest conversations."],
  src: d => d ? ["CRM database", d.at] : null,
  load: async api => { A = api; const rows = await api.all("contacts", COLS, x => x.order("contact_id")); return { rows: rows.map(prep).sort(byOrder), at: new Date().toISOString() }; },
  view, wire,
};
})();
