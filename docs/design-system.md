# Design System - MyLumi

> Source of truth for colour, type, and UI conventions. Keep every screen consistent with this. Update this file when a token changes - never hardcode a one-off.

## Direction

**Sleek and modern.** Dark purple + magenta. Not corporate-blue, not wellness-pastel. Generous whitespace, few elements per screen, one clear action at a time, minimal animation, no flashing. This is also a *clinical* decision - users have light sensitivity and cognitive fatigue.

**Dark mode is the primary experience**, light mode fully supported. Both must be finished.

## Colour

Defined as CSS custom properties on `:root`. Dark-first - light mode overrides.

### Brand
| Token | Value | Use |
|---|---|---|
| `--brand-purple` | `#4C1D95` | primary dark purple |
| `--brand-purple-deep` | `#2E1065` | deepest purple, dark-mode surfaces |
| `--brand-magenta` | `#D6249F` | accent, CTAs, highlights |
| `--brand-magenta-soft` | `#E85DB8` | hover/active on magenta |
| `--brand-gradient` | `linear-gradient(135deg, #4C1D95 0%, #D6249F 100%)` | hero / Lumi / celebration moments only - used sparingly |

### Dark theme (default `:root`)
| Token | Value |
|---|---|
| `--bg` | `#140A2E` |
| `--surface` | `#1E1240` |
| `--surface-raised` | `#2A1A56` |
| `--border` | `#3B2A6B` |
| `--text` | `#F4F1FB` |
| `--text-muted` | `#B9AED6` |
| `--accent` | `var(--brand-magenta)` |
| `--focus-ring` | `#E85DB8` |

### Light theme (`[data-theme="light"]`, `@media (prefers-color-scheme: light)` fallback)
| Token | Value |
|---|---|
| `--bg` | `#FAF8FF` |
| `--surface` | `#FFFFFF` |
| `--surface-raised` | `#F3EEFF` |
| `--border` | `#E4DBF7` |
| `--text` | `#1A1033` |
| `--text-muted` | `#5B4D80` |
| `--accent` | `#B01C82` (magenta darkened for AA on white) |

### Semantic (both themes - tune per theme as needed)
| Token | Meaning | Dark | Light |
|---|---|---|---|
| `--positive` | improvement / good sleep | `#4ADE80` | `#15803D` |
| `--caution` | mild concern | `#FBBF24` | `#B45309` |
| `--alert` | red-flag / setback banner | `#FB7185` | `#BE123C` |
| `--info` | neutral insight | `#818CF8` | `#4F46E5` |

Symptom severity scale (0-6) uses a purple→magenta→red ramp; define as `--sev-0 … --sev-6` when the chart work starts.

## Typography

**Display / headings:** `League Spartan` (Google Fonts), weights 500/600/700. Tight, geometric, modern. Use for h1-h3, streak numbers, big stat values.

**Body / UI:** `Inter` (Google Fonts), weights 400/500/600. Highly readable at small sizes, pairs cleanly with League Spartan.

Fallback stack: `"League Spartan", "Inter", system-ui, -apple-system, sans-serif` for display; `"Inter", system-ui, -apple-system, sans-serif` for body.

### Scale (rem, 16px base)
| Token | Size | Line height | Use |
|---|---|---|---|
| `--fs-display` | 2.75 | 1.05 | screen hero, streak count |
| `--fs-h1` | 2.0 | 1.15 | page title |
| `--fs-h2` | 1.5 | 1.2 | section |
| `--fs-h3` | 1.2 | 1.3 | card title |
| `--fs-body` | 1.0 | 1.6 | default |
| `--fs-sm` | 0.875 | 1.5 | meta, captions |
| `--fs-xs` | 0.75 | 1.4 | disclaimers, labels |

Headings: League Spartan, `letter-spacing: -0.01em`. Body: Inter, default tracking. Large readable type throughout - never go below `--fs-xs` for real content.

## Spacing & shape

- Spacing scale (px): `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64` → tokens `--space-1 … --space-8`.
- Radius: `--radius-sm 8px`, `--radius-md 14px`, `--radius-lg 22px`, `--radius-full 999px`. Cards use `--radius-lg`.
- Shadows: soft, low-contrast, purple-tinted. `--shadow-card: 0 4px 24px rgba(20, 10, 46, 0.35)` (dark) / `0 4px 20px rgba(76, 29, 149, 0.10)` (light).
- Max content width: `--content-max: 560px` (single-column, focused), `860px` for the dashboard and history, `--content-wide: 1080px` for the grid pages (About, Insights). `AppShell` picks the track from the route, so a page does not reach up through context to set its own width.

## Layout

- **Grid utilities:** `.grid` with `.grid--2`, `.grid--3`, `.grid--auto` (`auto-fit, minmax(260px, 1fr)`). All are **one column by default** and widen at `640px` / `900px`, so a narrow viewport never depends on a media query firing to be readable. `.grid__span` opts one child back out to full width - use it for charts and lists that need the whole measure. `.grid--even` makes the cards in a row match the tallest instead of each sizing to its own content: the default `align-items: start` is right when a short card happens to sit beside a tall one, but two cards that read as a **pair** look broken when their bottom edges do not line up.
- **Nothing scrolls the page sideways.** Charts are `width: 100%` with a `viewBox`, so they scale into whatever column they land in.

## Background and surfaces

- **The page ground is flat `--bg`**, with texture supplied by the scattered Lumi marks of `.lumi-splatter` rather than by a gradient. See "Lumi as decoration" below.
- `--bg-mesh`: reduced to a single very faint radial light source over the flat `--bg`, fixed to the viewport so scrolling moves content across the light rather than dragging it along. It exists only to stop a large display banding across a perfectly uniform fill - it is no longer the thing that gives a page its character. Defined per theme - the dark alpha reads as bruising on a near-white ground, so the light theme has its own much lower value. **Defined in three places in `tokens.css`** (dark `:root`, explicit light, system light); change all three together or the themes drift.
- `--surface-glass`: cards let a little of the mesh through (`color-mix` + `backdrop-filter`) instead of stamping a solid rectangle over the gradient.
- **Card variants:** `card--feature` (roomier, clips decoration), `card--accent` (a masked gradient hairline marking the one card on a page worth looking at first), `card--flush`, `card--quiet`. `variant` accepts an array, so a card can be both feature and accent without nesting two `<section>`s for a purely visual reason.
- Use `--glow-accent` on hero art only. It is a light source, not a hover state.

## Motion

- Durations: `--dur-fast 120ms`, `--dur 200ms`, `--dur-slow 320ms`. Easing: `cubic-bezier(0.4, 0, 0.2, 1)`.
- Respect `prefers-reduced-motion` - drop to opacity-only or none. The global rule in `base.css` zeroes every animation and transition app-wide, which is **why motion here is plain CSS and not a library**: a JS animation would run straight through that switch and would need its own guard at every call site.
- No looping, no flashing, no parallax. Celebration moments may use one gentle scale/fade.

### The entrance vocabulary

One shape, used everywhere: opacity plus a small offset or a scale of 2% or less, over `--dur` or `--dur-slow`, then **stillness**. `@keyframes rise-in` (translate) and `milestone-in` (scale) are the only two; do not add a third.

What animates:

- **Sections** entering a page - staggered 40ms per child, capped at six so the last card does not arrive late enough to read as slowness. Route changes reuse this, since the routed subtree remounts.
- **Cards** - `.card--feature` only, lifting 2px on hover. Plain informational cards stay put: content shifting under the cursor is noise, not feedback.
- **Buttons** - 1px lift on hover, settling on `:active`.
- **Nav** - the active/hover underline grows from the centre.
- **Check-in steps** - **enter only, never exit.** `CheckInRunner` moves focus to the step region and announces "Step N of M" on each change, so an outgoing step animating out would announce the new question while the old one is still on screen. The keyed inner wrapper remounts; the focusable region around it does not.

What must never animate: **charts** (trajectory, sentiment sparkline, heat strip), anything looping or on scroll, and **numbers counting up** - a figure animating through values it was never measured at is the wrong idea in a record someone may show a clinician.

## Components - conventions

- **Buttons:** primary = magenta fill, white text, `--radius-full`, large tap target (min 48px height). Secondary = surface with border. One primary action per screen.
- **Links vs buttons.** A standalone navigation affordance sitting on its own in a card footer ("See all history") wears `.btn btn--secondary` - as a `<Link className="btn btn--secondary">`, so it keeps real anchor behaviour (middle-click, open in new tab) while looking like the control it is. `Button` itself always renders a `<button>` and has no `as`/`to` prop, so do not reach for it here. A link **inside a sentence** stays a link: a pill mid-prose reads as a glitch. Those get a tinted underline that comes up to full strength on hover (`base.css`).
- **Symptom slider:** 0-6, large thumb, value always visible, keyboard-operable, labelled ends.
- **Date and time fields:** `DatePicker` / `TimePicker` wrap the native `<input type="date">` / `type="time"`. Both emit exactly the format we store (`YYYY-MM-DD`, `HH:mm`), and both are already keyboard-operable, correctly announced, and a proper wheel picker on mobile - a hand-rolled calendar would have to re-earn all four. The branding goes as far as CSS reaches: the box, the focus ring, the picker glyph (recoloured with a `filter`), and the individual date parts as they are edited. **The dropdown calendar grid itself is drawn by the OS and cannot be themed** - `color-scheme` only makes it follow dark/light. Do not promise otherwise.
- **Cards:** `--surface`, `--radius-lg`, `--shadow-card`, `--space-5` padding.
- **Prediction card:** always shows the range, the point estimate inside it, and a plain-language "why". The range leads: the interval is the honest answer and the single number is a convenience inside it. There is no confidence pill any more - the interval carries the uncertainty, and it widens on its own when the model knows less. The under-7-nights refusal is unchanged and still enforced on both client and server.
- **Red-flag banner:** `--alert` for `prompt` severity (`role="alert"`), `--caution` for `discuss` (`role="status"`). Top of the shell, above the storage notices, visible on every screen including mid-check-in. Not a modal. **One banner only** - when several rules fire, the most severe shows and the rest are counted ("and 2 other things worth mentioning"); stacking alert banners is itself the alarm we're avoiding. Dismissible, but keyed to a signature of the firing condition, so it returns on the next check-in that keeps the condition true. Copy never says "warning", "danger", "setback" or "relapse", always states that the app can't tell whether something is serious, and always links to the full red-flag list at `/about#red-flags`.
- **Charts:** hand-rolled SVG, no chart library. `role="img"` with a generated `aria-label` describing start, end, direction and how many days weren't logged. Severity encoded by size **and** colour, never colour alone. Real `<title>` children rather than CSS tooltips, so values are reachable on touch. No animation, no gradient fills. Gaps in data are drawn as gaps - never interpolated.
- **Consent gate:** any feature that sends something new off the device is **off by default**, granted and revoked from the card that presents the feature itself (there is no separate settings page), with the off switch present on every state of that card including its empty and offline ones. The surface that offers it explains what would be sent in the copy the user is looking at, not behind a link. Never a modal, never pre-checked, and no "no thanks" dismissal - the off state *is* the prompt, and hiding it would remove the only way to change your mind. State plainly what revocation does and does not do; never imply data can be recalled once sent.
- **Secondary signals** (journal tone) must not look as authoritative as primary ones. Smaller chart, no gridlines or axis labels, placed *below* the sentence that states the finding, and always carrying its own caveat. The sentence is the finding; the chart is texture.
- **Milestones:** celebrate what the *data* now enables ("your model is personalised"), never that the person is improving - recovery is not monotonic, and congratulating improvement sets the next ordinary week up to read as failure. One gentle scale/fade on entry, then stillness. No confetti: these users have photophobia.
- **Stat:** one labelled figure (`components/ui/Stat.jsx`), shared by the last-night summary, weekly summary and daily report. Missing values take a hyphen placeholder, never a 0.
- **No caption layer.** Do not put explanatory small print under a chart or a card. A legend saying a taller bar means a heavier day restates what the bar already shows, and a caveat repeated on six screens stops being read. Limitations live on the About page instead - see `docs/responsible-ai.md`, "Where the caveats live". `--fs-xs` is for labels and data annotations only, **never for prose**: "none", "severe", "of 54" and a two-word chart key are fine; a sentence is not.

  This rule was written once, held, and then came back the moment three new cards were added - so it is enforced now. `npm run check:style` fails on prose at `--fs-xs`, and `npm run verify` runs it. If a card seems to need a sentence of explanation to make sense, the card is wrong; fix the card.

  Three things are exempt, and each carries a `{/* caption-ok: why */}` comment that the check reads:
  - **Safety copy** - the red-flag banner. It appears where it is relevant, never consolidated away.
  - **Screen-reader labels** - e.g. the baseline progress bar is `aria-hidden`, so its `role="status"` line is the only thing announcing it.
  - **Correctness notes about a specific number** - the daylight-saving warning flags one displayed duration as possibly wrong. That is not explaining the feature, it is qualifying a value.

  Provenance is not exempt, it is simply gone: sample sizes and correlation strengths ("Based on 19 nights - strength 0.60") no longer render, and neither does the confidence pill. The server still computes and returns all of it, and the refusal rules that decide whether a finding appears at all are untouched.
- **Focus:** visible `--focus-ring` outline on every interactive element. Never remove outlines without replacement.

## Accessibility floor

- Contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI, in both themes.
- Tap targets ≥ 44×44px (prefer 48).
- Everything keyboard-reachable; logical tab order.
- Motion honoured via `prefers-reduced-motion`.
- Never rely on colour alone - pair with text/icon (esp. symptom severity, semantic states).

## Fonts loading

Google Fonts via `<link>` in `index.html`:
`League Spartan` (500,600,700) + `Inter` (400,500,600). `display=swap`. Self-host later if time allows.

## The Lumi mascot

Source of truth: `frontend/src/components/lumi/Lumi.jsx`. One file, one public
API: `<Lumi state size title />`.

### Structure

One **molten-core pebble** body, reused unchanged in every pose: a warm radial
halo, the gradient body with two drip tails at its base, a magma overlay giving
it an internal light source, and a droplet that has just fallen. Only the face
group swaps between states.

Where a state needs more than a face it gets **one accent mark outside the
silhouette**, drawn in magenta so it holds on both the dark and light themes.
Accents are dropped below 40px (`ACCENT_MIN_SIZE`): at topbar scale they turn to
mud, and the face alone still carries the state.

Gradient ids are per-instance via `useId()`. This is not cosmetic: several Lumis
mount at once (the dashboard renders two), and ids derived from the state name
collide, leaving the second instance referencing the first one's gradient.

### States

| State | Where it is used |
|---|---|
| `idle` | Default. Topbar, About, dashboard when a check-in is due |
| `encouraging` | Last step of a check-in, already-checked-in confirmation |
| `celebrating` | Both check-ins done for the day |
| `concerned` | A missed night, before the streak rescue is taken |
| `resting` | Night check-in steps |
| `waking` | Morning check-in steps, and the "nothing to log yet" state |
| `reading` | The journal step specifically |
| `waving` | Onboarding welcome |
| `thinking` | Insights loading, including the cold-start wait |
| `presenting` | Insights page header, and as decoration behind chart cards |
| `empty` | Baseline progress, and the no-data states on the dashboard and history |
| `attentive` | The About page's "when to seek help" card, and the onboarding note about seeing a professional. Still deliberately unused in `RedFlagBanner` itself: a mascot beside an active safety alert softens it, which is the wrong direction for that one component |
| `proud` | Milestone reached |
| `cheering` | Streak rescued |
| `sleepy` | Available. Quiet end-of-day win |
| `lost` | 404 |
| `offline` | Model service unreachable. Dimmed body plus a slash |

`peeking` exists in the source design as a clipped variant for corners and empty
cards; it is not implemented, because nothing in the app currently needs it.

An unknown `state` falls back to `idle` rather than rendering blank.

### Lumi as decoration

`.lumi-deco` renders an oversized Lumi behind a card's content as texture, at
low opacity, clipped by the card's own corners (`.card--feature` sets
`overflow: hidden`). Rules:

- **Never load-bearing.** Decorative Lumis carry no `title`, so `Lumi` renders
  them `aria-hidden` with `role="presentation"`. Nothing is communicated by one
  that is not already in the text.
- **Never interactive.** `pointer-events: none`, so it cannot intercept a click
  meant for the card.
- **Behind content.** `.card > *:not(.lumi-deco)` lifts real content to
  `z-index: 1`, so text never sits on the busiest part of the art.
- **One per card.** Two is clutter, and at these sizes they overlap.
- Opacity drops under `prefers-reduced-motion` - decoration is the first thing
  to go when someone has asked for less.
- **Size it to the card.** The offsets are percentages of the card's own height,
  so a 190px mascot on a short, wide card bleeds almost entirely outside and
  reads as a clipped blob rather than as Lumi. The wide full-measure cards on
  Insights take ~140-150px; a tall narrow card can carry 190-200px.

### The page-wide splatter

`LumiSplatter.jsx`, mounted once in `AppShell`, is what replaced the three-radial
gradient as the thing that keeps a page from being a flat field of one colour.
Where `.lumi-deco` is one oversized mascot inside a single card, this is ~16
small ones across the whole viewport at `--splatter-opacity` (0.055 dark / 0.035
light), fixed so content scrolls across them.

- **Positions are a module constant, never `Math.random()`.** A random layout
  reshuffles on every re-render, so the background would crawl each time a
  check-in saved or the theme flipped - unbidden motion, for this audience.
- Same decorative contract as `.lumi-deco`: no `title` (so every mark is
  `aria-hidden`), `pointer-events: none`, behind everything at `z-index: 0`.
- Cards read over it correctly because they already carry `--surface-glass` plus
  a backdrop blur. `.card--quiet` is transparent, so check that one by eye.

### Lockups

- **Horizontal** (mark + wordmark, side by side) - the topbar. `AppShell.jsx`.
- **Stacked** - onboarding, splash, README.
- **Wordmark only**, with the mark as the tittle on the final `i` - not
  currently used in the app.

### Favicon

`frontend/public/lumi-mark.svg` is a second copy of the mark in the `idle`
state, with hardcoded hex because a favicon cannot read CSS custom properties.
**When the brand colours change, both files change.** Keep the geometry in step.
