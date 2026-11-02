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
 *   TURNSTILE_SECRET    (required)  Cloudflare Turnstile secret key
 *   RESPONSE_SHEET_ID   (required)  ID of the response Google Sheet (the same one the phase-1 Google Form writes to)
 *   RESPONSE_SHEET_TAB  (optional)  tab name; default is the first tab
 *   REQUIRE_TURNSTILE   (optional)  set to "false" only for testing; any other value keeps it on
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RATE_LIMIT_DAYS = 7;
const REPLY_TO = 'hello@bejucreative.digital';
const MAX_LEN = 2000;

// The response Sheet is created by the phase-1 Google Form, so its first columns are Google's: "Timestamp" and the
// question texts. We never move or rewrite those. Our extra fields live in columns to the right. On every append the
// header row is read and each value goes under its header BY NAME (never by position); a missing header is added at
// the end. If the sheet is empty, the header row is Timestamp + the Form questions + our extras, in this order.
const H = {
  time: 'Timestamp',
  video: "The video we're clipping from",
  name: 'Your name',
  email: 'The email we wrote to you on',
  goal: 'After watching, what should people do?',
  captions: 'Captions',
  graphics: 'How much is happening on screen?',
  brand: 'Colours, fonts, anything we should keep to',
  reference: 'A Short you wish was yours',
  channel: 'Channel or page',
  cadence: 'Posting frequency',
  sells: 'What you sell',
  sellsNote: 'Sells note',
  look: 'Look',
  energy: 'Energy',
  format: 'Format',
  ref2: 'Second reference',
  avoid: 'Avoid',
  music: 'Music',
  notes: 'Notes',
  source: 'Source',
  confirmed: 'Confirmed',
  token: 'Confirm token',
  status: 'Status'
};
const HEADER_ROW = [H.time, H.video, H.name, H.email, H.goal, H.captions, H.graphics, H.brand, H.reference,
  H.channel, H.cadence, H.sells, H.sellsNote, H.look, H.energy, H.format, H.ref2, H.avoid, H.music, H.notes,
  H.source, H.confirmed, H.token, H.status];

/* ───────────────────────── web app entry points ───────────────────────── */

function doPost(e) {
  try {
    const raw = parseBody_(e);
    if (!raw) return json_({ ok: false, error: 'invalid' });

    // 1. Honeypot: bots fill the hidden "fax_extension" field. Pretend success, store nothing.
    if (str_(raw.fax_extension)) return json_({ ok: true });

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
      const sheet = sheet_(), cols = headers_(sheet);
      if (recentSubmission_(sheet, cols, data.email)) return json_({ ok: false, error: 'rate_limited' });
      token = newToken_();
      const values = {};
      values[H.time] = new Date();
      values[H.video] = safeCell_(data.video + (data.timestamp ? ' @ ' + data.timestamp : ''));
      values[H.name] = safeCell_(data.name);
      values[H.email] = safeCell_(data.email);
      values[H.goal] = safeCell_(data.goal);
      values[H.captions] = safeCell_(data.captions);
      values[H.graphics] = safeCell_(data.graphics);
      values[H.brand] = safeCell_(brandText_(data));
      values[H.reference] = safeCell_(data.reference);
      values[H.channel] = safeCell_(data.channel_url);
      values[H.cadence] = safeCell_(data.cadence);
      values[H.sells] = safeCell_(data.sells);
      values[H.sellsNote] = safeCell_(data.sells_note);
      values[H.look] = safeCell_(data.look);
      values[H.energy] = safeCell_(data.energy);
      values[H.format] = safeCell_(data.format);
      values[H.ref2] = safeCell_(data.ref2);
      values[H.avoid] = safeCell_(data.avoid);
      values[H.music] = safeCell_(data.music);
      values[H.notes] = safeCell_(data.notes);
      values[H.source] = data.src;
      values[H.confirmed] = 'FALSE';
      values[H.token] = token;
      values[H.status] = 'unconfirmed';
      const width = sheet.getLastColumn(), row = [];
      for (let i = 0; i < width; i++) row.push('');
      Object.keys(values).forEach(function (h) { row[cols[norm_(h)] - 1] = values[h]; });
      sheet.appendRow(row);
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
    const sheet = sheet_(), cols = headers_(sheet);
    const col = cols[norm_(H.token)];
    const last = sheet.getLastRow();
    if (last < 2) return page_('This link is not valid or has expired.', false);
    const tokens = sheet.getRange(2, col, last - 1, 1).getValues();
    for (let i = 0; i < tokens.length; i++) {
      if (String(tokens[i][0]) === String(token)) {
        const row = i + 2;
        sheet.getRange(row, cols[norm_(H.confirmed)]).setValue('TRUE');
        sheet.getRange(row, cols[norm_(H.status)]).setValue('confirmed');
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
 * Accepts the shared field names (email, name, video, timestamp, goal, captions, graphics, brand, reference ...)
 * and older aliases (source_video, moment, cta, brand_notes, ref1).
 */
function normalise_(r) {
  const pick = function () {
    for (let i = 0; i < arguments.length; i++) {
      const v = r[arguments[i]];
      if (v !== undefined && v !== null && str_(v) !== '') return str_(v);
    }
    return '';
  };
  const d = {
    email: pick('email').toLowerCase(),
    name: pick('name'),
    video: pick('video', 'source_video'),
    timestamp: pick('timestamp', 'moment'),
    goal: pick('goal', 'cta'),
    captions: pick('captions'),
    graphics: pick('graphics'),
    brand: pick('brand', 'brand_notes'),
    reference: pick('reference', 'ref1'),
    channel_url: pick('channel_url', 'channel'),
    cadence: pick('cadence'),
    sells: pick('sells'),
    sells_note: pick('sells_note'),
    look: pick('look'),
    energy: pick('energy'),
    colours: pick('colours', 'colors', 'colour'),
    font: pick('font'),
    logo_url: pick('logo_url', 'logo'),
    format: pick('format'),
    ref2: pick('ref2'),
    avoid: pick('avoid'),
    music: pick('music'),
    notes: pick('notes')
  };
  // A list sent as "reference" (array) becomes reference + ref2.
  if (Array.isArray(r.reference)) { d.reference = str_(r.reference[0]); d.ref2 = d.ref2 || str_(r.reference[1]); }
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
    if (!isUrl_(d.video)) return 'video';
  }
  const urls = [['logo_url', d.logo_url], ['video', d.video], ['reference', d.reference], ['ref2', d.ref2]];
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
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('RESPONSE_SHEET_ID');
  if (!id) throw new Error('RESPONSE_SHEET_ID is not set in Script Properties');
  const ss = SpreadsheetApp.openById(id);
  const tab = props.getProperty('RESPONSE_SHEET_TAB');
  const sh = tab ? (ss.getSheetByName(tab) || ss.insertSheet(tab)) : ss.getSheets()[0];
  // Header row only if the sheet is empty. If one exists (the Form's), keep it and add any missing header at the end.
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADER_ROW);
    sh.setFrozenRows(1);
  } else {
    const have = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return norm_(h); });
    HEADER_ROW.forEach(function (h) {
      if (have.indexOf(norm_(h)) === -1) { sh.getRange(1, have.length + 1).setValue(h); have.push(norm_(h)); }
    });
  }
  return sh;
}

// Header text compared without case, spacing or apostrophe style (Google may store a curly apostrophe).
function norm_(s) { return String(s).replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase(); }

/** The Form has one brand column; our colours, font and logo link are folded into it. */
function brandText_(d) {
  const parts = [];
  if (d.brand) parts.push(d.brand);
  if (d.colours) parts.push('Colours: ' + d.colours);
  if (d.font) parts.push('Font: ' + d.font);
  if (d.logo_url) parts.push('Logo: ' + d.logo_url);
  return parts.join(' | ');
}

/** normalised header text -> 1-based column number */
function headers_(sheet) {
  const row = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0], out = {};
  row.forEach(function (h, i) { const k = norm_(h); if (k && out[k] === undefined) out[k] = i + 1; });
  return out;
}

function recentSubmission_(sheet, cols, email) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const cutoff = Date.now() - RATE_LIMIT_DAYS * 24 * 3600 * 1000;
  const when_ = sheet.getRange(2, cols[norm_(H.time)], last - 1, 1).getValues();
  const mail_ = sheet.getRange(2, cols[norm_(H.email)], last - 1, 1).getValues();
  for (let i = 0; i < mail_.length; i++) {
    if (String(mail_[i][0]).trim().toLowerCase() !== email) continue;
    const w = when_[i][0] instanceof Date ? when_[i][0].getTime() : Date.parse(when_[i][0]);
    if (isNaN(w) || w >= cutoff) return true;
  }
  return false;
}

function markStatus_(token, status) {
  const sheet = sheet_(), cols = headers_(sheet), last = sheet.getLastRow();
  if (last < 2) return;
  const tokens = sheet.getRange(2, cols[norm_(H.token)], last - 1, 1).getValues();
  for (let i = 0; i < tokens.length; i++) {
    if (String(tokens[i][0]) === token) { sheet.getRange(i + 2, cols[norm_(H.status)]).setValue(status); return; }
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
  Logger.log('OK. Response sheet ready with ' + sh.getLastColumn() + ' columns. Mail quota left today: ' + MailApp.getRemainingDailyQuota());
}
