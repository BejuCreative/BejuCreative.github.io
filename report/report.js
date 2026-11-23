/* BEJÚ private weekly report page (SIMAS 11-23, docs/perf_1123/REPORTS_SPEC.md).
   bejucreative.digital/report/?t=<token> → POST rpc/report_public {token} with the public anon key (crm/config.js).
   The RPC returns only this report's data + the client's first name, or nothing for an unknown token. Render = render.js (shared with the CRM). */
(() => {
"use strict";
const root = document.getElementById("bjr-root"), C = window.BEJU_CRM || {}, R = window.BEJU_REPORT;
const msg = (h, p, retry) => { root.innerHTML = `<div class="bjr-msg"><div><b>BEJÚ Creative</b><h1>${R.esc(h)}</h1><p>${R.esc(p)}</p>${retry ? `<button type="button" id="bjr-retry">Try again</button>` : ""}</div></div>`;
  document.title = h + " · BEJÚ Creative"; if (retry) document.getElementById("bjr-retry").addEventListener("click", load); };
const invalid = () => msg("This report link isn't valid", "Check that you opened the full link from our email. If it still doesn't work, just reply to that email and we'll send a fresh one.");
const tok = (new URLSearchParams(location.search).get("t") || "").trim();

/* accept the shapes the RPC may return: {data, first_name} · [{...}] · the data object itself */
function unwrap(j) {
  if (Array.isArray(j)) j = j[0];
  if (!j || typeof j !== "object") return null;
  if (j.data && typeof j.data === "object") return { d: j.data, name: j.first_name || j.client_first_name || j.name || "" };
  if (j.report_public && typeof j.report_public === "object") return unwrap(j.report_public);
  return R.isV1(j) ? { d: j, name: "" } : null;
}
async function load() {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(tok) || !C.supabaseUrl || !C.supabaseAnonKey) return invalid();
  root.innerHTML = `<div class="bjr-msg"><div><span class="bjr-load" aria-hidden="true"></span><p>Loading your report…</p></div></div>`;
  let res;
  try {
    res = await fetch(C.supabaseUrl + "/rest/v1/rpc/report_public", { method: "POST", cache: "no-store", referrerPolicy: "no-referrer",
      headers: { apikey: C.supabaseAnonKey, Authorization: "Bearer " + C.supabaseAnonKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token: tok }) });
  } catch (e) { return msg("We couldn't load your report", "Your connection dropped for a moment. Try again in a few seconds.", true); }
  if (res.status === 404 || res.status === 400 || res.status === 401 || res.status === 403) return invalid();
  if (!res.ok) return msg("We couldn't load your report", "Something on our side didn't answer. Try again in a minute.", true);
  let j = null; try { j = await res.json(); } catch (e) { j = null; }
  const r = unwrap(j); if (!r || !R.isV1(r.d)) return invalid();
  root.innerHTML = R.render(r.d, { name: r.name });
  const wk = R.weekLabel(r.d.week_start, r.d.week_end); document.title = `Your weekly report${wk ? ", " + wk : ""} · BEJÚ Creative`;
}
load();
})();
