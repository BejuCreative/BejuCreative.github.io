/**
 * BEJÚ Creative: free-sample intake backend (Google Apps Script web app).
 *
 * Receives the JSON the /brief/ page posts, then:
 *   1. drops honeypot hits silently,
 *   2. verifies the Cloudflare Turnstile token (secret in Script Properties),
 *   3. allows one submission per email per 7 days,
 *   4. appends a row to the "Website Samples" sheet,
 *   5. emails a one-click confirm link (MailApp, sent from the account that deploys this script).
 * doGet(?confirm=TOKEN) flips `confirmed` for that row.
 *
 * Nothing here renders or sends a sample: rows are only data for the channel-check script.
 * Setup steps are in README.md. Script Properties used:
 *   TURNSTILE_SECRET   (required)  Cloudflare Turnstile secret key
 *   SHEET_ID           (required)  ID of the Google Sheet that holds the "Website Samples" tab
 *   REQUIRE_TURNSTILE  (optional)  set to "false" only for testing; any other value keeps it on
 */

const SHEET_NAME = 'Website Samples';
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RATE_LIMIT_DAYS = 7;
const REPLY_TO = 'hello@bejucreative.digital';
const MAX_LEN = 2000;

// Sheet columns, in order. The first block is the agreed layout; name/src/cta/brand_notes were added
// for the merged brief form and sit before the confirmation columns.
const COLUMNS = [
  'submitted_at', 'email', 'channel_url', 'cadence', 'sells', 'sells_note', 'look', 'captions', 'energy',
  'graphics', 'colours', 'font', 'logo_url', 'format', 'source_video', 'moment', 'ref1', 'ref2', 'avoid',
  'music', 'notes', 'name', 'src', 'cta', 'brand_notes', 'confirmed', 'confirm_token', 'status'
];

/* ───────────────────────── web app entry points ───────────────────────── */

function doPost(e) {
  try {
    const raw = parseBody_(e);
    if (!raw) return json_({ ok: false, error: 'invalid' });

    // 1. Honeypot: bots fill the hidden "website" field. Pretend success, store nothing.
    if (str_(raw.website)) return json_({ ok: true });

    const data = normalise_(raw);

    // 2. Basic validation
    const problem = validate_(data);
    if (problem) return json_({ ok: false, error: 'invalid', detail: problem });

    // 3. Turnstile
    if (turnstileRequired_()) {
      const token = str_(raw.turnstile_token) || str_(raw['cf-turnstile-response']);
      if (!token || !verifyTurnstile_(token)) return json_({ ok: false, error: 'spam_check' });
    }

    // 4. Rate limit + append (one lock so two quick posts cannot both pass)
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    let token;
    try {
      const sheet = sheet_();
      if (recentSubmission_(sheet, data.email)) return json_({ ok: false, error: 'rate_limited' });
      token = newToken_();
      sheet.appendRow(COLUMNS.map(function (c) {
        if (c === 'submitted_at') return new Date();
        if (c === 'confirmed') return 'FALSE';
        if (c === 'confirm_token') return token;
        if (c === 'status') return 'unconfirmed';
        return safeCell_(data[c]);
      }));
    } finally {
      lock.releaseLock();
    }

    // 5. Confirmation email. If it fails the row stays, flagged for a manual nudge.
    try {
      sendConfirmation_(data, token);
    } catch (mailErr) {
      markStatus_(token, 'mail_failed');
      console.error('Confirmation mail failed: ' + mailErr);
    }
    return json_({ ok: true });
  } catch (err) {
    console.error(err && err.stack || err);
    return json_({ ok: false, error: 'server' });
  }
}

function doGet(e) {
  const token = e && e.parameter && e.parameter.confirm;
  if (!token) return ContentService.createTextOutput('BEJÚ intake: OK');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = sheet_();
    const col = COLUMNS.indexOf('confirm_token') + 1;
    const last = sheet.getLastRow();
    if (last < 2) return page_('This link is not valid or has expired.', false);
    const tokens = sheet.getRange(2, col, last - 1, 1).getValues();
    for (let i = 0; i < tokens.length; i++) {
      if (String(tokens[i][0]) === String(token)) {
        const row = i + 2;
        sheet.getRange(row, COLUMNS.indexOf('confirmed') + 1).setValue('TRUE');
        sheet.getRange(row, COLUMNS.indexOf('status') + 1).setValue('confirmed');
        return page_('Confirmed. Our team gets to work.', true);
      }
    }
    return page_('This link is not valid or has expired.', false);
  } finally {
    lock.releaseLock();
  }
}

/* ───────────────────────── input handling ───────────────────────── */

function parseBody_(e) {
  if (!e) return null;
  if (e.postData && e.postData.contents) {
    try {
      const o = JSON.parse(e.postData.contents);
      if (o && typeof o === 'object' && !Array.isArray(o)) return o;
    } catch (err) { /* fall through to form-encoded */ }
  }
  if (e.parameter && Object.keys(e.parameter).length) return e.parameter;
  return null;
}

/**
 * Accepts this site's field names and the plain JSON of the earlier intake form
 * (name, email, video, timestamp, cta, captions, graphics, brand_notes, reference).
 */
function normalise_(r) {
  const pick = function () {
    for (let i = 0; i < arguments.length; i++) {
      const v = r[arguments[i]];
      if (v !== undefined && v !== null && str_(v) !== '') return str_(v);
    }
    return '';
  };
  const refs = [];
  ['ref1', 'ref2'].forEach(function (k) { if (str_(r[k])) refs.push(str_(r[k])); });
  const alt = r.reference !== undefined ? r.reference : r.references;
  if (Array.isArray(alt)) alt.forEach(function (v) { if (str_(v)) refs.push(str_(v)); });
  else if (str_(alt)) refs.push(str_(alt));

  const d = {
    email: pick('email').toLowerCase(),
    name: pick('name'),
    channel_url: pick('channel_url', 'channel'),
    cadence: pick('cadence'),
    sells: pick('sells'),
    sells_note: pick('sells_note'),
    look: pick('look'),
    captions: pick('captions'),
    energy: pick('energy'),
    graphics: pick('graphics'),
    colours: pick('colours', 'colors', 'colour'),
    font: pick('font'),
    logo_url: pick('logo_url', 'logo'),
    format: pick('format'),
    source_video: pick('source_video', 'video'),
    moment: pick('moment', 'timestamp'),
    ref1: refs[0] || '',
    ref2: refs[1] || '',
    avoid: pick('avoid'),
    music: pick('music'),
    notes: pick('notes'),
    cta: pick('cta'),
    brand_notes: pick('brand_notes', 'brand')
  };
  // src: 'website' (qualification page) or 'email' (lead who already said yes). Plain JSON with no
  // channel and a video counts as an email-mode brief.
  const src = pick('src').toLowerCase();
  d.src = src === 'email' || src === 'website' ? src : (d.channel_url ? 'website' : 'email');
  return d;
}

function validate_(d) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email) || d.email.length > 200) return 'email';
  if (d.src === 'website') {
    if (!isUrl_(d.channel_url)) return 'channel_url';
    if (!d.cadence) return 'cadence';
    if (!d.sells) return 'sells';
  } else {
    if (!isUrl_(d.source_video)) return 'source_video';
    if (!d.moment) return 'moment';
  }
  const urls = [['logo_url', d.logo_url], ['source_video', d.source_video], ['ref1', d.ref1], ['ref2', d.ref2]];
  for (let i = 0; i < urls.length; i++) if (urls[i][1] && !isUrl_(urls[i][1])) return urls[i][0];
  return '';
}

function isUrl_(v) { return /^https?:\/\/[^\s\/]+\.[^\s\/]+/i.test(v || ''); }
function str_(v) { return v === undefined || v === null ? '' : String(v).trim().slice(0, MAX_LEN); }
// A cell that starts with = + - @ would run as a formula in Sheets: store it as text.
function safeCell_(v) { v = str_(v); return /^[=+\-@\t\r]/.test(v) ? "'" + v : v; }
function newToken_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }

/* ───────────────────────── Turnstile ───────────────────────── */

function turnstileRequired_() {
  return PropertiesService.getScriptProperties().getProperty('REQUIRE_TURNSTILE') !== 'false';
}

function verifyTurnstile_(token) {
  const secret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET');
  if (!secret) throw new Error('TURNSTILE_SECRET is not set in Script Properties');
  const res = UrlFetchApp.fetch(SITEVERIFY_URL, {
    method: 'post',
    payload: { secret: secret, response: token },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) return false;
  const out = JSON.parse(res.getContentText());
  return out && out.success === true;
}

/* ───────────────────────── sheet ───────────────────────── */

function sheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('SHEET_ID is not set in Script Properties');
  const ss = SpreadsheetApp.openById(id);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(COLUMNS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function recentSubmission_(sheet, email) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const cutoff = Date.now() - RATE_LIMIT_DAYS * 24 * 3600 * 1000;
  const vals = sheet.getRange(2, 1, last - 1, 2).getValues();   // submitted_at, email
  for (let i = 0; i < vals.length; i++) {
    const when = vals[i][0] instanceof Date ? vals[i][0].getTime() : Date.parse(vals[i][0]);
    if (String(vals[i][1]).toLowerCase() === email && (isNaN(when) || when >= cutoff)) return true;
  }
  return false;
}

function markStatus_(token, status) {
  const sheet = sheet_();
  const col = COLUMNS.indexOf('confirm_token') + 1, last = sheet.getLastRow();
  if (last < 2) return;
  const tokens = sheet.getRange(2, col, last - 1, 1).getValues();
  for (let i = 0; i < tokens.length; i++) {
    if (String(tokens[i][0]) === token) { sheet.getRange(i + 2, COLUMNS.indexOf('status') + 1).setValue(status); return; }
  }
}

/* ───────────────────────── email + pages ───────────────────────── */

function sendConfirmation_(d, token) {
  const link = ScriptApp.getService().getUrl() + '?confirm=' + encodeURIComponent(token);
  const hello = d.name ? 'Hi ' + d.name.split(' ')[0] + ',' : 'Hi,';
  const text = hello + '\n\nOne click and our team gets to work on your free sample:\n' + link +
    '\n\nIf you did not ask for this, ignore this email and nothing happens.\n\nBEJÚ Creative\n' + REPLY_TO;
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#222">' +
    '<p>' + esc_(hello) + '</p>' +
    '<p>One click and our team gets to work on your free sample.</p>' +
    '<p><a href="' + link + '" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#C7A24B;color:#1F1708;text-decoration:none;font-weight:600">Confirm and get started</a></p>' +
    '<p style="font-size:14px;color:#666">If the button does not work, paste this into your browser:<br>' + esc_(link) + '</p>' +
    '<p style="font-size:14px;color:#666">If you did not ask for this, ignore this email and nothing happens.</p>' +
    '<p>BEJÚ Creative<br>' + REPLY_TO + '</p></div>';
  MailApp.sendEmail({
    to: d.email,
    subject: 'Confirm your free sample request',
    body: text,
    htmlBody: html,
    name: 'BEJÚ Creative',
    replyTo: REPLY_TO
  });
}

function esc_(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

function page_(message, ok) {
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>BEJÚ Creative</title></head><body style="margin:0;background:#090B07;color:#F5F5F7;font-family:system-ui,Arial,sans-serif;display:grid;place-items:center;min-height:100vh;padding:24px;text-align:center">' +
    '<div><h1 style="font-size:28px;margin:0 0 12px">' + esc_(message) + '</h1>' +
    (ok ? '<p style="color:#C5C8BD;margin:0 0 20px">You can close this tab. We will email you.</p>' : '') +
    '<a href="https://bejucreative.digital/" style="color:#D8B865">bejucreative.digital</a></div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('BEJÚ Creative');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ───────────────────────── one-time setup helper ───────────────────────── */

/** Run once from the Apps Script editor: creates the header row and triggers the permission prompts. */
function setup() {
  const sh = sheet_();
  MailApp.getRemainingDailyQuota();
  UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/api.js', { muteHttpExceptions: true });
  Logger.log('OK. Sheet "' + SHEET_NAME + '" ready with ' + sh.getLastColumn() + ' columns. Mail quota left today: ' + MailApp.getRemainingDailyQuota());
}
