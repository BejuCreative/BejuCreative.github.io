/* BEJÚ founder CRM: Client performance (?p=perf), v4. SIMAS 11-23: "very hard to read … go all out so it's easy for us to see, great
   visuals, easy tracking, everything understandable". A VISUAL tracker: numbers, rings, sparklines, thumbnails; almost no sentences.
   1. Overview (top): Shorts made vs plan · posted by clients · views on our Shorts · best Short · one sync line (the data refreshes every 6 h).
   2. Client list (left, scrolls; a sideways scroller on phones): initials, "18 / 60 made · 4 posted", a thin bar, one attention dot.
   3. Client: 4 stat tiles, then tabs Our videos | Channel | Report.
      Our videos = ONLY Shorts we delivered that are posted + linked (cards, by views); the rest is one collapsed strip of pills.
                   Open link checks ("is this post ours?") are resolved in the backend, not here: only a count in the sync tooltip.
      Channel    = followers + total views lines, share donut (30 d), their top posts. Under 3 days of history: a "building" state.
      Report     = the v3 weekly report (../report/render.js, Edit / Hold / Send / Past reports): same rpc report_send + drafts approve flow.
   Data (founders read): v_perf_clients, v_perf_plan (docs/perf_1123/v4_views.sql), v_perf_our_videos, v_perf_share, v_perf_channel,
   perf_health, client_accounts, client_post_stats, client_posts, link_suggestions (count only), report_clients, client_reports,
   v_perf_post_deltas + v_perf_client_deltas (the small ▲ +N change numbers; a NULL or a missing view shows nothing, never a 0).
   Rules: a stale platform (sync failed or > 26 h old) is never added into a total; every number has an "as of" tooltip; never
   "our Shorts brought N subscribers". CSP: no inline styles (CSSOM only), inline SVG charts, no libraries. */
(() => {
"use strict";
let A = null, D = null, SEL = null, TAB = "videos", CHP = null, HERO_DONE = false, WAIT_OPEN = false;
const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
let RAIL = store.get("beju-crm-perf-rail") === "1";   // the client list as a slim rail (avatars only); remembered on this device
let VIEW = null, EDIT = false, MAIL = null, PAST = false, ADJ = false;   // ADJ = an unsent "For Claude" note is being typed   // report tab state
const CH = {};   // channel tab cache: client key -> { series, top } | "load" | "err"
const R = () => window.BEJU_REPORT, X = () => window.BEJU_CRM_SAMPLES || {};
const TZ = (window.BEJU_CRM || {}).timezone || "Europe/Vilnius";
const PL = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok" }, PORD = ["youtube", "instagram", "tiktok"], PIC = { youtube: "yt", instagram: "ig", tiktok: "tt" };
const plN = p => PL[p] || p || "";
const STALE_H = 26, SYNC_EVERY_H = 6, MIN_DAYS = 3, GOAL_DAYS = 7;
const nf = new Intl.NumberFormat("en-US");
const int = v => v == null || !isFinite(+v) ? "–" : nf.format(Math.round(+v));
const kf = v => { if (v == null || !isFinite(+v)) return "–"; const a = Math.abs(+v); return a >= 1e6 ? (a / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : a >= 1e4 ? Math.round(a / 1e3) + "k" : a >= 1e3 ? (a / 1e3).toFixed(1).replace(/\.0$/, "") + "k" : String(Math.round(a)); };
const fAt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const at = t => t ? fAt.format(new Date(t)) : "never";
const hrs = t => t ? (Date.now() - new Date(t)) / 36e5 : Infinity;
const daysAgo = s => s ? (Date.now() - new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + "T23:59:59Z" : s)) / 864e5 : Infinity;
const dur = h => h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} d`;
const motion = () => !matchMedia("(prefers-reduced-motion: reduce)").matches && document.documentElement.dataset.motion !== "calm";
const health = p => (D.health || []).find(h => h.platform === p) || null;
const stale = p => { const h = health(p); return !h || !h.ok || hrs(h.last_ok_at) > STALE_H; };
const staleTip = p => { const h = health(p); return `${plN(p)}: old data${h && h.last_day ? `, last read ${A.dLabel(h.last_day)}` : ""}. Not in any total.`; };
const missing = e => e && (e.code === "PGRST202" || e.code === "42883" || e.code === "42P01" || e.code === "PGRST205" || /could not find|does not exist/i.test(e.message || ""));
const refused = e => e && (e.code === "42501" || /row-level security|permission denied/i.test(e.message || ""));
const ytOk = id => /^[\w-]{6,20}$/.test(id || "");
const safeUrl = u => { try { const x = new URL(String(u || "")); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch (e) { return ""; } };
const shortNo = l => { const m = /short\s*(\d+)/i.exec(l || ""); return m ? +m[1] : 1e9; };
const planName = s => { const m = /^short_(\d+)$/i.exec(s || ""); return m ? `${m[1]} Shorts pack` : /^pack$/i.test(s || "") ? "Pack" : s || ""; };
const empty = (icon, title, sub) => `<div class="pf-empty"><span class="pf-empty-i">${A.ic(icon)}</span><b>${A.esc(title)}</b>${sub ? `<span>${A.esc(sub)}</span>` : ""}</div>`;

/* ---------------- load ---------------- */
async function load(api) {
  A = api;
  const q = (t, mod, cols) => api.all(t, cols || "*", mod).catch(() => null);   // null = can't be read → that block shows a calm empty state
  const [cl, plan, vids, hl, acc, share, sug, rc, cr, pd, cd] = await Promise.all([q("v_perf_clients"), q("v_perf_plan"), q("v_perf_our_videos"), q("perf_health"),
    q("client_accounts", null, "email,platform,handle,url,followers,posts_count,updated_at"), q("v_perf_share"),
    q("link_suggestions", x => x.eq("status", "open"), "id,client_email,delivery_id"), q("report_clients", x => x.eq("active", true)),
    q("client_reports", x => x.neq("status", "internal").order("week", { ascending: false })), q("v_perf_post_deltas"), q("v_perf_client_deltas")]);
  if (!cl) throw new Error("The performance data can't be read. Sign in again, then retry.");
  const get = (t, cols, k, ids, mod) => ids.length ? (mod || (x => x))(api.sb().from(t).select(cols).in(k, ids)).then(r => r.data || [], () => []) : [];
  const ours = [...new Set((vids || []).map(v => v.post_id).filter(Boolean))], d14 = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
  const stats = await get("client_post_stats", "platform,post_id,day,views", "post_id", ours, x => x.gte("day", d14).order("day").limit(5000));
  return model({ cl, plan, vids: vids || [], health: hl || [], acc: acc || [], share: share || [], sug: sug || [], rc, cr, stats, pd, cd });
}

const weekEnd = r => (r.data && r.data.week_end) || r.week;
const CHIP = { due: ["Due", "r"], draft: ["Draft ready", "b"], held: ["Held", "o"], sending: ["Sending", "b"], sent: ["Sent this week", "g"] };
const chip = s => `<span class="chip ${CHIP[s][1]}">${CHIP[s][0]}</span>`;

/* change numbers: the week when the view has it, else the day; null = unknown = show nothing. Sums skip nulls and stay null when all are. */
const pickD = (r, k) => !r ? null : r[k + "_d7"] != null ? [+r[k + "_d7"], "this week"] : r[k + "_d1"] != null ? [+r[k + "_d1"], "today"] : null;
function sumD(rows, k) { const w = rows.filter(r => r[k + "_d7"] != null), d = rows.filter(r => r[k + "_d1"] != null);
  return w.length ? [w.reduce((a, r) => a + +r[k + "_d7"], 0), "this week"] : d.length ? [d.reduce((a, r) => a + +r[k + "_d1"], 0), "today"] : null; }
function model(x) {
  D = x;   // health() / stale() read D
  const lc = A.lc, days = [...new Set(x.stats.map(s => s.day))].sort().slice(-14), S = new Map();
  x.stats.forEach(s => { const k = s.platform + "|" + s.post_id; (S.get(k) || S.set(k, []).get(k)).push(s); });
  /* one views line for a set of posts: per day, each post's latest known count (a post already live keeps its first count backwards, so a
     newly read post never draws a fake jump) */
  const series = posts => days.length < 2 ? [] : days.map(d => posts.reduce((a, p) => { const st = S.get(p.platform + "|" + p.post_id) || []; let v = null;
    for (const r of st) { if (r.day <= d) v = +r.views || 0; else break; }
    if (v == null && st.length && p.posted_at && String(p.posted_at).slice(0, 10) <= d) v = +st[0].views || 0;
    return a + (v || 0); }, 0));
  const reps = (x.cr || []).map(r => ({ ...r, key: lc(r.email) }));
  const keys = [...new Set([...x.cl.map(c => lc(c.client_email)), ...(x.rc || []).map(c => lc(c.email))])];
  const clients = keys.map(key => {
    const c = x.cl.find(r => lc(r.client_email) === key) || {}, rc = (x.rc || []).find(r => lc(r.email) === key) || null, P = (x.plan || []).find(r => lc(r.client_email) === key) || null;
    const V = x.vids.filter(v => lc(v.client_email) === key), byDel = new Map();
    V.forEach(v => { const d = byDel.get(v.delivery_id) || byDel.set(v.delivery_id, { label: v.short_label || "Short", delivered_at: v.delivered_at, posts: [] }).get(v.delivery_id); if (v.post_id) d.posts.push(v); });
    const posts = V.filter(v => v.post_id).sort((a, b) => (+b.views || 0) - (+a.views || 0));
    posts.forEach(p => { p.spark = series([p]); p.dx = (x.pd || []).find(r => r.platform === p.platform && r.post_id === p.post_id) || null; });
    const CD = (x.cd || []).filter(r => lc(r.client_email) === key), cdOf = p => CD.find(r => r.platform === p) || null;
    const waiting = [...byDel.values()].filter(d => !d.posts.length).sort((a, b) => shortNo(a.label) - shortNo(b.label) || String(a.label).localeCompare(String(b.label)));
    const made = P ? +P.made || 0 : byDel.size, posted = byDel.size - waiting.length;
    const hasPlan = !!(P && +P.plan_total > 0), fresh = posts.filter(p => !stale(p.platform));
    const viewsBy = PORD.map(p => ({ p, n: posts.filter(v => v.platform === p).length, views: posts.filter(v => v.platform === p).reduce((a, v) => a + (+v.views || 0), 0), stale: stale(p) })).filter(r => r.n);
    const all = reps.filter(r => r.key === key), cur = all.find(r => R() && R().isV1(r.data) && daysAgo(weekEnd(r)) <= 8) || null;
    const st = !cur ? "due" : cur.status === "sent" ? "sent" : cur.status === "held" ? "held" : cur.status === "sending" ? "sending" : "draft";
    return { key, email: c.client_email || (rc && rc.email) || key, name: (rc && rc.name) || c.client_name || (cur && cur.data.client && cur.data.client.name) || key,
      kind: c.kind || "", mrr: +c.mrr_usd || 0, plan: planName(c.plan_label), started: c.started_at || null, flag: c.flag || null, oldest: +c.oldest_unposted_days || 0, proof: c.proof_line || "",
      made, posted, hasPlan, planMade: hasPlan ? +P.plan_made || 0 : made, planTotal: hasPlan ? +P.plan_total : null, basis: P ? P.plan_basis : null,
      posts, waiting, viewsBy, views: fresh.reduce((a, v) => a + (+v.views || 0), 0), spark: series(fresh), cdOf, dViews: x.cd ? sumD(CD.filter(r => !stale(r.platform) && +r.our_views > 0), "our_views") : undefined, asOf: posts.map(p => p.as_of).filter(Boolean).sort().pop() || null,
      acc: PORD.map(p => x.acc.find(a => lc(a.email) === key && a.platform === p)).filter(Boolean), share: x.share.filter(s => lc(s.client_email) === key),
      checking: new Set(x.sug.filter(s => lc(s.client_email) === key).map(s => s.delivery_id)).size, isRep: !!rc, reason: rc ? rc.reason : "", inbox: rc ? rc.inbox : "", all, cur, st };
  }).sort((a, b) => b.mrr - a.mrr || b.posted - a.posted || b.made - a.made || String(a.name).localeCompare(String(b.name)));
  const withPlan = clients.filter(c => c.hasPlan), allPosts = clients.flatMap(c => c.posts.map(p => ({ ...p, client: c }))), fresh = allPosts.filter(p => !stale(p.platform));
  const ok = x.health.filter(h => h.ok && h.last_ok_at).map(h => h.last_ok_at).sort().pop() || null;
  const nx = ok ? new Date(+new Date(ok) + SYNC_EVERY_H * 36e5) : null;
  const over = { planMade: withPlan.reduce((a, c) => a + c.planMade, 0), planTotal: withPlan.reduce((a, c) => a + c.planTotal, 0), made: clients.reduce((a, c) => a + c.made, 0), posted: clients.reduce((a, c) => a + c.posted, 0),
    posting: clients.filter(c => c.posted).length, dViews: x.cd ? sumD(x.cd.filter(r => !stale(r.platform) && +r.our_views > 0), "our_views") : undefined, views: fresh.reduce((a, p) => a + (+p.views || 0), 0), spark: series(fresh),
    viewsBy: PORD.map(p => ({ p, n: allPosts.filter(v => v.platform === p).length, views: allPosts.filter(v => v.platform === p).reduce((a, v) => a + (+v.views || 0), 0), stale: stale(p) })).filter(r => r.n),
    checking: new Set(x.sug.map(s => s.delivery_id)).size, best: fresh.slice().sort((a, b) => (+b.views || 0) - (+a.views || 0))[0] || null, last: ok, next: nx, days };
  return { ...x, clients, over, days };
}

/* ---------------- small visuals ---------------- */
const cnt = (v, cls = "") => `<span class="pf-n ${cls}" data-n="${Math.round(+v || 0)}">${int(v)}</span>`;
const ring = (frac, cls = "") => `<svg class="pf-ring ${cls}" viewBox="0 0 40 40" aria-hidden="true"><circle class="t" cx="20" cy="20" r="16" pathLength="100"/><circle class="v" cx="20" cy="20" r="16" pathLength="100" data-v="p:${Math.round(100 * Math.max(0, Math.min(1, frac || 0)))}"/></svg>`;
const bar = (frac, cls = "") => `<span class="pf-bar ${cls}" aria-hidden="true"><i data-v="w:${(100 * Math.max(0, Math.min(1, frac || 0))).toFixed(1)}%"></i></span>`;
const pIcon = (p, isStale) => `<span class="pf-pi pf-pi-${A.esc(p)}${isStale ? " st" : ""}"${isStale ? ` title="${A.esc(staleTip(p))}"` : ""}>${A.ic(PIC[p] || "play")}</span>`;
function spark(vals, cls = "") {
  if (!vals || vals.length < 2) return `<span class="pf-sp pf-sp0 ${cls}" title="The views line shows after 2 days of data" aria-hidden="true"></span>`;
  const mn = Math.min(...vals), mx = Math.max(...vals), r = mx - mn, n = vals.length, pts = vals.map((v, i) => [(100 * i / (n - 1)).toFixed(2), (r ? 25 - 22 * (v - mn) / r : 14).toFixed(2)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0] + "," + p[1]).join(" "), gain = vals[n - 1] - vals[0];
  return `<span class="pf-sp ${cls}" title="${A.esc(`Views, ${A.dLabel(D.days[0])} – ${A.dLabel(D.days[D.days.length - 1])}: ${gain >= 0 ? "+" : ""}${int(gain)}`)}"><svg viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><path class="a" d="${line} L100,28 L0,28 Z"/><path class="l" pathLength="1" d="${line}"/></svg></span>`;
}
/* "▲ +1,240 this week": absolute, never a %. d = [n, "this week" | "today"] | null (nothing shown) | undefined (the view isn't there yet) */
function dx(d, long) {
  if (!d || !isFinite(d[0])) return "";
  const n = d[0], cls = n > 0 ? "up" : n < 0 ? "dn" : "";
  return `<span class="pf-dx ${cls}" title="${A.esc(`${n > 0 ? "+" : n < 0 ? "−" : ""}${int(Math.abs(n))} ${d[1]}`)}">${n > 0 ? "▲ +" : n < 0 ? "▼ −" : "± "}${A.esc(long ? int(Math.abs(n)) : kf(Math.abs(n)))}${long ? `<small>${d[1]}</small>` : ""}</span>`;
}
const gainOf = vals => vals && vals.length > 1 ? vals[vals.length - 1] - vals[0] : null;
function thumb(platform, postId, cls = "") {
  return platform === "youtube" && ytOk(postId) ? `<span class="pf-th ${cls}"><img src="https://i.ytimg.com/vi/${encodeURIComponent(postId)}/mqdefault.jpg" alt="" loading="lazy" width="320" height="180"></span>`
    : `<span class="pf-th pf-th0 pf-th-${A.esc(platform || "x")} ${cls}">${A.ic(PIC[platform] || "play")}</span>`;
}

/* ---------------- 1. overview ---------------- */
function heroHTML() {
  const { esc, ic } = A, O = D.over, B = O.best, pct = O.planTotal ? Math.round(100 * O.planMade / O.planTotal) : null;
  const sinceH = hrs(O.last), toH = O.next ? (O.next - Date.now()) / 36e5 : null, cyc = isFinite(sinceH) ? Math.min(1, sinceH / SYNC_EVERY_H) : 0;
  const dots = PORD.map(p => { const h = health(p); if (!h) return ""; const bad = stale(p);
    return `<i class="pf-pd ${bad ? "r" : "g"}" role="img" tabindex="0" aria-label="${esc(`${plN(p)}: ${bad ? "old data" : "fresh"}`)}" title="${esc(`${plN(p)}: ${bad ? `old data${h.last_day ? ", last read " + A.dLabel(h.last_day) : ""}` : "fresh, " + at(h.last_ok_at)}`)}"></i>`; }).join("");
  const sync = `<span class="pf-sync" title="${esc(`Numbers update every ${SYNC_EVERY_H} hours. Last update: ${at(O.last)}.${O.checking ? ` ${O.checking} ${O.checking === 1 ? "link" : "links"} being checked.` : ""}`)}">${ring(cyc, "pf-cyc")}<span>${O.last ? `Updated ${esc(dur(sinceH))} ago` : "Not updated yet"}${toH == null ? "" : toH > 0 ? ` · next sync in ${esc(dur(toH))}` : " · next sync due"}</span><span class="pf-pds">${dots}</span></span>`;
  const asof = `As of ${at(O.last)}`;
  const tMade = `<div class="pf-t" title="${esc(`${asof}. Finished Shorts we delivered on current plans and orders. ${int(O.made)} delivered in total, all time.`)}">
      <span class="pf-tl">${ic("video")}Shorts made</span><div class="pf-tr"><b class="pf-big">${cnt(O.planMade)}<i>/ ${int(O.planTotal)}</i></b><span class="pf-rw">${ring(pct / 100)}<em>${pct == null ? "–" : pct + "%"}</em></span></div>
      <small class="pf-ts">of current plans</small></div>`;
  const tPost = `<div class="pf-t" title="${esc(`${asof}. Delivered Shorts we found on the clients' channels.`)}">
      <span class="pf-tl">${ic("send")}Posted by clients</span><b class="pf-big">${cnt(O.posted)}<i>/ ${int(O.made)}</i></b>${bar(O.made ? O.posted / O.made : 0)}
      <small class="pf-ts">${int(O.posting)} of ${int(D.clients.length)} clients post</small></div>`;
  const g = gainOf(O.spark);
  const tViews = `<div class="pf-t pf-t-v" title="${esc(`${asof}. Views on the Shorts we made, per platform. A platform with old data is not added in.`)}">
      <span class="pf-tl">${ic("eye")}<span class="pf-lg">Views on our Shorts</span><span class="pf-sm">Our views</span></span><b class="pf-big">${cnt(O.views)}</b>${spark(O.spark, "pf-sp-h")}
      <span class="pf-pcs">${O.viewsBy.map(v => `<span class="pf-pc${v.stale ? " st" : ""}"${v.stale ? ` title="${esc(staleTip(v.p))}"` : ""}>${pIcon(v.p)}${esc(kf(v.views))}${v.stale ? `<i class="pf-pd r"></i>` : ""}</span>`).join("")}${O.dViews !== undefined ? dx(O.dViews, true) : g ? `<span class="pf-dx up">▲ +${esc(int(g))}<small>in ${D.days.length} d</small></span>` : ""}</span></div>`;
  const tBest = B ? `<a class="pf-t pf-t-b" href="?p=perf&amp;k=${encodeURIComponent(B.client.key)}" data-pf-c="${esc(B.client.key)}" title="${esc(`${asof}. Open ${B.client.name}.`)}">
      <span class="pf-tl">${ic("star")}Best Short</span><span class="pf-bb">${thumb(B.platform, B.post_id)}<span class="pf-bt"><b class="pf-big">${cnt(B.views)}</b>${dx(pickD(B.dx, "views"), true)}<small class="pf-ts">${esc(B.short_label || "Short")} · ${esc(B.client.name)}</small></span></span></a>`
    : `<div class="pf-t pf-t-b"><span class="pf-tl">${ic("star")}Best Short</span>${empty("star", "No posted Short yet")}</div>`;
  return `<section class="hero pf-hero" aria-labelledby="pf-h1"><header class="pf-hh"><h1 id="pf-h1">Client <em class="sf">performance</em></h1>${sync}</header>
    <div class="pf-tiles">${tMade}${tPost}${tViews}${tBest}</div></section>`;
}

/* ---------------- 2. client list ---------------- */
function row(c) {
  const { esc, initials } = A, dot = c.flag === "rescue" && c.waiting.length ? ["r", `${c.waiting.length} not posted yet · oldest ${c.oldest} d`] : c.proof || c.flag === "upsell" || c.flag === "proof" ? ["g", c.proof || "Doing better than their usual Shorts"] : null;
  return `<a class="pf-item" href="?p=perf&amp;k=${encodeURIComponent(c.key)}" data-pf-c="${esc(c.key)}" title="${esc(`${c.name} · ${c.hasPlan ? `${int(c.planMade)} / ${int(c.planTotal)}` : int(c.made)} made · ${int(c.posted)} posted`)}"${SEL === c.key ? ' aria-current="true"' : ""}>
    <span class="av">${esc(initials(c.name))}</span>
    <span class="grow"><span class="t">${esc(c.name)}</span><span class="s">${c.hasPlan ? `${int(c.planMade)} / ${int(c.planTotal)}` : int(c.made)} made · ${int(c.posted)} posted</span>${bar(c.hasPlan ? c.planMade / c.planTotal : c.made ? 1 : 0, c.hasPlan ? "" : "z")}</span>
    ${dot ? `<i class="pf-pd ${dot[0]}" role="img" aria-label="${esc(dot[1])}" title="${esc(dot[1])}"></i>` : ""}</a>`;
}

/* ---------------- 3. client ---------------- */
const TABS = [["videos", "Our videos", "video"], ["channel", "Channel", "chart"], ["report", "Report", "mail"]];
function detail(c) {
  const { esc, ic, initials } = A;
  if (!c) return empty("users", "No clients yet");
  const asof = c.asOf ? `As of ${A.dLabel(c.asOf)}` : "No numbers yet", g = gainOf(c.spark);
  const head = `<header class="pf-ch"><span class="av pf-av">${esc(initials(c.name))}</span><div class="pf-cn"><h2>${esc(c.name)}</h2><div class="pf-chips">${c.plan ? `<span class="chip">${esc(c.plan)}</span>` : ""}${c.mrr ? `<span class="chip g">${esc(A.usd(c.mrr))} / mo</span>` : ""}${c.flag === "rescue" && c.waiting.length ? `<span class="chip r" title="${esc(`${c.waiting.length} delivered Shorts are not on their channels yet`)}">${ic("clock")}Oldest waits ${c.oldest} d</span>` : ""}${c.proof ? `<span class="chip pf-proof" title="${esc(c.proof)}">${ic("star")}Proof</span>` : ""}</div></div></header>`;
  const sMade = `<div class="pf-t" title="${esc(`${asof}. Finished, delivered Shorts only.${c.basis === "month" ? ` ${int(c.made)} delivered in total, all time.` : ""}`)}"><span class="pf-tl">${ic("video")}Made</span>
      <div class="pf-tr"><b class="pf-big">${cnt(c.planMade)}${c.hasPlan ? `<i>/ ${int(c.planTotal)}</i>` : ""}</b>${c.hasPlan ? `<span class="pf-rw">${ring(c.planMade / c.planTotal)}<em>${Math.round(100 * c.planMade / c.planTotal)}%</em></span>` : ""}</div>
      <small class="pf-ts">${c.basis === "month" ? `this month · ${int(c.made)} all time` : c.basis === "orders" ? "of Shorts bought" : "all time"}</small></div>`;
  const sPost = `<div class="pf-t" title="${esc(`${asof}. Delivered Shorts we found on their channels.`)}"><span class="pf-tl">${ic("send")}Posted</span><b class="pf-big">${cnt(c.posted)}<i>/ ${int(c.made)}</i></b>${bar(c.made ? c.posted / c.made : 0)}
      <small class="pf-ts">${c.waiting.length ? `${int(c.waiting.length)} not posted yet` : c.made ? "all posted" : "nothing delivered"}</small></div>`;
  const sViews = `<div class="pf-t pf-t-v" title="${esc(`${asof}. Views on the Shorts we made. A platform with old data is not added in.`)}"><span class="pf-tl">${ic("eye")}<span class="pf-lg">Views on our Shorts</span><span class="pf-sm">Our views</span></span><b class="pf-big">${c.posts.length ? cnt(c.views) : "–"}</b>${c.posts.length ? spark(c.spark, "pf-sp-h") : ""}
      <span class="pf-pcs">${c.viewsBy.map(v => `<span class="pf-pc${v.stale ? " st" : ""}"${v.stale ? ` title="${esc(staleTip(v.p))}"` : ""}>${pIcon(v.p)}${esc(kf(v.views))}${v.stale ? `<i class="pf-pd r"></i>` : ""}</span>`).join("")}${c.dViews !== undefined ? dx(c.dViews, true) : g ? `<span class="pf-dx up">▲ +${esc(int(g))}<small>in ${D.days.length} d</small></span>` : ""}${c.posts.length ? "" : `<small class="pf-ts">no posted Short yet</small>`}</span></div>`;
  const sFol = `<div class="pf-t" title="${esc(c.acc.length ? `As of ${at(c.acc.map(a => a.updated_at).sort().pop())}. YouTube rounds this number.` : "No channel linked")}"><span class="pf-tl">${ic("users")}Followers</span>
      ${c.acc.length ? `<div class="pf-fol">${c.acc.map(a => { const u = safeUrl(a.url), bad = stale(a.platform), inner = `${pIcon(a.platform)}<b>${esc(kf(a.followers))}</b><small>${esc(plN(a.platform))}</small>${bad ? "" : dx(pickD(c.cdOf(a.platform), "followers"))}${bad ? `<i class="pf-pd r" title="${esc(staleTip(a.platform))}"></i>` : ""}`;
        return u ? `<a class="pf-fc" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : `<span class="pf-fc">${inner}</span>`; }).join("")}</div>` : `<b class="pf-big">–</b><small class="pf-ts">no channel linked</small>`}</div>`;
  const tabs = `<div class="pf-tabs" role="tablist" aria-label="Client views">${TABS.map(t => `<button type="button" role="tab" class="pf-tab" id="pf-tab-${t[0]}" data-pf-tab="${t[0]}" aria-selected="${TAB === t[0]}" aria-controls="pf-pane" tabindex="${TAB === t[0] ? 0 : -1}">${ic(t[2])}<span>${t[1]}</span>${t[0] === "videos" && c.posts.length ? `<b>${c.posts.length}</b>` : ""}${t[0] === "report" && c.st === "draft" ? `<i class="pf-pd b" title="Draft ready"></i>` : ""}</button>`).join("")}</div>`;
  return `${head}<div class="pf-stats">${sMade}${sPost}${sViews}${sFol}</div>${tabs}<div class="pf-pane" id="pf-pane" role="tabpanel" aria-labelledby="pf-tab-${TAB}"${TAB === "report" && (EDIT || MAIL || ADJ) ? " data-keep" : ""}>${pane(c)}</div>`;
}
const pane = c => TAB === "channel" ? channelPane(c) : TAB === "report" ? reportPane(c) : videosPane(c);

/* --- Our videos --- */
function vCard(p, i) {
  const { esc, ic } = A, u = safeUrl(p.url), bad = stale(p.platform), tip = `${p.as_of ? "As of " + A.dLabel(p.as_of) : "No numbers yet"}${bad ? ". " + staleTip(p.platform) : ""}${p.removed ? ". Taken down: last known numbers." : ""}`;
  return `<article class="pf-v${p.removed ? " gone" : ""}" title="${esc(tip)}"><a class="pf-vt" ${u ? `href="${esc(u)}" target="_blank" rel="noopener noreferrer"` : ""} aria-label="${esc(`Open ${p.short_label || "Short"} on ${plN(p.platform)}`)}">${thumb(p.platform, p.post_id)}
      <span class="pf-vp">${pIcon(p.platform)}${bad ? `<i class="pf-pd r"></i>` : ""}</span>${i === 0 && +p.views > 0 ? `<span class="pf-vk">${ic("star")}Top</span>` : ""}<span class="pf-vo">${ic("link")}</span></a>
    <div class="pf-vb"><div class="pf-vl"><b>${esc(p.short_label || "Short")}</b><small>${p.removed ? "taken down" : p.posted_at ? esc(A.dLabel(A.dayOf(p.posted_at))) : ""}</small></div>
      <div class="pf-vn"><b>${cnt(p.views)}</b><span>views</span>${spark(p.spark)}</div>${bad ? "" : dx(pickD(p.dx, "views"), true)}
      <div class="pf-vm"><span title="Likes">${ic("heart")}${esc(kf(p.likes))}${bad ? "" : dx(pickD(p.dx, "likes"))}</span><span title="Comments">${ic("msg")}${esc(kf(p.comments))}${bad ? "" : dx(pickD(p.dx, "comments"))}</span></div></div></article>`;
}
function videosPane(c) {
  const { esc, ic } = A, n = c.waiting.length;
  const grid = c.posts.length ? `<div class="pf-grid">${c.posts.map(vCard).join("")}</div>` : empty("video", "No Shorts posted yet", c.made ? `${int(c.made)} delivered${c.oldest ? ` · oldest waits ${c.oldest} d` : ""}` : "Nothing delivered yet");
  const wait = n ? `<details class="pf-wait" id="pf-wait"${WAIT_OPEN ? " open" : ""}><summary><span class="pf-wn">${int(n)}</span><span>delivered ${n === 1 ? "Short" : "Shorts"} not posted yet</span>${c.checking ? `<small>${c.checking} being checked</small>` : ""}${ic("chev")}</summary>
      <div class="pf-pills">${c.waiting.map(w => `<span class="pf-pill" title="${esc(`${w.label}${w.delivered_at ? " · delivered " + A.dLabel(w.delivered_at) : ""}`)}">${esc(w.label)}</span>`).join("")}</div></details>` : "";
  return `${grid}${wait}`;
}
/* --- Channel --- */
async function loadChannel(c) {
  if (CH[c.key]) return; CH[c.key] = "load";
  try {
    const sb = A.sb(), since = new Date(Date.now() - 30 * 864e5).toISOString();
    const [s, t] = await Promise.all([sb.from("v_perf_channel").select("platform,day,followers,total_views,video_count").eq("client_email", c.email).order("day").limit(2000),
      sb.from("client_posts").select("platform,post_id,title,url,posted_at,views,is_short").ilike("email", c.email.replace(/[\\%_]/g, "\\$&")).gte("posted_at", since).order("views", { ascending: false }).limit(60)]);
    if (s.error) throw s.error;
    CH[c.key] = { series: s.data || [], top: t.data || [] };
  } catch (e) { CH[c.key] = "err"; }
  if (SEL === c.key && TAB === "channel") paintPane();
}
/* one line, one axis; the y range hugs the data (levels barely move day to day), so the axis shows its min and max */
function lineChart(title, rows, key, started) {
  const { esc } = A, pts = rows.filter(r => r[key] != null).map(r => ({ d: r.day, v: +r[key] })), n = pts.length, last = pts[n - 1], gain = last.v - pts[0].v;
  let mn = Math.min(...pts.map(p => p.v)), mx = Math.max(...pts.map(p => p.v)); const pad = (mx - mn) * 0.12 || Math.max(1, mx * 0.01); mn -= pad; mx += pad;
  const t0 = Date.parse(pts[0].d), t1 = Date.parse(last.d), X = d => t1 > t0 ? 100 * (Date.parse(d) - t0) / (t1 - t0) : 50, Y = v => 100 - 100 * (v - mn) / (mx - mn);
  const yl = v => mx - mn < 2000 ? int(v) : mx - mn < 2e5 ? (v / 1e3).toFixed(1) + "k" : kf(v);   // axis labels keep enough digits to differ
  const line = pts.map((p, i) => (i ? "L" : "M") + X(p.d).toFixed(2) + "," + Y(p.v).toFixed(2)).join(" ");
  const sx = started ? X(started) : null, mk = sx == null ? "" : sx >= 0 && sx <= 100 ? `<span class="pf-mk" data-v="x:${sx.toFixed(1)}%"><b>BEJÚ started</b></span>` : "";
  return `<figure class="pf-chart" data-pts="${esc(JSON.stringify(pts.map(p => [X(p.d).toFixed(2), Y(p.v).toFixed(2), A.dLabel(p.d), int(p.v)])))}" title="">
    <figcaption><span>${esc(title)}</span><b>${int(last.v)}</b><small class="${gain > 0 ? "up" : gain < 0 ? "dn" : ""}">${gain > 0 ? "+" : ""}${int(gain)} · ${n} d</small>${sx != null && sx < 0 ? `<small class="pf-mk0">BEJÚ started ${esc(A.dLabel(started))}</small>` : ""}</figcaption>
    <div class="pf-plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="g" d="M0,0.5 H100 M0,50 H100 M0,99.5 H100"/><path class="a" d="${line} L100,100 L0,100 Z"/><path class="l" pathLength="1" d="${line}"/></svg>
      ${mk}<i class="pf-end" data-v="x:${X(last.d).toFixed(2)}%;y:${Y(last.v).toFixed(2)}%"></i><i class="pf-cross" hidden></i><span class="pf-tip" hidden></span>
      <span class="pf-yl t">${esc(yl(mx))}</span><span class="pf-yl b">${esc(yl(mn))}</span></div>
    <div class="pf-xl"><span>${esc(A.dLabel(pts[0].d))}</span><span>${esc(A.dLabel(last.d))}</span></div></figure>`;
}
function donut(sh, isStale) {
  const { esc } = A, ours = +sh.our_views || 0, all = +sh.channel_views || 0, pct = all ? 100 * ours / all : 0, a = Math.max(0, Math.min(100, pct));
  return `<div class="pf-do${isStale ? " st" : ""}" title="${esc(isStale ? staleTip(sh.platform) : `Views on posts from the last 30 days, ${plN(sh.platform)}. A plain share: it says nothing about who followed because of which video.`)}">
    <span class="pf-dw"><svg viewBox="0 0 40 40" aria-hidden="true"><circle class="t" cx="20" cy="20" r="16" pathLength="100"/><circle class="v" cx="20" cy="20" r="16" pathLength="100" data-v="p:${a.toFixed(1)}"/></svg><b>${pct >= 10 || !pct ? Math.round(pct) : pct.toFixed(1)}%</b></span>
    <div class="pf-dl"><span class="pf-dt">Share of views · 30 d</span><span class="pf-dr"><i class="k"></i>Our Shorts<b>${int(ours)}</b></span><span class="pf-dr"><i></i>Their other posts<b>${int(Math.max(0, all - ours))}</b></span></div></div>`;
}
function channelPane(c) {
  const { esc, ic } = A;
  if (!c.acc.length) return empty("chart", "No channel linked yet");
  const st = CH[c.key]; if (!st || st === "load") { if (!st) loadChannel(c); return `<div class="pf-sk" aria-label="Loading"><i></i><i></i></div>`; }
  if (st === "err") return empty("alert", "Channel data didn't load", "Refresh the page to try again");
  const pls = c.acc.map(a => a.platform), p = pls.includes(CHP) ? CHP : pls[0], bad = stale(p), acc = c.acc.find(a => a.platform === p);
  const seg = pls.length > 1 ? `<div class="pf-seg" role="group" aria-label="Platform">${pls.map(x => `<button type="button" data-pf-pl="${x}" aria-pressed="${x === p}"${stale(x) ? ` title="${esc(staleTip(x))}"` : ""}>${pIcon(x)}${esc(plN(x))}${stale(x) ? `<i class="pf-pd r"></i>` : ""}</button>`).join("")}</div>` : "";
  const rows = st.series.filter(r => r.platform === p), n = rows.length, last = rows[n - 1] || {};
  const cdp = bad ? null : c.cdOf(p), lv = (label, v, d) => `<div class="pf-lv"><span>${label}</span><b>${v == null ? "–" : esc(int(v))}</b>${dx(d, true)}</div>`;
  const hist = n >= MIN_DAYS ? `<div class="pf-charts">${rows.some(r => r.followers != null) ? lineChart("Followers", rows, "followers", c.started) : ""}${rows.some(r => r.total_views != null) ? lineChart("Total channel views", rows, "total_views", c.started) : ""}</div>`
    : `<div class="pf-build" title="${esc("We save the channel's numbers once a day. The lines show from day " + MIN_DAYS + ".")}"><div class="pf-bh"><span class="pf-empty-i">${ic("chart")}</span><b>Building history</b><span>day ${Math.max(n, 0)} of ${GOAL_DAYS}</span><span class="pf-days" aria-hidden="true">${Array.from({ length: GOAL_DAYS }, (_, i) => `<i${i < n ? ' class="on"' : ""}></i>`).join("")}</span></div>
        <div class="pf-lvs">${lv("Followers", last.followers != null ? last.followers : acc && acc.followers, pickD(cdp, "followers"))}${lv("Total views", last.total_views, pickD(cdp, "channel_views"))}${lv("Videos", last.video_count != null ? last.video_count : acc && acc.posts_count)}</div></div>`;
  const sh = c.share.find(s => s.platform === p), share = sh && +sh.channel_views > 0 ? donut(sh, bad) : `<div class="pf-do">${empty("chart", "No views in the last 30 days")}</div>`;
  const ourIds = new Set(c.posts.filter(v => v.platform === p).map(v => v.post_id)), top = st.top.filter(t => t.platform === p).slice(0, 5);
  const tops = top.length ? `<div class="pf-tops">${top.map((t, i) => { const u = safeUrl(t.url), mine = ourIds.has(t.post_id);
      return `<a class="pf-tp${mine ? " ours" : ""}" ${u ? `href="${esc(u)}" target="_blank" rel="noopener noreferrer"` : ""}><span class="pf-tk">${i + 1}</span>${thumb(t.platform, t.post_id)}<span class="pf-tb"><b>${esc(t.title || "Post")}</b><small>${esc(kf(t.views))} views${t.posted_at ? ` · ${esc(A.dLabel(A.dayOf(t.posted_at)))}` : ""}</small></span>${mine ? `<span class="chip b">Ours</span>` : ""}</a>`; }).join("")}</div>` : empty("video", "No posts in the last 30 days");
  return `${seg}${bad ? `<p class="pf-stale"><i class="pf-pd r"></i>${esc(plN(p))}: old data${health(p) && health(p).last_day ? ` from ${esc(A.dLabel(health(p).last_day))}` : ""}</p>` : ""}${hist}
    <div class="pf-two"><section><h3>Share</h3>${share}</section><section><h3>Their top posts · 30 d</h3>${tops}</section></div>`;
}
function chartHover(ev) {
  const plot = ev.target.closest && ev.target.closest(".pf-plot"), fig = plot && plot.closest(".pf-chart"); if (!fig) return;
  const cross = plot.querySelector(".pf-cross"), tip = plot.querySelector(".pf-tip");
  if (ev.type === "pointerleave" || ev.type === "pointerout" && !plot.contains(ev.relatedTarget)) { cross.hidden = tip.hidden = true; return; }
  if (ev.type !== "pointermove" && ev.type !== "pointerdown") return;
  const pts = fig._pts || (fig._pts = JSON.parse(fig.dataset.pts)), r = plot.getBoundingClientRect(), x = 100 * (ev.clientX - r.left) / r.width;
  let b = pts[0]; pts.forEach(p => { if (Math.abs(p[0] - x) < Math.abs(b[0] - x)) b = p; });
  cross.hidden = tip.hidden = false; cross.style.setProperty("--x", b[0] + "%"); cross.style.setProperty("--y", b[1] + "%");
  tip.style.setProperty("--x", b[0] + "%"); tip.classList.toggle("r", +b[0] > 60); tip.textContent = `${b[2]} · ${b[3]}`;
}

/* --- Report (the v3 weekly report, moved here; same data, same Send flow) --- */
const curOf = c => VIEW ? c.all.find(r => String(r.id) === String(VIEW)) || c.cur : c.cur;
function reportPane(c) {
  const { esc, ic } = A;
  if (!c.isRep && !c.all.length) return empty("mail", "No weekly report for this client");
  if (!D.cr) return empty("clock", "Reports can't be read yet");
  const r = curOf(c), past = !!VIEW && r && r !== c.cur, wk = r && R() && R().isV1(r.data) ? R().weekLabel(r.data.week_start, r.data.week_end) : r ? A.dLabel(r.week) : "";
  const canEdit = r && !past && (r.status === "draft" || r.status === "held") && !r.draft_id, canSend = r && !past && R() && R().isV1(r.data) && (r.status === "draft" || (r.status === "sending" && r.draft_id != null));
  const olds = c.all.filter(x => x !== c.cur);
  const head = `<div class="pf-rh">${past ? `<span class="chip">Past report</span>` : chip(c.st)}${wk ? `<span class="chip">${esc(wk)}</span>` : ""}${c.inbox ? `<span class="chip" title="${esc(c.reason || "")}">from ${esc(c.inbox)}</span>` : ""}</div>`;
  let acts;
  if (EDIT) acts = `<button type="button" class="act go wr-a" data-wr="save">${ic("check")}Save</button><button type="button" class="act wr-a" data-wr="cancel">Cancel</button>`;
  else if (past) acts = `<button type="button" class="act wr-a" data-wr="back">${ic("back")}Back to this week</button>${r.page_url ? `<a class="act wr-a" href="${esc(r.page_url)}" target="_blank" rel="noopener noreferrer">${ic("link")}Client's page</a>` : ""}`;
  else acts = `${r ? `<button type="button" class="act wr-a" data-wr="edit"${canEdit ? "" : ` disabled title="${esc(r.draft_id ? "The email is already made from this text" : "Only a draft or held report can be edited")}"`}>${ic("edit")}Edit</button>
      ${r.status === "draft" || r.status === "held" ? `<button type="button" class="act wr-a" data-wr="hold">${ic(r.status === "held" ? "refresh" : "clock")}${r.status === "held" ? "Unhold" : "Hold"}</button>` : ""}` : ""}
      <button type="button" class="act wr-a" data-wr="past" aria-expanded="${PAST}"${olds.length ? "" : " disabled"}>${ic("clock")}Past reports${olds.length ? ` (${olds.length})` : ""}</button>
      ${r && r.page_url ? `<a class="act wr-a" href="${esc(r.page_url)}" target="_blank" rel="noopener noreferrer">${ic("link")}Client's page</a>` : ""}
      ${r ? `<button type="button" class="act go wr-a pf-send" data-wr="send"${canSend ? "" : " disabled"}>${ic("send")}${r.draft_id ? "Open email" : "Send"}</button>` : ""}`;
  const pastList = PAST && !past && olds.length ? `<div class="wr-past">${olds.map(x => `<button type="button" class="wr-pi" data-wr="view" data-id="${esc(x.id)}"><span>${esc(R() && R().isV1(x.data) ? R().weekLabel(x.data.week_start, x.data.week_end) : A.dLabel(x.week))}</span><span class="chip ${x.status === "sent" ? "g" : ""}">${esc(x.status === "sent" ? "sent " + (x.sent_at ? A.dLabel(A.dayOf(x.sent_at)) : "") : x.status)}</span></button>`).join("")}</div>` : "";
  const note = r && r.status === "held" && !past ? `<p class="sp-note wr-note">Held: it won't go out. Unhold it to send.</p>` : r && r.status === "sending" && !past ? `<p class="sp-note wr-note">The email is made and waits for your "Send it" below, or it's on its way.</p>` : "";
  const body = !r ? empty("clock", "No report for this week yet", "Built every Sunday at 10:00")
    : `<div class="wr-frame">${R() ? R().render(r.data, { edit: EDIT, name: c.name }) : empty("alert", "The report preview didn't load")}</div>`;
  return `<div class="pf-rt">${head}<div class="wr-acts">${acts}</div></div><p class="pv-err wr-err" id="wr-err" role="alert" hidden></p>${note}${pastList}<div id="wr-mail">${MAIL && !past ? mailHTML(c) : ""}</div>${r && !past ? adjHTML(r) : ""}${body}`;
}
/* "For Claude adjustments": a founder's note on this report. It saves client_reports.adjust_note only; the backend marks it open, Claude
   makes the change and marks it done. */
function adjHTML(r) {
  const { esc, ic } = A, st = r.adjust_status === "open" ? `<span class="chip b">Claude is on it</span>` : r.adjust_status === "done" ? `<span class="chip g">${ic("check")}Done${r.adjust_at ? " · " + esc(at(r.adjust_at)) : ""}</span>` : "";
  return `<form class="pf-adj" id="pf-adj" data-id="${esc(r.id)}"><label for="pf-adj-t">${ic("edit")}For Claude adjustments</label>${st}
    <textarea id="pf-adj-t" rows="1" maxlength="2000" placeholder="What should change in this report?">${esc(r.adjust_note || "")}</textarea>
    <button type="submit" class="act wr-a">${ic("send")}Send to Claude</button><p class="pv-err" role="alert" hidden></p></form>`;
}
async function sendAdj(form) {
  const c = cur(), r = c && c.all.find(x => String(x.id) === form.dataset.id), ta = form.querySelector("textarea"), btn = form.querySelector("button"), err = form.querySelector(".pv-err"), v = ta.value.trim();
  if (!r) return; err.hidden = true;
  if (!v) { ta.focus(); return; }
  btn.disabled = true;
  try {
    const { data, error } = await A.sb().from("client_reports").update({ adjust_note: v }).eq("id", r.id).select("adjust_note,adjust_status,adjust_at");
    if (error) throw error;
    if (!data || !data.length) throw { code: "42501" };
    ADJ = false; keep(); Object.assign(r, data[0]); if (!r.adjust_status || r.adjust_status === "done") r.adjust_status = "open";
    A.toast("Sent to Claude."); const t = document.createElement("div"); t.innerHTML = adjHTML(r); form.replaceWith(t.firstElementChild);
  } catch (e) {
    btn.disabled = false; err.hidden = false;
    err.textContent = e && (e.code === "42703" || e.code === "PGRST204" || /adjust_/.test(e.message || "")) ? "Not switched on yet. Nothing was saved." : refused(e) ? "Not saved. Sign in again, then retry." : `Couldn't save: ${String((e && e.message) || e).slice(0, 140)}`;
  }
}
/* the email report_send made: the Samples approve flow (status approved + approved_sha256 of the body on screen) */
const MST = { pending: "", held: "Sent back with changes. It comes back here when fixed.", approved: "Approved. It goes out within a minute.", sending: "Sending now.", sent: "Sent.",
  failed: "Not sent: the sender refused it. Read the reason first.", stale: "Not sent: the client wrote again after this was made.", unknown: "Unclear if it went out. Check the inbox before anything else." };
function mailHTML(c) {
  const { esc, ic } = A, d = MAIL; if (!d) return "";
  if (d.missing) return `<div class="wr-mail">${empty("clock", "The email can't be read yet", "Nothing was sent")}</div>`;
  const to = [d.to_email, ...(d.cc_list || [])].filter(Boolean).join(", "), can = /^(pending|failed|stale)$/.test(d.status);
  return `<div class="wr-mail"><h3>${ic("mail")}The email that goes out</h3>
    <p class="wr-emh"><span>From <b>${esc(d.inbox || "—")}</b></span><span>To <b>${esc(to || "—")}</b></span></p>
    ${MST[d.status] ? `<p class="wr-ems ${esc(d.status)}">${esc(MST[d.status])}${d.error && /^(failed|unknown|stale)$/.test(d.status) ? ` <small>${esc(String(d.error).slice(0, 200))}</small>` : ""}</p>` : ""}
    <pre class="wr-emb" id="wr-emb">${esc(d.body)}</pre>
    <div class="wr-acts">${can ? `<button type="button" class="act go wr-a" data-wr="sendit">${ic("send")}Send it</button>` : ""}<button type="button" class="act wr-a" data-wr="mailx">Close</button></div>
    <p class="sp-note">Nothing goes out until you press Send it and confirm. ${c.name ? esc(R().first(c.name)) + " gets" : "They get"} this email with the link to the page below.</p></div>`;
}
async function getDraft(id) {
  const sb = A.sb(), one = t => sb.from(t).select("*").eq("id", id).maybeSingle().then(r => (r.error ? null : r.data), () => null);
  return (await one("drafts_waiting")) || (await one("drafts"));
}
const say = m => { const e = A.el.querySelector("#wr-err"); if (e) { e.hidden = !m; e.textContent = m || ""; } };
function paintMail() { const c = cur(), m = A.el.querySelector("#wr-mail"); if (m && c) m.innerHTML = MAIL ? mailHTML(c) : ""; keep(); }
const keep = () => { const p = A.el.querySelector("#pf-pane"); if (p) p.toggleAttribute("data-keep", TAB === "report" && !!(EDIT || MAIL || ADJ)); };   // side.js's 5-minute refresh never wipes an open edit or email
async function act(op, btn) {
  const c = cur(); if (!c) return; const r = curOf(c); say("");
  if (op === "edit") { EDIT = true; MAIL = null; paintPane(); A.el.querySelector("#pf-pane .bjr-ed")?.focus(); return; }
  if (op === "cancel") { EDIT = false; paintPane(); return; }
  if (op === "past") { PAST = !PAST; paintPane(); return; }
  if (op === "view") { VIEW = btn.dataset.id; PAST = false; MAIL = null; EDIT = false; paintPane(); return; }
  if (op === "back") { VIEW = null; paintPane(); return; }
  if (op === "mailx") { MAIL = null; paintMail(); return; }
  if (!r) return;
  const lock = on => A.el.querySelectorAll("#pf-pane [data-wr]").forEach(b => { if (on) { b.dataset.was = b.disabled ? "1" : ""; b.disabled = true; } else b.disabled = b.dataset.was === "1"; });
  lock(true);
  try {
    if (op === "save") {
      const box = A.el.querySelector("#pf-pane"), sb = A.sb();
      const { data: fresh, error } = await sb.from("client_reports").select("data,status").eq("id", r.id).maybeSingle(); if (error) throw error;
      if (!fresh) throw new Error("This report is gone. Reload the page.");
      if (!/^(draft|held)$/.test(fresh.status)) throw new Error("This report is no longer a draft, so it can't be edited.");
      const base = fresh.data || {}, E = { ...R().edits(base) };
      box.querySelectorAll("[data-ed]").forEach(t => { const p = t.dataset.ed, orig = p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), base), v = t.value.replace(/\r\n?/g, "\n").trim();
        if (!v || v === String(orig ?? "").trim()) delete E[p]; else E[p] = v; });
      const nd = { ...base, edits: E };
      await X().upd("client_reports", r.id, { data: nd });
      r.data = nd; EDIT = false; paintPane(); A.toast("Saved. The page and the email use your text.");
      return;
    }
    if (op === "hold") {
      const to = r.status === "held" ? "draft" : "held";
      await X().upd("client_reports", r.id, { status: to }); r.status = to; c.st = to;
      A.toast(to === "held" ? "Held. It won't go out." : "Back to draft."); paintDetail(); return;
    }
    if (op === "send") {
      let id = r.draft_id;
      if (!id) {
        const { data, error } = await A.sb().rpc("report_send", { report_id: r.id });
        if (error) { if (missing(error)) throw new Error("Send isn't switched on yet. Nothing was sent."); throw error; }
        id = data && typeof data === "object" ? (Array.isArray(data) ? data[0] && (data[0].draft_id ?? data[0].report_send) : data.draft_id) : data;
        if (id == null) throw new Error("The email wasn't made (no draft came back). Nothing was sent.");
        r.draft_id = id;
      }
      const d = await getDraft(id); MAIL = d || { missing: true, id };
      paintPane(); A.el.querySelector("#wr-mail")?.scrollIntoView({ block: "nearest", behavior: "auto" }); return;
    }
    if (op === "sendit") {
      const d = MAIL; if (!d || d.missing) return;
      const now = await getDraft(d.id);   // read it fresh: if it changed since it painted, show the new text and ask to read it again
      if (!now || now.body !== d.body || now.status !== d.status) { MAIL = now || { missing: true, id: d.id }; paintMail(); say("This email just changed. Read the new version, then press Send it."); return; }
      const shown = A.el.querySelector("#wr-emb").textContent, to = [d.to_email, ...(d.cc_list || [])].filter(Boolean).join(", ");
      if (shown !== String(d.body).replace(/\r\n?/g, "\n")) { say("The email on screen is not the saved one any more. Reload and open it again."); return; }
      const ok = await X().ask({ title: `Send this to ${c.name}?`, warn: `It goes out within a minute from ${d.inbox} to ${to}, word for word, with the link to the report page.`, sees: shown, cta: "Send it" });
      if (!ok) return;
      await X().upd("drafts", +d.id, { status: "approved", approved_sha256: await X().sha256hex(d.body) });
      A.toast("Sending. It goes out within a minute."); MAIL = (await getDraft(d.id)) || { ...d, status: "approved" }; paintMail(); return;
    }
  } catch (e) {
    say(refused(e) ? "Not saved: the database refused it. Nothing was sent." : String((e && e.message) || e).slice(0, 220));
  } finally { lock(false); }
}

/* ---------------- view + wire ---------------- */
const cur = () => D.clients.find(c => c.key === SEL) || null;
function view(d, api) {
  A = api; D = d;
  const k = api.lc(new URLSearchParams(location.search).get("k") || "");
  SEL = d.clients.length ? (d.clients.find(c => c.key === k) || d.clients.find(c => c.key === SEL) || d.clients[0]).key : null;
  return `<div class="pf" id="pf">${heroHTML()}
    <div class="pf-wrap${RAIL ? " rail" : ""}" id="pf-wrap"><nav class="card sp-card pf-side" aria-label="Clients"><div class="pf-sh"><b>Clients</b><span>${d.clients.length}</span><button type="button" class="pf-col" data-pf-rail aria-expanded="${!RAIL}" aria-controls="pf-list" aria-label="${RAIL ? "Show the client list" : "Shrink the client list"}" title="${RAIL ? "Show the client list" : "Shrink the client list"}">${api.ic(RAIL ? "chev" : "back")}</button></div><div class="pf-list" id="pf-list">${d.clients.map(row).join("")}</div></nav>
      <section class="card sp-card pf-main" id="pf-detail" aria-live="polite">${detail(cur())}</section></div></div>`;
}
/* CSS variables from data-v (CSSOM: the CSP allows no inline styles) + count-ups; bars, rings and numbers start from 0 when motion is on */
function fx(root, animate) {
  const els = [...root.querySelectorAll("[data-v]")], set = () => els.forEach(el => el.dataset.v.split(";").forEach(pair => { const i = pair.indexOf(":"); if (i > 0) el.style.setProperty("--" + pair.slice(0, i), pair.slice(i + 1)); }));
  const go = animate && motion();
  els.filter(el => /(^|;)[xy]:/.test(el.dataset.v)).forEach(el => el.dataset.v.split(";").forEach(pair => { const i = pair.indexOf(":"); if (/^[xy]$/.test(pair.slice(0, i))) el.style.setProperty("--" + pair.slice(0, i), pair.slice(i + 1)); }));   // positions never animate
  if (!go) { set(); return; }
  requestAnimationFrame(() => requestAnimationFrame(set));
  const ns = [...root.querySelectorAll("[data-n]")].filter(n => +n.dataset.n > 0), t0 = performance.now(), ms = 800;
  const step = now => { const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3); ns.forEach(n => { n.textContent = int(+n.dataset.n * (k < 1 ? e : 1)); }); if (k < 1 && root.isConnected) requestAnimationFrame(step); };
  if (ns.length) requestAnimationFrame(step);
}
function paintDetail() { const box = A.el.querySelector("#pf-detail"); if (!box) return; box.innerHTML = detail(cur()); box.classList.remove("pf-in"); void box.offsetWidth; box.classList.add("pf-in"); fx(box, true); }
function paintPane() { const c = cur(), box = A.el.querySelector("#pf-pane"); if (!box || !c) return; box.innerHTML = pane(c); box.setAttribute("aria-labelledby", "pf-tab-" + TAB); keep(); fx(box, false); }
function pick(key) {
  if (EDIT && !confirm("Leave without saving your edits?")) return;
  SEL = key; VIEW = null; EDIT = false; MAIL = null; PAST = false; ADJ = false; WAIT_OPEN = false;
  A.el.querySelectorAll("#pf-list [data-pf-c]").forEach(x => { if (x.dataset.pfC === SEL) { x.setAttribute("aria-current", "true"); x.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" }); } else x.removeAttribute("aria-current"); });
  paintDetail(); history.replaceState({ p: "perf" }, "", `?p=perf&k=${encodeURIComponent(SEL)}`);
}
const WIRED = new WeakSet();
function wire(api) {
  A = api; const el = api.el, root = el.querySelector("#pf");
  if (root) { fx(root, !HERO_DONE); HERO_DONE = true; el.querySelector("#pf-list [aria-current]")?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" }); }
  if (WIRED.has(el)) return; WIRED.add(el);   // the page element outlives each render: bind once
  el.addEventListener("click", ev => {
    if (!el.querySelector("#pf")) return;
    const t = ev.target, a = t.closest("[data-pf-c]");
    if (a) { if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return; ev.preventDefault(); const far = !a.closest("#pf-list") || innerWidth <= 900; pick(a.dataset.pfC);
      if (far) el.querySelector(innerWidth <= 900 ? "#pf-detail" : ".pf-wrap")?.scrollIntoView({ behavior: motion() ? "smooth" : "auto", block: "start" }); return; }
    const tb = t.closest("[data-pf-tab]");
    if (tb) { if (tb.dataset.pfTab === TAB) return; if (EDIT && !confirm("Leave without saving your edits?")) return; TAB = tb.dataset.pfTab; EDIT = false; MAIL = null; PAST = false; VIEW = null; ADJ = false;
      el.querySelectorAll("[data-pf-tab]").forEach(b => { const on = b.dataset.pfTab === TAB; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; }); paintPane(); return; }
    const rl = t.closest("[data-pf-rail]");
    if (rl) { RAIL = !RAIL; store.set("beju-crm-perf-rail", RAIL ? "1" : "0"); el.querySelector("#pf-wrap").classList.toggle("rail", RAIL); const lb = RAIL ? "Show the client list" : "Shrink the client list";
      rl.setAttribute("aria-expanded", !RAIL); rl.setAttribute("aria-label", lb); rl.title = lb; rl.innerHTML = A.ic(RAIL ? "chev" : "back"); return; }
    const pl = t.closest("[data-pf-pl]"); if (pl) { CHP = pl.dataset.pfPl; paintPane(); return; }
    const w = t.closest("#pf-pane [data-wr]"); if (w && !w.disabled) act(w.dataset.wr, w);
  });
  el.addEventListener("submit", ev => { if (ev.target.id === "pf-adj") { ev.preventDefault(); sendAdj(ev.target); } });
  el.addEventListener("keydown", ev => {   // tabs: arrow keys move between them
    const tb = ev.target.closest && ev.target.closest("[data-pf-tab]"); if (!tb || !/^Arrow(Left|Right)$/.test(ev.key)) return;
    const all = [...el.querySelectorAll("[data-pf-tab]")], n = all[(all.indexOf(tb) + (ev.key === "ArrowRight" ? 1 : all.length - 1)) % all.length]; ev.preventDefault(); n.focus(); n.click();
  });
  el.addEventListener("input", ev => { if (ev.target.id === "pf-adj-t") { const c = cur(), r = c && curOf(c); ADJ = ev.target.value.trim() !== String((r && r.adjust_note) || "").trim(); keep(); } });
  el.addEventListener("toggle", ev => { if (ev.target.id === "pf-wait") WAIT_OPEN = ev.target.open; }, true);
  el.addEventListener("error", ev => { const i = ev.target; if (i.tagName === "IMG" && i.parentElement && i.parentElement.classList.contains("pf-th")) { i.parentElement.classList.add("pf-th0"); i.parentElement.innerHTML = A.ic("play"); } }, true);   // a thumbnail that fails: the designed placeholder
  ["pointermove", "pointerdown", "pointerout"].forEach(n => el.addEventListener(n, chartHover, { passive: true }));
}
(window.BEJU_SIDE_PAGES = window.BEJU_SIDE_PAGES || {}).perf = { title: "Client performance", head: ["Client <em class=\"sf\">performance</em>", ""], src: () => null, load, view, wire };
})();
