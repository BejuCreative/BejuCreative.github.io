# Free-sample intake backend (Google Apps Script)

Backend for the `/brief/` form on bejucreative.digital. The site is static (GitHub Pages), so this small
Apps Script web app is the server side. It is **not deployed yet**: nothing here is live until you follow the steps below
and paste two values into `brief/index.html`.

What it does on each form post:

1. Drops honeypot hits silently (the hidden `website` field).
2. Verifies the Cloudflare Turnstile token against `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
3. Allows one submission per email per 7 days (`{"ok":false,"error":"rate_limited"}` after that).
4. Appends a row to the response Sheet (the same Sheet the phase-1 Google Form writes to).
5. Emails the person a one-click confirm link from the account that deploys the script (bejusipe@gmail.com). Opening the link sets `confirmed` to TRUE and `status` to `confirmed`.

It uses the same field names as the Google Form: `email, name, video, timestamp, goal, captions, graphics, brand, reference`.
Older aliases (`source_video`, `moment`, `cta`, `brand_notes`, `ref1`) are mapped to those names.
Everything else you need is below. Do every step signed in as **bejusipe@gmail.com**.

## Deploy steps

**1. Get a Turnstile site key and secret (free)**

1. Go to https://dash.cloudflare.com and sign in (or create a free account).
2. In the left menu open **Turnstile**, then **Add widget**.
3. Widget name: `BEJU brief form`. Hostnames: `bejucreative.digital` (add `localhost` too if you want to test locally).
4. Widget mode: **Managed**. Create.
5. Copy the **Site key** (public) and the **Secret key** (private). Keep the secret out of the repo.

**2. Get the response Sheet's ID**

1. Use the Google Sheet that the phase-1 Google Form writes its responses to (owned by bejusipe@gmail.com; share it with that account as Editor if it lives elsewhere). If you start without the Form, create an empty Sheet instead.
2. Copy the Sheet ID from its URL: `https://docs.google.com/spreadsheets/d/THIS_PART/edit`.
3. The script writes to the first tab (or the tab named in the optional `RESPONSE_SHEET_TAB` property). It never edits Google's columns: on every post it reads the header row and puts each value under its header by name, adding any missing header at the end. If the tab is empty it writes the header row itself.

**3. Create the script**

1. Go to https://script.google.com, **New project**, name it `BEJU intake`.
2. Replace the contents of `Code.gs` with the file `backend/apps-script/Code.gs` from this repo.
3. (Optional) In Project Settings tick **Show "appsscript.json" manifest file in editor** and paste `backend/apps-script/appsscript.json` over it.

**4. Put the secrets in Script Properties** (the Turnstile secret lives here, never in code)

1. Project Settings (gear icon), scroll to **Script Properties**, **Add script property**:
   - `TURNSTILE_SECRET` = the Turnstile **secret key** from step 1
   - `RESPONSE_SHEET_ID` = the Sheet ID from step 2 (placeholder; never commit the real one)
2. Save script properties. Do not add `REQUIRE_TURNSTILE` (only set it to `false` for a quick test, then delete it).

**5. Authorise and deploy as a web app**

1. In the editor choose the function `setup` and press **Run**. Accept the permission prompts (Sheets, send mail, external requests). The log should say the sheet is ready.
2. **Deploy**, **New deployment**, type **Web app**.
3. Description: `intake v1`. **Execute as: Me (bejusipe@gmail.com)**. **Who has access: Anyone**.
4. Deploy and copy the **Web app URL** (ends in `/exec`).

**6. Paste the two values into the page**

In `brief/index.html` replace:

```js
const TURNSTILE_SITE_KEY = "REPLACE_ME";   // the Site key from step 1
const INTAKE_ENDPOINT = "REPLACE_ME";      // the /exec URL from step 5
```

**7. Test before announcing it**

1. Submit the form on the real site with your own email.
2. Check: a row appears in the sheet (`Confirmed` = FALSE, `Status` = `unconfirmed`); the confirmation email arrives; its link shows "Confirmed. Our team gets to work." and the row flips to `confirmed` = TRUE.
3. Submit again with the same email: the form should say a request already exists (the 7 day limit).

**Changing the code later:** edit, then **Deploy**, **Manage deployments**, edit the existing deployment, **New version**. A brand-new deployment gets a new URL.

## Good to know

- **Quota:** a free Google account can send about 100 emails a day through MailApp, which is also the daily limit on confirmations. The script logs `mail_failed` in `status` when a send fails; the row is kept.
- **Link scanners:** some mail providers open links to scan them, which can confirm a row before the person clicks. If that becomes a problem, switch the confirm link to a button that posts.
- **Sheet columns.** Google's: `Timestamp`, `The video we're clipping from` (the form's `video`, with ` @ 12:40` appended when a timestamp is given), `Your name`, `The email we wrote to you on`, `After watching, what should people do?`, `Captions`, `How much is happening on screen?` (1 to 5), `Colours, fonts, anything we should keep to` (the form's brand notes; colours, font and logo link from the new form are appended to it as `Colours: ... | Font: ... | Logo: ...`), `A Short you wish was yours`. Ours, to the right: `Channel or page`, `Posting frequency`, `What you sell`, `Sells note`, `Look`, `Energy`, `Format`, `Second reference`, `Avoid`, `Music`, `Notes`, `Source` (website or email), `Confirmed`, `Confirm token`, `Status`. Header text is matched ignoring case and apostrophe style. If the Form question texts are ever edited, edit the `H` table at the top of `Code.gs` to match.
- **Two entry modes:** `src` = website (the /brief/ page with the four qualification questions) needs `channel_url`, `cadence`, `sells`. `src` = email (a link with `?src=email&email=...&name=...&video=...`) needs `video`; the page also makes the timestamp required in that mode, the server does not. A post with no `src` counts as `email` when it has no channel link.
- **Formulas:** any cell that starts with `=`, `+`, `-` or `@` is stored as plain text.
- **The channel-check script** on the Mac should read only rows where `Confirmed` is TRUE.
- **Privacy:** the form uses Cloudflare Turnstile and this Google Sheet. `privacy.html` does not describe either yet; update it before launch.
- Nothing in this folder is published to the site as a page, but the repository is public: never paste the Turnstile secret, the Sheet ID or sheet data into any file here. The `/exec` URL and the Turnstile **site** key are public by design.
