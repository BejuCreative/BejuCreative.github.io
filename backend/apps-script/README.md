# Free-sample intake backend (Google Apps Script)

Backend for the `/brief/` form on bejucreative.digital. The site is static (GitHub Pages), so this small
Apps Script web app is the server side. It is **not deployed yet**: nothing here is live until you follow the steps below
and paste two values into `brief/index.html`.

What it does on each form post:

1. Drops honeypot hits silently (the hidden `website` field).
2. Verifies the Cloudflare Turnstile token against `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
3. Allows one submission per email per 7 days (`{"ok":false,"error":"rate_limited"}` after that).
4. Appends a row to the **Website Samples** sheet.
5. Emails the person a one-click confirm link from the account that deploys the script (bejusipe@gmail.com). Opening the link sets `confirmed` to TRUE and `status` to `confirmed`.

It accepts this site's field names and the plain JSON of the earlier intake form
(`name`, `email`, `video`, `timestamp`, `cta`, `captions`, `graphics`, `brand_notes`, `reference`).
Everything else you need is below. Do every step signed in as **bejusipe@gmail.com**.

## Deploy steps

**1. Get a Turnstile site key and secret (free)**

1. Go to https://dash.cloudflare.com and sign in (or create a free account).
2. In the left menu open **Turnstile**, then **Add widget**.
3. Widget name: `BEJU brief form`. Hostnames: `bejucreative.digital` (add `localhost` too if you want to test locally).
4. Widget mode: **Managed**. Create.
5. Copy the **Site key** (public) and the **Secret key** (private). Keep the secret out of the repo.

**2. Create the Sheet**

1. In Google Drive (bejusipe@gmail.com) create a new Google Sheet. Name the file anything, for example `Website Samples`.
2. Rename the first tab to `Website Samples` (the script creates it if it is missing, and writes the header row).
3. Copy the Sheet ID from its URL: `https://docs.google.com/spreadsheets/d/THIS_PART/edit`.

**3. Create the script**

1. Go to https://script.google.com, **New project**, name it `BEJU intake`.
2. Replace the contents of `Code.gs` with the file `backend/apps-script/Code.gs` from this repo.
3. (Optional) In Project Settings tick **Show "appsscript.json" manifest file in editor** and paste `backend/apps-script/appsscript.json` over it.

**4. Put the secrets in Script Properties** (the Turnstile secret lives here, never in code)

1. Project Settings (gear icon), scroll to **Script Properties**, **Add script property**:
   - `TURNSTILE_SECRET` = the Turnstile **secret key** from step 1
   - `SHEET_ID` = the Sheet ID from step 2
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
2. Check: a row appears in the sheet (`confirmed` = FALSE, `status` = `unconfirmed`); the confirmation email arrives; its link shows "Confirmed. Our team gets to work." and the row flips to `confirmed` = TRUE.
3. Submit again with the same email: the form should say a request already exists (the 7 day limit).

**Changing the code later:** edit, then **Deploy**, **Manage deployments**, edit the existing deployment, **New version**. A brand-new deployment gets a new URL.

## Good to know

- **Quota:** a free Google account can send about 100 emails a day through MailApp, which is also the daily limit on confirmations. The script logs `mail_failed` in `status` when a send fails; the row is kept.
- **Link scanners:** some mail providers open links to scan them, which can confirm a row before the person clicks. If that becomes a problem, switch the confirm link to a button that posts.
- **Sheet columns:** `submitted_at, email, channel_url, cadence, sells, sells_note, look, captions, energy, graphics, colours, font, logo_url, format, source_video, moment, ref1, ref2, avoid, music, notes, name, src, cta, brand_notes, confirmed, confirm_token, status`. The last three are for the confirm flow; `name`, `src`, `cta` and `brand_notes` were added for the merged brief form. `src` is `website` or `email`.
- **Two entry modes:** `src = website` needs `channel_url`, `cadence`, `sells`. `src = email` (a link with `?src=email&email=...&name=...`) needs `source_video` and `moment`. A post with no `src` is treated as `email` mode when it has no channel link.
- **Formulas:** any cell that starts with `=`, `+`, `-` or `@` is stored as plain text.
- **The channel-check script** on the Mac should read only rows where `confirmed` is TRUE.
- **Privacy:** the form uses Cloudflare Turnstile and this Google Sheet. `privacy.html` does not describe either yet; update it before launch.
- Nothing in this folder is published to the site as a page, but the repository is public: never paste the Turnstile secret, the Sheet ID or sheet data into any file here. The `/exec` URL and the Turnstile **site** key are public by design.
