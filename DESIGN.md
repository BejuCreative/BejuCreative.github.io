# BEJÚ Creative — Design System: Glass & Gold

A dark, calm, precise interface: translucent glass over a deep olive-black canvas, with
gold treated as a physical metal rather than a flat yellow. The work (video) is the hero;
the UI recedes, and gold marks only what matters.

Implemented in **`/tokens.css`** (tokens + material primitives), **`/site.css`** (shared layout and
components), **`/site.js`** (shared behaviour) and **`/services.css`** (the long-form article
template). Every page loads the first three; page `<style>` blocks add page-only layout and
must use these tokens — never raw hex.

## References used

From [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md):

| File | What we took |
|---|---|
| `design-md/apple/DESIGN.md` | System font stack (SF Pro via `system-ui`), weight ladder 400/600/700 (no 500), negative display tracking, 17px body, pill-shaped primary action, frosted-glass nav (`saturate(180%) blur(20px)` baseline), press state as a scale-down, 44px minimum touch targets, low-density generous whitespace, radius grammar (8 / 18 / pill). |
| `design-md/raycast/DESIGN.md` | Dark-mode surface ladder, hairline borders instead of heavy shadows, off-white ink over near-black, a stepped text-contrast ladder, and semantic accent colours kept separate from the brand accent. Its "keycap gradient" informed the restrained inset shading on gold. |

Deliberate departures from Apple: Apple is light-first and gradient-free. We are dark-first
(the brand mark is deep olive), and our one gradient family is the **gold metal**, used as a
material, not as decoration.

## Colour

### Canvas & surfaces
| Token | Value | Use |
|---|---|---|
| `--canvas` | `#090B07` | Page background (near-black with the brand's olive cast) |
| `--canvas-2` | `#0D1009` | Footer, recessed bands |
| `--surface` | `#12150E` | Solid cards (and the glass fallback) |
| `--surface-2` | `#181C13` | Raised solid surface, hover |
| `--hairline` | `rgba(255,255,255,.08)` | Default 1px border |
| `--hairline-strong` | `rgba(255,255,255,.14)` | Borders on hover/focus, dividers that must read |

Ambient light behind glass: two soft fixed radial glows (olive top-left, warm gold top-right)
so blur has something to refract. Never busy, never animated.

### Text (contrast ladder, WCAG ratios measured)
"Worst" = the lightest point any text can sit on: a glass card over the olive ambient glow.

| Token | Value | On canvas | Worst | Use |
|---|---|---|---|---|
| `--ink` | `#F5F5F7` | 18.2:1 | 13.4:1 | Headlines, strong text |
| `--body` | `#C5C8BD` | 11.6:1 | 8.6:1 | Paragraphs |
| `--muted` | `#9A9E91` | 7.2:1 | 5.3:1 | Secondary copy, captions |
| `--dim` | `#868A7E` | 5.6:1 | 4.5:1 (on glow) | Fine print on the plain canvas only, **never on cards** |

### Gold — a material, not a colour
Built from three light zones like polished metal: bronze shadow → gold midtone → champagne highlight.

| Token | Value | Role |
|---|---|---|
| `--gold-bronze` | `#8A6424` | Shadow side, lower edge |
| `--gold-deep` | `#A9823A` | Lower midtone |
| `--gold` | `#C7A24B` | Midtone (body of the metal) |
| `--gold-bright` | `#E2C676` | Upper midtone |
| `--gold-champagne` | `#F4E3AF` | Highlight, top edge light |
| `--gold-solid` | `#D8B865` | **Solid gold for small text/icons** (10.3:1 on canvas, 7.6:1 worst) |
| `--on-gold` | `#1F1708` | Text on gold metal (7.3–10.6:1 across the band the label sits on) |

- `--gold-metal` — vertical gradient champagne → bright → midtone → deep → bronze, plus a soft
  specular highlight layer. Used for primary buttons, badges and the check marks.
- `--gold-text` — the same ramp for **large** gold type only (prices, stats, one hero word).
- `--gold-ring` — angled gradient for 1px gold hairline borders on selected panels.
- Edges: a 1px champagne inset highlight on top, a bronze inset on the bottom, and a thin
  bronze outline. That is what makes it read as metal and not as paint.
- **Reflective sweep**: a narrow champagne band crosses the surface once on hover/focus
  (`--dur-3` 800ms, `--ease-in-out`). Resting state is static. No looping shimmer, no glitter, no outer glow beyond a
  soft warm drop.

### Semantic (never gold)
`--success #4FD18B` · `--warning #F59E0B` · `--error #FF5F57` · `--info #5AC8FA`.
Warning is deliberately orange, not yellow, so it can't be mistaken for the brand gold.

## Glass

| Token | Value |
|---|---|
| `--glass-fill` | `rgba(24,28,19,.58)` — panels |
| `--glass-fill-strong` | `rgba(16,19,12,.78)` — nav, sheets, anything text-dense |
| `--glass-blur` | `saturate(165%) blur(22px)` |
| `--glass-edge` | 1px `--hairline` + inset top highlight `rgba(255,255,255,.07)` |
| `--shadow-float` | `0 1px 0 rgba(0,0,0,.25), 0 24px 60px -28px rgba(0,0,0,.8)` |

Two forms of glass:
- **`.glass` (live blur)** only on surfaces that float over moving content: the nav, the
  mobile sheet, chips over video, carousel controls. Live blur is expensive to scroll; this
  site previously had to remove heavy blur for scroll performance (commit `e291af3`).
- **`.panel` (static glass)** for cards: the same translucent fill, top edge light, hairline
  and float shadow, without `backdrop-filter`. Over the calm canvas it reads identically.

Rules:
- Glass goes on **navigation, floating controls (chips, carousel buttons), and selected
  panels** (guarantee, featured price, stat and step cards). Long reading areas (mission,
  FAQ answers, terms) sit on the plain canvas.
- Text on glass uses `--ink`/`--body` only; the fills are dark enough to keep ≥ 7:1.
- **Fallback:** where `backdrop-filter` is unsupported, `.glass` becomes a solid `--surface`
  panel (same border and radius) via `@supports not`.

## Typography

Stack: `system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto,
"Helvetica Neue", Arial, sans-serif`. SF Pro on Apple devices, the native UI face elsewhere,
**no web-font download**.

| Token | Size | Weight | Tracking | Line |
|---|---|---|---|---|
| `--t-hero` | `clamp(3.2rem, 8.2vw, 6.6rem)` | 700 | -0.045em | 0.98 |
| `--t-h2` | `clamp(2.2rem, 4.6vw, 3.7rem)` | 700 | -0.035em | 1.04 |
| `--t-h3` | `1.2rem` | 600 | -0.015em | 1.25 |
| `--t-lead` | `clamp(1.12rem, 1.5vw, 1.32rem)` | 400 | -0.01em | 1.5 |
| `--t-body` | `1.0625rem` (17px) | 400 | -0.01em | 1.6 |
| `--t-caption` | `0.875rem` | 400 | -0.005em | 1.5 |
| `--t-label` | `0.75rem` | 600 | +0.12em, uppercase | 1 |

Headlines are sentence case (Apple), not uppercase. `.grad` headlines carry a faint
white-to-silver sheen, like brushed metal, and stay above 12:1 contrast.

## Space, radius, depth

- Spacing base 4px: `--s-1 4` · `--s-2 8` · `--s-3 12` · `--s-4 16` · `--s-5 24` · `--s-6 32` ·
  `--s-7 48` · `--s-8 64`.
- **Section rhythm** — one scale, three steps: `--sec-s clamp(4rem,7.5vw,6rem)` ·
  `--sec-m clamp(5rem,10vw,8rem)` (default) · `--sec-l clamp(5rem,12.5vw,10rem)` (the one
  breathing moment, e.g. the mission line). Classes `.sec-s` / `.sec` / `.sec-l`.
- **Radius grammar: 8 · 18 · pill** (+ one large): `--r-sm 8px` (inputs, small controls, focus
  rings) · `--r-lg 18px` (cards, media) · `--r-xl 28px` (feature panels, the nav capsule, the
  phone) · `--r-pill 999px` (buttons, chips). No other radii.
- Depth comes from glass layering and hairlines; shadows are soft and only on floating things.

## Layout

- **Container** `--container 74rem`, page gutter `--pad clamp(1.25rem,5vw,5rem)`:
  `.wrap{width:min(100% - 2 × --pad, --container)}`. Every section, the nav and the footer
  share this left edge.
- **12-column grid** `.g12`, gap `--gutter clamp(1rem,2vw,1.5rem)`. Section heads put the
  title in columns 1–5/1–7 and the intro in 7–12/8–12; below 900px everything stacks.
- Anchor targets clear the floating nav (`[id]{scroll-margin-top:96px}`); in-page links are
  scrolled by site.js (see Motion).

## Components (site.css unless noted)

- **Primary button** `.btn-gold`: gold metal pill, `--on-gold` text, 15px/600, min-height 48px
  (`.btn-sm` 44px). Hover: slightly brighter + one reflective sweep. Pressed: `scale .97` +
  inner bronze shading. Focus: 2px champagne ring, 3px offset. One per view.
- **Secondary** `.btn-glass`: glass pill, `--ink` text, hairline border; hover lifts the fill.
  **Text link** `.arrow-link` (gold, 44px target, arrow nudges 3px) and `.link` (underlined —
  links in copy are always underlined, never colour-only).
- **Disabled**: 45% opacity, no sweep. **Loading** (`aria-busy="true"`): label hidden, centred
  spinner, not clickable.
- **Nav** `.nav`: floating glass capsule (live blur), 64px (58px on phones), logo + 3–4 links +
  one CTA. Gets `.is-strong` after 40px of scroll and `.is-hidden` while scrolling down past
  160px; returns on scroll up. **Mobile sheet** `.sheet`: full-screen glass, 56px rows, focus
  trapped (Tab cycles inside, Esc closes and returns focus to the burger).
- **Type helpers**: `.display` (t-h2 headline), `.grad` (silver sheen), `.kicker` (gold label
  with a rule that stays on the first line when it wraps), `.lede`, `.body` (≤ 62ch), `.caption`.
- **Cards** `.card.panel`: static glass, `--r-lg`, hairline, 22–30px padding. Selected panels
  (featured tier, guarantee, closing CTA) add `.gold-ring`. Card grids use explicit column
  counts per breakpoint, never `auto-fit`, so rows never break 2 + 1.
- **Media** `.frame`: `--r-lg`, black fill, inset hairline, exact shape from `style="--ar:W/H"`.
  Labels are `.chip`s (65% dark glass, ≥ 5.6:1 over white); `.watch` is the play badge.
  `.playable` frames are `<button>`s that lift 3px on hover.
- **Video**: every file goes through `scripts/optimize-video.sh` (faststart, poster, ~2–3 MB).
  Inline clips are `muted loop playsinline preload="none" data-inview` — they play only while
  ≥ 50% on screen and pause off-screen (`data-start` seeks past a slow intro). Clicking opens
  the **lightbox** with sound.
- **Lightbox**: native `<dialog class="lb">` built by site.js from `[data-lb="group"]` items
  (`data-src`, `data-poster`, `data-title`): focus trap and Esc for free, ←/→ and swipe step
  through the group, backdrop click closes, focus returns to the clip that opened it.
- **Work rail** `[data-rail]`: native scroll-snap for touch/trackpad, mouse drag with momentum,
  44px circular glass prev/next buttons that disable at the ends. The clip list is **static
  HTML** (no file probing, so no 404s) — to add a clip, see `work/README.txt`.
- **Launch gallery** `.launch-feature` + `.launch-two`: one wide 16:9 feature, then a two-up
  whose frames share one height (`--grow` = each clip's W/H). Stacks below 900px.
- **Pricing toggle** `[data-toggle]` (homepage): `role="tab"` buttons (←/→ keys) crossfade
  panes that share one grid cell, so switching never shifts the layout.
- **FAQ** `.acc`: `<details>/<summary>`; site.js animates the height (400ms open / 320ms close),
  the + icon rotates 45°. Answers stay in the DOM for search and find-in-page.
- **Form** `#start-form` (homepage): name, email, need, link, message → Google Form via
  `fetch(no-cors)`. Inline errors on blur/submit, `aria-invalid`, success message, and on
  failure the typed answers stay put with a pre-filled e-mail fallback. `a[data-need]`
  preselects the "need" select.
- **Footer** `.foot`: brand + Services / Studio / Contact columns, © and terms. Same on every page.

## Page templates

- **Homepage** (`index.html`): hero → work → launches → services → how → why → guarantee →
  pricing → proof → mission → FAQ → apply. Section heads read as the story on their own.
- **Article template** (`services.css`) for the service pages, `/saas-launch-videos/`, terms,
  welcome and the 404: split hero `.svc-hero` (title 1–7, intro + actions 8–12), then
  `.svc-sec` rows — heading (or `.svc-head` = kicker + heading) sticky in columns 1–5, reading
  column in 7–12 at ≤ 62ch; `.wide` rows span the container (galleries, card grids);
  `.offer` gets a gold hairline; one closing `.svc-cta` gold-ring panel. Long copy stays on the
  canvas, never on glass.

## Motion

- Tokens: `--ease-out cubic-bezier(.16,1,.3,1)` (almost everything), `--ease-in-out
  cubic-bezier(.65,0,.35,1)` (the sweep, closing things). Durations `--dur-1 180ms` (hover,
  press, colour) · `--dur-2 400ms` (menus, accordions, toggles, nav) · `--dur-3 800ms`
  (reveals, the gold sweep). Nothing bounces, nothing loops forever.
- Animate `transform` and `opacity` only.
- **Nothing already on screen at load animates**: the hero renders instantly (no waiting on
  GSAP). Below the fold, `.rv` elements rise 16px and fade in once (55ms stagger, max 6);
  `[data-lr]` headings reveal line by line and restore their real markup afterwards.
- **In-page anchors** go through GSAP ScrollToPlugin (0.9s, `power3.inOut`), measured from
  layout position so a section that hasn't revealed yet still lands exactly. **Never** CSS
  `scroll-behavior:smooth` — it fought ScrollTrigger refreshes and made nav links stall.
- Magnetic pull on the primary CTA only: desktop, ≤ 6px, eases back, no bounce.
- Hero media drifts up ≤ 48px and scales ≤ 1.05 as the hero scrolls out.
- Stat count-ups run once in view (expo-out, 1.4s); the HTML already holds the final number.
- `prefers-reduced-motion`: no reveals, sweep, parallax, magnetic pull, count-ups or
  animated scrolling; every state change is instant and the page still looks finished.

## Do / Don't

- **Do** use gold for one primary action per view, prices, headline stats and the guarantee.
- **Do** keep small gold text in `--gold-solid`, never the gradient.
- **Don't** use gold for body text, errors, warnings or decoration.
- **Don't** stack glass on glass more than one level deep, or put long paragraphs on glass.
- **Don't** add new hex values in page files; add a token here first.
- **Don't** add a radius, duration or easing outside the tokens above.
- **Don't** put live `backdrop-filter` on cards — only the nav, sheets/modals, chips over
  video and carousel buttons.
