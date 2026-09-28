# BEJÚ Creative — Design System: Glass & Gold

A dark, calm, precise interface: translucent glass over a deep olive-black canvas, with
gold treated as a physical metal rather than a flat yellow. The work (video) is the hero;
the UI recedes, and gold marks only what matters.

Implemented in **`/tokens.css`** (shared by every page). Page files add layout only and
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
  (`.7s`). Resting state is static. No looping shimmer, no glitter, no outer glow beyond a
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
  `--s-7 48` · `--s-8 64` · section padding `clamp(5.5rem, 10vw, 9rem)`.
- Radii: `--r-sm 10px` (small controls) · `--r-md 14px` (chips, inputs) · `--r-lg 20px`
  (cards, media) · `--r-xl 28px` (feature panels, phone) · `--r-pill 999px` (buttons).
- Depth comes from glass layering and hairlines; shadows are soft and only on floating things.

## Components

- **Primary button** (`.btn.solid`, `.btn-gold`, `.button`): gold metal pill, `--on-gold` text,
  15px/600, min-height 48px. Hover: slightly brighter + one reflective sweep. Pressed:
  `scale .97` + inner bronze shading. Focus: 2px champagne ring, 3px offset.
- **Secondary** (`.btn`, `.btn.ghost`, `.btn-glass`): glass pill, `--ink` text, hairline border;
  hover lifts the fill and border.
- **Disabled**: 45% opacity, no sweep, `cursor: not-allowed`. **Loading** (`aria-busy="true"`):
  label hidden, centred spinner in the text colour, not clickable.
- **Nav**: floating glass capsule, 64px, inset from the edges; glass mobile sheet.
- **Cards** (steps, services, stats, tiers): glass, `--r-lg`, 1px hairline, 24–32px padding.
  Featured tier and the guarantee add a 1px `--gold-ring`.
- **Media** (work rail, results): `--r-lg`, labels as small glass chips over the video. Chip fill is 65% dark so its label keeps ≥ 5.6:1 even over a pure-white frame.
- **Carousel controls**: 44px circular glass buttons.

## Motion

- Durations `--d-fast 160ms`, `--d-base 240ms`, `--d-sweep 700ms`; easing
  `cubic-bezier(.22,1,.36,1)`.
- `prefers-reduced-motion`: no sweep, no scale, no smooth scroll; states change instantly.

## Do / Don't

- **Do** use gold for one primary action per view, prices, headline stats and the guarantee.
- **Do** keep small gold text in `--gold-solid`, never the gradient.
- **Don't** use gold for body text, errors, warnings or decoration.
- **Don't** stack glass on glass more than one level deep, or put long paragraphs on glass.
- **Don't** add new hex values in page files; add a token here first.
