/* BEJÚ weekly report: ONE render for the client's private page (report/index.html) and the CRM preview (crm ?p=perf).
   SIMAS 11-23, contract docs/perf_1123/REPORTS_SPEC.md (client_reports.data v1). Pure: data in, HTML string out. No network, no globals but
   window.BEJU_REPORT. Rules: every number shows "as of"; views per platform, never added together; ad value is always "an estimate";
   founders' text edits (data.edits {path: text}) win over the built text; plain words; nothing about how the report is made.
   CSP: no inline styles; every class starts with bjr- and report.css scopes them under .bjr. */
(() => {
"use strict";
const esc = s => String(s ?? "").replace(/[&<>"'`]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" }[c]));
const PL = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", linkedin: "LinkedIn" };
const plN = p => PL[String(p || "").toLowerCase()] || p || "";
const num = v => v == null || v === "" || !isFinite(+v) ? null : +v;
const int = v => num(v) == null ? "–" : new Intl.NumberFormat("en-US").format(Math.round(+v));
const kf = v => { v = num(v); if (v == null) return "–"; const a = Math.abs(v), s = v < 0 ? "-" : "";
  return a >= 1e6 ? s + (a / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : a >= 1e4 ? s + Math.round(a / 1e3) + "k" : a >= 1e3 ? s + (a / 1e3).toFixed(1).replace(/\.0$/, "") + "k" : s + String(Math.round(a)); };
const usd = v => num(v) == null ? "–" : "$" + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(+v);
const fD = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const fDY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const dt = s => { if (!s) return null; const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + "T12:00:00Z" : s); return isNaN(d) ? null : d; };
const day = s => { const d = dt(s); return d ? fD.format(d) : ""; };
const asOf = s => { const d = dt(s); return d ? `as of ${fD.format(d)}` : ""; };
const weekLabel = (a, b) => { const x = dt(a), y = dt(b); if (!x && !y) return ""; if (!x || !y) return fDY.format(x || y);
  const sameM = x.getUTCMonth() === y.getUTCMonth(); return `${fD.format(x)} – ${sameM ? y.getUTCDate() : fD.format(y)}, ${y.getUTCFullYear()}`; };
const safeUrl = u => { try { const x = new URL(String(u || "")); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch (e) { return ""; } };
const ytId = u => { const m = String(u || "").match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([\w-]{6,20})/); return m ? m[1] : ""; };
const first = n => String(n || "").trim().split(/\s+/)[0] || "";

/* the editable text paths (contract: best.why, ideas[].idea, next_week, summary_lines) */
const edits = d => d && d.edits && typeof d.edits === "object" && !Array.isArray(d.edits) ? d.edits : {};
function get(d, path) { return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), d); }
function text(d, path) { const e = edits(d); return typeof e[path] === "string" ? e[path] : get(d, path); }
function summary(d) {   // summary_lines: per-line edits "summary_lines.0"; a whole-block edit "summary_lines" (one line per line) also works
  const e = edits(d); if (typeof e.summary_lines === "string") return e.summary_lines.split(/\n+/).map(s => s.trim()).filter(Boolean);
  return (Array.isArray(d.summary_lines) ? d.summary_lines : []).map((s, i) => typeof e["summary_lines." + i] === "string" ? e["summary_lines." + i] : s).map(s => String(s || "").trim()).filter(Boolean);
}
const isV1 = d => !!d && typeof d === "object" && +d.v === 1;

/* edit mode: a text field in place of the text, same spot, same size */
const field = (o, path, val, label, rows) => o.edit ? `<textarea class="bjr-ed" data-ed="${esc(path)}" rows="${rows || 3}" aria-label="${esc(label)}">${esc(val || "")}</textarea>` : "";

function numbers(d) {
  const N = d.numbers || {}, V = (N.our_views_week || []).filter(x => num(x.views) != null), P = N.posted || {}, F = (N.followers || []).filter(f => num(f.change) != null || num(f.end) != null);
  const top = V.filter(x => !x.stale).sort((a, b) => +b.views - +a.views)[0] || V.slice().sort((a, b) => +b.views - +a.views)[0];
  const hero = top ? `<div class="bjr-hero"><span class="bjr-eyebrow">Views on your Shorts this week</span><b class="bjr-big">${esc(int(top.views))}</b>
      <span class="bjr-sub">on ${esc(plN(top.platform))} · ${esc(asOf(top.as_of || d.as_of))}${top.stale ? " · older data" : ""}</span></div>` : "";
  const tiles = V.filter(x => x !== top).map(x => `<div class="bjr-tile${x.stale ? " bjr-stale" : ""}"><span>${esc(plN(x.platform))}</span><b>${esc(int(x.views))}</b><small>views this week · ${esc(asOf(x.as_of || d.as_of))}${x.stale ? " · older data, not updated this week" : ""}</small></div>`);
  if (num(P.delivered) != null) tiles.push(`<div class="bjr-tile"><span>Posted</span><b>${esc(int(P.posted))} <i>of ${esc(int(P.delivered))}</i></b><small>Shorts we delivered are live · ${esc(asOf(d.as_of))}</small></div>`);
  F.forEach(f => { const c = num(f.change); tiles.push(`<div class="bjr-tile"><span>${esc(plN(f.platform))} followers</span><b>${c == null ? esc(int(f.end)) : (c > 0 ? "+" : "") + esc(int(c))}</b><small>${num(f.start) != null && num(f.end) != null ? `${esc(int(f.start))} → ${esc(int(f.end))} this week` : "this week"}${f.rounded ? " · YouTube rounds this number" : ""} · ${esc(asOf(d.as_of))}</small></div>`); });
  if (!hero && !tiles.length) return `<section class="bjr-sec"><h2>This week in numbers</h2><p class="bjr-none">No numbers for this week yet.</p></section>`;
  return `<section class="bjr-sec bjr-nums"><h2>This week in numbers</h2>${hero}${tiles.length ? `<div class="bjr-tiles">${tiles.join("")}</div>` : ""}
    ${V.length > 1 ? `<p class="bjr-note">Each platform counts its own views, so we show them side by side.</p>` : ""}</section>`;
}
const stats = (s, d) => `<span class="bjr-stats"><b>${esc(int(s.views))}</b> views · ${esc(int(s.likes))} likes · ${esc(int(s.comments))} comments <small>${esc(asOf(s.as_of || d.as_of))}</small></span>`;
function best(d, o) {
  const b = d.best; if (!b) return "";
  const u = safeUrl(b.url), id = /youtube/i.test(b.platform || "") || /youtu/.test(u) ? ytId(u) : "", why = text(d, "best.why");
  return `<section class="bjr-sec"><h2>Best Short this week</h2><article class="bjr-best">
    ${id ? `<a class="bjr-thumb" href="${esc(u)}" target="_blank" rel="noopener noreferrer"><img src="https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360"></a>` : ""}
    <div class="bjr-bb"><span class="bjr-eyebrow">${esc(plN(b.platform))}</span><h3>${esc(b.label || "Your best Short")}</h3>${stats(b, d)}
      <div class="bjr-why"><b>Why it worked</b>${o.edit ? field(o, "best.why", why, "Why it worked", 4) : why ? `<p>${esc(why)}</p>` : `<p class="bjr-none">Not written yet.</p>`}</div>
      ${u ? `<a class="bjr-btn" href="${esc(u)}" target="_blank" rel="noopener noreferrer">Watch it on ${esc(plN(b.platform) || "the platform")}</a>` : ""}</div></article></section>`;
}
function shorts(d) {
  const S = (d.shorts || []).slice().sort((a, b) => String(b.posted_at || "").localeCompare(String(a.posted_at || "")));
  if (!S.length) return `<section class="bjr-sec"><h2>Every Short we made</h2><p class="bjr-none">No Shorts posted in this window yet.</p></section>`;
  return `<section class="bjr-sec"><h2>Every Short we made <small>${S.length} · ${esc(asOf(d.as_of))}</small></h2><ol class="bjr-list">${S.map(s => { const u = safeUrl(s.url);
    return `<li class="bjr-row${s.removed ? " bjr-gone" : ""}"><div class="bjr-rt"><b>${esc(s.label || "Short")}</b><span>${esc([plN(s.platform), s.posted_at ? "posted " + day(s.posted_at) : "", s.removed ? "taken down, last numbers" : ""].filter(Boolean).join(" · "))}</span></div>
      <div class="bjr-rn"><span><b>${esc(kf(s.views))}</b> views</span><span>${esc(kf(s.likes))} likes</span><span>${esc(kf(s.comments))} comments</span></div>
      ${u ? `<a class="bjr-link" href="${esc(u)}" target="_blank" rel="noopener noreferrer" aria-label="Watch ${esc(s.label || "this Short")}">Watch</a>` : `<span class="bjr-link bjr-off">–</span>`}</li>`; }).join("")}</ol></section>`;
}
function ideas(d, o) {
  const I = (d.ideas || []).filter(x => x && x.source);   // never an idea without a real source
  if (!I.length) return "";
  return `<section class="bjr-sec"><h2>What to talk about next</h2><p class="bjr-lede">Ideas from your own content.</p><ol class="bjr-ideas">${I.map((x, i) => { const k = (d.ideas || []).indexOf(x), t = text(d, `ideas.${k}.idea`);
    return `<li><span class="bjr-n">${i + 1}</span><div>${o.edit ? field(o, `ideas.${k}.idea`, t, `Idea ${i + 1}`, 3) : `<p>${esc(t)}</p>`}<small>From: ${esc(x.source)}</small></div></li>`; }).join("")}</ol></section>`;
}
function value(d) {
  const V = d.value || {}, T = (V.tracked || []).filter(x => x && x.label), A = V.ad_value;
  if (!T.length && !(A && num(A.usd) != null)) return "";
  return `<section class="bjr-sec"><h2>Value <small>${esc(asOf(d.as_of))}</small></h2>
    ${T.length ? `<div class="bjr-kv">${T.map(x => `<div><span>${esc(x.label)}</span><b>${esc(x.value == null || x.value === "" ? "not tracked yet" : typeof x.value === "number" ? int(x.value) : x.value)}</b>${x.note ? `<small>${esc(x.note)}</small>` : ""}</div>`).join("")}</div>` : ""}
    ${A && num(A.usd) != null ? `<div class="bjr-ad"><span>Ad value (estimate)</span><b>${esc(usd(A.usd))}</b><small>What these views would cost as ads. It's an estimate, not money earned.${A.basis ? ` Basis: ${esc(A.basis)}.` : ""}</small></div>` : ""}</section>`;
}
function extras(d) {
  const E = (d.extras || []).filter(x => x && x.label); if (!E.length) return "";
  return `<section class="bjr-sec"><h2>Also tracked <small>${esc(asOf(d.as_of))}</small></h2><div class="bjr-kv">${E.map(x => `<div><span>${esc(x.label)}</span><b>${esc(x.value == null || x.value === "" ? "not tracked yet" : typeof x.value === "number" ? int(x.value) : x.value)}</b>${x.note ? `<small>${esc(x.note)}</small>` : ""}</div>`).join("")}</div></section>`;
}

/* render(data, { edit, name }) → the whole report (brand bar to footer). name = client's first name when data has none. */
function render(d, o) {
  o = o || {};
  if (!isV1(d)) return `<div class="bjr"><div class="bjr-in"><p class="bjr-none">This report is in an older format and can't be shown here.</p></div></div>`;
  const nm = first(o.name || (d.client && d.client.name)), wk = weekLabel(d.week_start, d.week_end), sum = summary(d), nx = text(d, "next_week");
  const sumEd = o.edit ? (Array.isArray(d.summary_lines) ? d.summary_lines : []).map((s, i) => field(o, "summary_lines." + i, text(d, "summary_lines." + i), `Summary line ${i + 1}`, 2)).join("") : "";
  return `<div class="bjr${o.edit ? " bjr-editing" : ""}"><div class="bjr-in">
    <header class="bjr-top"><span class="bjr-brand">BEJÚ Creative</span><span class="bjr-for">${nm ? `Prepared for ${esc(nm)}` : "Weekly report"}</span></header>
    <div class="bjr-head"><span class="bjr-eyebrow">Your weekly report</span><h1>${esc(wk || "This week")}</h1>${d.as_of ? `<p class="bjr-asof">Numbers ${esc(asOf(d.as_of))}</p>` : ""}</div>
    ${o.edit ? `<section class="bjr-sec bjr-sum"><h2>This week</h2>${sumEd || `<p class="bjr-none">No summary lines.</p>`}</section>` : sum.length ? `<section class="bjr-sec bjr-sum"><ul>${sum.map(s => `<li>${esc(s)}</li>`).join("")}</ul></section>` : ""}
    ${numbers(d)}${best(d, o)}${shorts(d)}${ideas(d, o)}${value(d)}
    ${nx || o.edit ? `<section class="bjr-sec bjr-next"><h2>Next week</h2>${o.edit ? field(o, "next_week", nx, "Next week", 4) : `<p>${esc(nx)}</p>`}</section>` : ""}
    ${extras(d)}
    <footer class="bjr-foot"><p>Questions about anything here? Just reply to our email.</p><span>BEJÚ Creative · bejucreative.digital</span></footer>
  </div></div>`;
}
window.BEJU_REPORT = { render, isV1, edits, text, summary, weekLabel, first, esc };
})();
