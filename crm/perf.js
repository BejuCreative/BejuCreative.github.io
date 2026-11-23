/* BEJÚ founder CRM: Performance page v2 (?p=perf). Founder-approved 11-23, spec docs/perf_1123/SPEC.md.
   Reads (founders only): v_perf_clients, v_perf_our_videos, v_perf_channel, v_perf_share, perf_health, link_suggestions (open),
   plus client_posts + deliveries for the suggestion cards. Writes: link_suggestions.status only ('accepted' | 'rejected');
   the data lane turns accepted ones into our_posts. A view that is missing or fails shows a calm "not ready" note, never an error.
   Rules: never "our Shorts brought N subscribers"; totals per platform, never summed across them; every number shows "as of";
   a platform older than 26 h (or ok=false) is red. Registered through window.BEJU_SIDE_PAGES, loads before side.js. CSP: no inline styles. */
(() => {
"use strict";
let A = null, D = null, SEL = null, MODE = "our";
const TZ = (window.BEJU_CRM || {}).timezone || "Europe/Vilnius";
const PL = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok" }, PORD = ["youtube", "instagram", "tiktok"];
const plN = p => PL[p] || p || "—";
const KIND = { monthly: "Monthly", pack: "Pack", recent: "Recent" };
const FLAG = { rescue: ["Rescue", "r", "alert"], upsell: ["Upsell", "g", "cash"], proof: ["Proof", "pv-proof", "star"] };
const STALE_H = 26;
const int = v => new Intl.NumberFormat("en-US").format(Math.round(+v || 0));
const kf = v => v == null || !isFinite(v) ? "—" : v >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : v >= 1e4 ? Math.round(v / 1e3) + "k" : v >= 1e3 ? (v / 1e3).toFixed(1).replace(/\.0$/, "") + "k" : String(Math.round(v));
const fAt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const at = t => t ? fAt.format(new Date(t)) : "never";
const hrs = t => t ? (Date.now() - new Date(t)) / 36e5 : Infinity;
const daysSince = t => t ? Math.max(0, Math.floor((Date.now() - new Date(t)) / 864e5)) : null;
const dur = s => s == null ? "" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const mine = (rows, c) => (rows || []).filter(r => A.lc(r.client_email) === c.key);
const notReady = what => `<p class="pv-nr">${A.ic("clock")}<span><b>${A.esc(what)}: not ready yet.</b> The numbers show here as soon as the data sync is live.</span></p>`;
const health = p => (D.health || []).find(h => h.platform === p) || null;
const stale = p => { const h = health(p); return !h || !h.ok || hrs(h.last_ok_at) > STALE_H; };
/* data-v="k:v;k2:v2" → CSS custom properties through the CSSOM (CSP forbids style="") */
const vars = root => root.querySelectorAll("[data-v]").forEach(el => el.dataset.v.split(";").forEach(p => { const i = p.indexOf(":"); if (i > 0) el.style.setProperty("--" + p.slice(0, i), p.slice(i + 1)); }));

/* ---------------- load ---------------- */
async function load(api) {
  A = api;
  const q = (t, mod) => api.all(t, "*", mod).catch(() => null);   // null = the view isn't there yet → "not ready"
  const [cl, vids, ch, sh, hl, sug] = await Promise.all([q("v_perf_clients"), q("v_perf_our_videos"),
    q("v_perf_channel", x => x.order("client_email").order("platform").order("day")), q("v_perf_share"), q("perf_health"),
    q("link_suggestions", x => x.eq("status", "open").order("created_at"))]);
  let posts = [], dels = [];
  if (sug && sug.length) {
    const pids = [...new Set(sug.map(s => s.post_id).filter(Boolean))], dids = [...new Set(sug.map(s => s.delivery_id).filter(Boolean))];
    const get = (t, cols, k, ids) => ids.length ? api.sb().from(t).select(cols).in(k, ids).then(r => r.data || [], () => []) : [];
    [posts, dels] = await Promise.all([get("client_posts", "platform,post_id,title,url,posted_at,duration_s", "post_id", pids), get("deliveries", "id,title,delivered_at", "id", dids)]);
  }
  const clients = cl ? cl.map(c => ({ ...c, key: api.lc(c.client_email), mrr: +c.mrr_usd || 0, delivered: +c.delivered || 0, posted: +c.posted || 0 }))
    .sort((a, b) => (b.flag === "rescue") - (a.flag === "rescue") || b.mrr - a.mrr || (+b.oldest_unposted_days || 0) - (+a.oldest_unposted_days || 0) || String(a.client_name || "").localeCompare(String(b.client_name || ""))) : null;
  return { clients, vids, ch, sh, health: hl, sug, posts, dels };
}

/* ---------------- top bar: one health badge per platform ---------------- */
function healthBar() {
  const { esc, ic } = A;
  if (!D.health || !D.health.length) return `<div class="pv-health">${notReady("Data health")}</div>`;
  return `<div class="pv-health" role="list" aria-label="Data freshness per platform">${PORD.map(p => { const h = health(p); if (!h) return "";
    const bad = stale(p), why = !h.ok ? "error" : bad ? "over 26 h old" : "fresh";
    return `<span role="listitem" class="pv-hb ${bad ? "r" : "g"}"${h.detail ? ` title="${esc(h.detail)}"` : ""}>${ic(bad ? "alert" : "check")}<b>${esc(plN(p))}</b>${p === "tiktok" ? `<small class="pv-be">best effort</small>` : ""}<span>${why} · as of ${esc(at(h.last_ok_at))}</span></span>`; }).join("")}</div>`;
}

/* ---------------- client list ---------------- */
const cover = c => `${c.delivered} delivered · ${c.posted} posted (${c.delivered ? Math.round(100 * c.posted / c.delivered) : 0}%)`;
function row(c) {
  const { esc, ic, usd, initials } = A, F = FLAG[c.flag], old = +c.oldest_unposted_days || 0;
  return `<a class="cl-item pv-item" href="?p=perf&amp;k=${encodeURIComponent(c.key)}" data-pv="${esc(c.key)}"${SEL === c.key ? ' aria-current="true"' : ""}>
    <span class="av">${esc(initials(c.client_name || c.client_email))}</span>
    <span class="grow"><span class="t">${esc(c.client_name || c.client_email)}</span>
      <span class="s">${esc(KIND[c.kind] || c.kind || "—")} · ${c.mrr ? `${usd(c.mrr)}/mo` : "no MRR"}</span>
      <span class="s">${esc(cover(c))}${old ? ` · oldest unposted <b class="${old > 7 ? "pv-late" : ""}">${old} d</b>` : ""}</span></span>
    ${F ? `<span class="pv-fl"><span class="chip ${F[1]}">${ic(F[2])}${F[0]}</span>${c.flag_reason ? `<small>${esc(c.flag_reason)}</small>` : ""}</span>` : ""}</a>`;
}

/* ---------------- detail ---------------- */
function head(c) {
  const { esc, ic, usd, dLabel, dayOf } = A, V = mine(D.vids, c), asOf = V.reduce((m, v) => (v.as_of && v.as_of > m ? v.as_of : m), "");
  const chips = [`<span class="chip">${esc(KIND[c.kind] || c.kind || "—")}</span>`, c.mrr ? `<span class="chip acc">${usd(c.mrr)} / month</span>` : "",
    c.plan_label ? `<span class="chip">${esc(c.plan_label)}</span>` : "", c.renewal_at ? `<span class="chip">renews ${esc(dLabel(dayOf(c.renewal_at)))}</span>` : "",
    c.started_at ? `<span class="chip">BEJÚ since ${esc(dLabel(dayOf(c.started_at)))}</span>` : ""].join("");
  const F = FLAG[c.flag];
  return `<div class="cl-head"><div><h2>${esc(c.client_name || c.client_email)}</h2><p>${esc(c.client_email)}${(c.platforms || []).length ? ` · ${esc(c.platforms.map(plN).join(", "))}` : ""}</p></div><div class="cl-chips">${chips}</div></div>
    <div class="pv-cov"><b class="mono">${esc(cover(c))}</b><small>live from the CRM${+c.oldest_unposted_days ? ` · oldest unposted ${+c.oldest_unposted_days} d` : ""}</small></div>
    ${F ? `<p class="pv-flag"><span class="chip ${F[1]}">${ic(F[2])}${F[0]}</span><span>${esc(c.flag_reason || "")}</span></p>` : ""}
    ${c.our_avg_views_d7 != null || c.baseline_median != null ? `<p class="pv-base">Our Shorts at day 7: avg <b class="mono">${kf(c.our_avg_views_d7 == null ? null : +c.our_avg_views_d7)}</b> views · their usual before us: <b class="mono">${kf(c.baseline_median == null ? null : +c.baseline_median)}</b>${asOf ? ` <small>as of ${esc(dLabel(asOf))}</small>` : ""}</p>` : ""}
    ${c.proof_line ? `<div class="pv-proofl"><p>${ic("star")}<span>${esc(c.proof_line)}</span></p><button type="button" class="act" data-copy>${ic("copy")}Copy</button></div>` : ""}`;
}
function sugCard(s) {
  const { esc, ic, dLabel, dayOf } = A, p = D.posts.find(x => x.platform === s.platform && x.post_id === s.post_id) || {};
  const o = (D.vids || []).find(v => String(v.delivery_id) === String(s.delivery_id)) || {}, dl = D.dels.find(x => String(x.id) === String(s.delivery_id)) || {};
  const label = o.short_label || dl.title || "One of our Shorts", delAt = o.delivered_at || dl.delivered_at;
  const th = s.platform === "youtube" && /^[\w-]{6,20}$/.test(s.post_id || "") ? `<img class="pv-th" src="https://i.ytimg.com/vi/${encodeURIComponent(s.post_id)}/mqdefault.jpg" alt="" loading="lazy" width="160" height="90">` : `<span class="pv-th">${ic("play")}</span>`;
  return `<div class="pv-sc" data-sid="${esc(s.id)}">
    <div class="pv-sp"><small>Ours</small><b>${esc(label)}</b><span>${delAt ? `delivered ${esc(dLabel(dayOf(delAt)))}` : ""}</span></div>
    <a class="pv-sp pv-their" href="${esc(p.url || "#")}" target="_blank" rel="noopener noreferrer">${th}<span><small>Their ${esc(plN(s.platform))} post</small><b>${esc(p.title || s.post_id || "Post")}</b><span>${[p.duration_s != null ? dur(+p.duration_s) : "", p.posted_at ? `posted ${dLabel(dayOf(p.posted_at))}` : ""].filter(Boolean).map(esc).join(" · ")}</span></span></a>
    ${s.reason ? `<p class="sp-note pv-why">${esc(s.reason)}${s.score != null ? ` · match ${Math.round(+s.score * (+s.score <= 1 ? 100 : 1))}%` : ""}</p>` : ""}
    <div class="pv-sb"><button type="button" class="act go" data-sug="${esc(s.id)}" data-st="accepted">${ic("check")}Yes, ours</button><button type="button" class="act" data-sug="${esc(s.id)}" data-st="rejected">${ic("x")}No</button></div>
    <p class="pv-err" role="alert" hidden></p></div>`;
}
function sugs(c) {
  const S = mine(D.sug, c).filter(s => s.status === "open"); if (!S.length) return "";
  return `<div class="cl-plan pv-sug"><b class="cl-ph">Is this our Short?</b><p class="sp-note">A post that may be one of ours. Yes links it (it shows under Our videos after the next sync). No hides it.</p>${S.map(sugCard).join("")}</div>`;
}
function ourVideos(c) {
  const { esc, ic, dLabel, dayOf } = A;
  if (!D.vids) return notReady("Per-Short numbers");
  const V = mine(D.vids, c), posted = V.filter(v => v.post_id).sort((a, b) => String(b.posted_at || "").localeCompare(String(a.posted_at || "")));
  const byDel = {}; V.forEach(v => { const k = v.delivery_id || v.short_label; (byDel[k] = byDel[k] || []).push(v); });
  const waiting = Object.values(byDel).filter(a => !a.some(v => v.post_id)).map(a => a[0]).sort((a, b) => String(a.delivered_at || "").localeCompare(String(b.delivered_at || "")) || String(a.short_label || "").localeCompare(String(b.short_label || ""), "en", { numeric: true }));
  const tot = PORD.concat([...new Set(posted.map(v => v.platform))].filter(p => !PORD.includes(p))).map(p => { const r = posted.filter(v => v.platform === p); if (!r.length) return "";
    const s = k => r.reduce((a, v) => a + (+v[k] || 0), 0), asOf = r.reduce((m, v) => (v.as_of && v.as_of > m ? v.as_of : m), ""), bad = stale(p);
    return `<div class="pv-tot${bad ? " r" : ""}"><b>${esc(plN(p))}${p === "tiktok" ? ` <small class="pv-be">best effort</small>` : ""}</b><span class="mono pv-big">${kf(s("views"))}</span><small>views on our ${r.length} Short${r.length === 1 ? "" : "s"} · ${kf(s("likes"))} likes · ${kf(s("comments"))} comments</small><small>as of ${esc(asOf ? dLabel(asOf) : "—")}${bad ? " · data over 26 h old" : ""}</small></div>`; }).join("");
  const card = v => `<a class="pv-v${v.removed ? " gone" : ""}" href="${esc(v.url || "#")}" target="_blank" rel="noopener noreferrer" title="Open on ${esc(plN(v.platform))}">
    <span class="pv-vh"><b>${esc(v.short_label || "Short")}</b>${ic("link")}</span>
    <span class="pv-vc"><span class="chip">${esc(plN(v.platform))}</span>${v.removed ? `<span class="chip o">removed · last stats</span>` : ""}${v.linked_by && v.linked_by !== "auto" ? `<span class="chip">linked by ${esc(v.linked_by)}</span>` : ""}</span>
    <span class="pv-vn"><b class="mono">${kf(v.views == null ? null : +v.views)}</b><small>views</small></span>
    <small class="mono">${int(v.likes)} likes · ${int(v.comments)} comments · day 7: ${v.views_d7 == null ? "—" : kf(+v.views_d7)}</small>
    <small>posted ${esc(v.posted_at ? dLabel(dayOf(v.posted_at)) : "—")} · as of ${esc(v.as_of ? dLabel(v.as_of) : "—")}</small></a>`;
  return `<p class="pv-covl">${esc(cover(c))}</p>
    ${tot ? `<div class="pv-tots">${tot}</div><p class="sp-note">Totals are per platform and never added together.</p>` : ""}
    ${posted.length ? `<div class="pv-vg">${posted.map(card).join("")}</div>` : `<p class="empty">None of our Shorts is linked to a post yet.</p>`}
    ${waiting.length ? `<div class="cl-plan pv-wait"><b class="cl-ph">Delivered, not posted yet · ${waiting.length}</b>${waiting.map(v => { const n = daysSince(v.delivered_at); return `<div class="cl-pr"><span class="grow">${esc(v.short_label || "Short")}</span><span class="mono">delivered ${esc(v.delivered_at ? dLabel(dayOf(v.delivered_at)) : "—")}</span><span class="chip ${n > 7 ? "r" : ""}">waiting ${n == null ? "—" : n} d</span></div>`; }).join("")}</div>` : ""}`;
}

/* total channel: one small line chart per measure (never two y-scales on one chart) */
const CH = {};
function chart(id, title, pts, start) {
  const { esc, dLabel } = A;
  if (pts.length < 2) return `<figure class="pv-ch"><figcaption><b>${esc(title)}</b></figcaption><p class="empty">${pts.length ? "Not enough days yet (1 day so far)." : "No numbers for this yet."}</p></figure>`;
  const t = d => new Date(d + "T12:00:00Z").getTime(), t0 = t(pts[0].d), t1 = t(pts[pts.length - 1].d), vs = pts.map(p => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs); if (hi === lo) { hi += 1; lo = Math.max(0, lo - 1); }
  const X = d => (t(d) - t0) / (t1 - t0) * 100, Y = v => 100 - (v - lo) / (hi - lo) * 92 - 4;
  CH[id] = { pts, X, Y };
  const path = pts.map((p, i) => `${i ? "L" : "M"}${(X(p.d) * 10).toFixed(1)} ${Y(p.v).toFixed(2)}`).join(" ");
  const sd = start ? A.dayOf(start) : "", sx = sd ? Math.max(0, Math.min(100, X(sd))) : null, before = sd && sd < pts[0].d, last = pts[pts.length - 1];
  return `<figure class="pv-ch"><figcaption><b>${esc(title)}</b><span class="mono">${kf(last.v)}</span><small>as of ${esc(dLabel(last.d))}</small></figcaption>
    <div class="pv-plot" data-ch="${esc(id)}" role="img" aria-label="${esc(`${title}: ${kf(pts[0].v)} on ${dLabel(pts[0].d)}, ${kf(last.v)} on ${dLabel(last.d)}`)}">
      <span class="pv-y hi mono">${kf(hi)}</span><span class="pv-y lo mono">${kf(lo)}</span>
      <svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">${[25, 50, 75].map(y => `<line class="pv-grid" x1="0" x2="1000" y1="${y}" y2="${y}" vector-effect="non-scaling-stroke"/>`).join("")}${sx != null ? `<line class="pv-mk" x1="${sx * 10}" x2="${sx * 10}" y1="0" y2="100" vector-effect="non-scaling-stroke"/>` : ""}<path class="pv-line" d="${path}" vector-effect="non-scaling-stroke"/></svg>
      ${sx != null ? `<span class="pv-mkl${sx > 70 ? " end" : ""}" data-v="x:${sx.toFixed(2)}%">BEJÚ started${before ? " (before this data)" : ""}</span>` : ""}
      <i class="pv-dot" hidden></i><span class="pv-tip mono" hidden></span></div>
    <div class="pv-x mono"><span>${esc(dLabel(pts[0].d))}</span><span>${esc(dLabel(last.d))}</span></div></figure>`;
}
function channel(c) {
  const { esc } = A;
  const share = !D.sh ? notReady("Share of channel views") : mine(D.sh, c).map(s => `<div class="pv-share${stale(s.platform) ? " r" : ""}"><small>${esc(plN(s.platform))} · last 30 days</small>
      <p>Our Shorts = <b class="mono">${s.share_pct == null ? "—" : (Math.round(+s.share_pct * 10) / 10) + "%"}</b> of the channel's views, last 30 days (our ${+s.our_posts_n || 0} post${+s.our_posts_n === 1 ? "" : "s"})</p>
      <small class="mono">${kf(+s.our_views)} of ${kf(+s.channel_views)} views · ${+s.delivered_n || 0} delivered · as of ${esc(health(s.platform) ? at(health(s.platform).last_ok_at) : "—")}${stale(s.platform) ? " · data over 26 h old" : ""}</small></div>`).join("") || `<p class="empty">No share numbers for this client yet.</p>`;
  if (!D.ch) return share + notReady("Channel history");
  const S = mine(D.ch, c), pls = PORD.filter(p => S.some(r => r.platform === p));
  const body = pls.map(p => { const r = S.filter(x => x.platform === p).sort((a, b) => String(a.day).localeCompare(String(b.day))), ser = k => r.filter(x => x[k] != null).map(x => ({ d: String(x.day).slice(0, 10), v: +x[k] }));
    return `<div class="pv-pl"><b class="cl-ph">${esc(plN(p))}${p === "tiktok" ? " · best effort" : ""}${stale(p) ? ` <span class="chip r">data over 26 h old</span>` : ""}</b><div class="pv-chs">${chart(c.key + "|" + p + "|f", "Followers", ser("followers"), c.started_at)}${chart(c.key + "|" + p + "|v", "Total views", ser("total_views"), c.started_at)}</div></div>`; }).join("");
  return `<div class="pv-shares">${share}</div>${body || `<p class="empty">No channel history for this client yet.</p>`}`;
}
function detail(c) {
  if (!c) return `<p class="empty">Pick a client on the left.</p>`;
  return `${head(c)}${sugs(c)}<div class="seg pv-seg" role="group" aria-label="Show"><button type="button" data-pvm="our" class="${MODE === "our" ? "on" : ""}" aria-pressed="${MODE === "our"}">Our videos</button><button type="button" data-pvm="channel" class="${MODE === "channel" ? "on" : ""}" aria-pressed="${MODE === "channel"}">Total channel</button></div>
    <div class="pv-body">${MODE === "our" ? ourVideos(c) : channel(c)}</div>`;
}

/* ---------------- view + wire ---------------- */
function view(d, api) {
  A = api; D = d;
  if (!d.clients) return `${healthBar()}<section class="card sp-card">${notReady("Client performance")}</section>`;
  if (!d.clients.length) return `${healthBar()}<section class="card sp-card"><p class="empty">No clients yet.</p></section>`;
  const k = api.lc(new URLSearchParams(location.search).get("k") || "");
  SEL = (d.clients.find(c => c.key === k) || d.clients[0]).key;
  return `${healthBar()}<div class="cl-wrap pv-wrap"><section class="card sp-card"><p class="sp-note pv-lh">Rescue first, then by MRR. Delivered and posted counts are live; views are as of the badges above.</p><div class="cl-list" id="pv-list">${d.clients.map(row).join("")}</div></section>
    <section class="card sp-card" id="pv-detail">${detail(d.clients.find(c => c.key === SEL))}</section></div>`;
}
function bindCharts(root) {
  vars(root);
  root.querySelectorAll(".pv-plot[data-ch]").forEach(el => {
    const C = CH[el.dataset.ch], dot = el.querySelector(".pv-dot"), tip = el.querySelector(".pv-tip"); if (!C) return;
    const move = ev => { const b = el.getBoundingClientRect(), f = Math.max(0, Math.min(100, (ev.clientX - b.left) / b.width * 100));
      const p = C.pts.reduce((m, q) => Math.abs(C.X(q.d) - f) < Math.abs(C.X(m.d) - f) ? q : m, C.pts[0]), x = C.X(p.d);
      dot.hidden = tip.hidden = false; [dot, tip].forEach(n => { n.style.setProperty("--x", x + "%"); n.style.setProperty("--y", C.Y(p.v) + "%"); });
      tip.classList.toggle("end", x > 60); tip.textContent = `${A.dLabel(p.d)} · ${new Intl.NumberFormat("en-US").format(p.v)}`; };
    el.addEventListener("pointermove", move); el.addEventListener("pointerdown", move);
    el.addEventListener("pointerleave", () => { dot.hidden = tip.hidden = true; });
  });
}
function paintDetail() {
  const box = A.el.querySelector("#pv-detail"); if (!box) return;
  box.innerHTML = detail(D.clients.find(c => c.key === SEL)); bindCharts(box);
}
async function setSug(btn) {
  const id = btn.dataset.sug, st = btn.dataset.st, card = btn.closest(".pv-sc"), err = card.querySelector(".pv-err");
  card.querySelectorAll("button").forEach(b => { b.disabled = true; }); err.hidden = true;
  try {
    const { data, error } = await A.sb().from("link_suggestions").update({ status: st }).eq("id", id).select("id");
    if (error) throw error;
    if (!data || !data.length) throw { code: "42501" };   // nothing came back: row-level security refused it
    const s = D.sug.find(x => String(x.id) === String(id)); if (s) s.status = st;
    paintDetail(); A.toast(st === "accepted" ? "Linked. It shows under Our videos after the next sync." : "Hidden: not ours.");
  } catch (e) {
    card.querySelectorAll("button").forEach(b => { b.disabled = false; }); err.hidden = false;
    err.textContent = e && (e.code === "42501" || /row-level security|permission denied/i.test(e.message || "")) ? "Not saved: the database refused it (founders only). Sign in again, then retry." : `Couldn't save: ${String((e && e.message) || e).slice(0, 140)}`;
  }
}
function wire(api) {
  A = api; const el = api.el, list = el.querySelector("#pv-list"), box = el.querySelector("#pv-detail");
  bindCharts(el);
  list?.addEventListener("click", ev => {
    const a = ev.target.closest("[data-pv]"); if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey) return; ev.preventDefault();
    SEL = a.dataset.pv; list.querySelectorAll("[data-pv]").forEach(x => x.dataset.pv === SEL ? x.setAttribute("aria-current", "true") : x.removeAttribute("aria-current"));
    paintDetail(); history.replaceState({ p: "perf" }, "", `?p=perf&k=${encodeURIComponent(SEL)}`);
    if (innerWidth <= 900) box.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  });
  box?.addEventListener("click", ev => {
    const m = ev.target.closest("[data-pvm]"); if (m) { MODE = m.dataset.pvm; paintDetail(); box.querySelector(`[data-pvm="${MODE}"]`)?.focus(); return; }
    const s = ev.target.closest("[data-sug]"); if (s) { setSug(s); return; }
    if (ev.target.closest("[data-copy]")) { const c = D.clients.find(x => x.key === SEL); if (c && c.proof_line) navigator.clipboard.writeText(c.proof_line).then(() => A.toast("Proof line copied"), () => A.toast("Couldn't copy. Select the text instead.")); }
  });
}
(window.BEJU_SIDE_PAGES = window.BEJU_SIDE_PAGES || {}).perf = {
  title: "Client performance",
  head: ["Client <em class=\"sf\">performance</em>", "Every client: did they post our Shorts, how those did, and the whole channel. Every number shows its date."],
  src: d => { const H = d && d.health; if (!H || !H.length) return null; const o = H.map(h => h.last_ok_at).filter(Boolean).sort()[0] || null;
    return ["YouTube API, Instagram, TikTok (best effort)", o, H.some(h => !h.ok || hrs(h.last_ok_at) > STALE_H), "A platform is more than 26 hours old or failed: see the red badge"]; },
  load, view, wire,
};
})();
