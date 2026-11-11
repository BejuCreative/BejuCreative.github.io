# Beju Creative client portal

The client side of the system: plain static files with no build step. It goes live at `https://bejucreative.digital/portal/`.
Clients sign up, ask for one free sample, buy a pack, send footage links, and get their Shorts here. They can approve
a Short or ask for changes. There are no founder screens in this bundle. Founders use the CRM in `../app/`.

| File | What it does |
|---|---|
| `index.html` | Page shell: header nav (desktop), tab bar (phones), toast, CSP, supabase-js (pinned + SRI) |
| `portal.css` | Styles. The tokens come from the live site's `base.css` (dark ground, olive + wine light, gold accent, white main button) |
| `portal.js` | Every screen, the hash router and all Supabase calls |
| `config.js` | Settings you can change without touching code (see below) |

## Deploy
Copy the whole `portal/` folder into the repo that serves bejucreative.digital, at `/portal/`. That repo is
BejuCreative.github.io (`main`). The beju-v2 repo is not the live site. The page uses `../favicon.ico` and
`../beju-mark-sm.png`. Both files exist at the root of the live site.

## Supabase settings this needs (founders do these; this bundle changes nothing)
1. **Auth → URL Configuration → Redirect URLs**: add `https://bejucreative.digital/portal/**`. Without it, the
   confirm-email, reset-password and Google links fall back to the Site URL.
2. **Email confirmation**: both modes work. When it is on, sign-up shows "Check your inbox". When it is off, the
   client goes straight to onboarding.
3. **Google**: set `google: true` only after the Google provider is enabled in Supabase Auth.
4. `supabase/portal1.sql` must be applied. It adds the profile columns, the `sample_requests` table and the
   change rules.

## config.js
| Key | Meaning |
|---|---|
| `supabaseUrl`, `supabaseAnonKey` | Public project URL + anon key. Row-level security protects the data. **Never put the service-role key here.** |
| `google` | `true` shows "Continue with Google" |
| `showPrices` | `false` hides prices and buy buttons. Each pack then says "Book a call to get pricing" |
| `callUrl` | "Book a call" link (custom plans, long-form) |
| `crmUrl` | "Founders' CRM" link. It shows on Account only when `profiles.is_admin = true` |
| `packs[]` | `id` (must match the Stripe link's `metadata.package`, which the webhook maps to credits), `name`, `videos`, `price`, `monthly`, `best`, `note`, `link` (must start with `https://buy.stripe.com/`) |
| `perks[]` | The shared line above the pack cards |

The Buy button opens `link?prefilled_email=<email>&client_reference_id=<user id>` in a new tab. The
`stripe-webhook` function turns the payment into a `purchases` row on that account.

## Routes
`#/signup` (default when signed out) · `#/login` · `#/forgot` · `#/reset` · onboarding (shown on every route until
`profiles.channel` is set) · `#/` home · `#/sample` · `#/packs` · `#/new` · `#/v/<video id>` · `#/account`

## When you change things
- **New Supabase project URL**: update `config.js` **and** `connect-src` in the CSP `<meta>` in `index.html`.
- **New supabase-js version**: update the script URL and its `integrity` hash. To get the hash, run
  `curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A`.
- **Cache**: after a deploy, bump `?v=` on the three local files in `index.html`.
- **Copy rules**: the brand is written "Beju Creative". Never mention AI, automation or tool names. The only promises
  allowed are "We deliver everything within 24 hours, usually faster" and "Unlimited changes until you're happy".
