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
- Max content width: `--content-max: 560px` (single-column, focused). Dashboards may go wider in a grid.

## Motion

- Durations: `--dur-fast 120ms`, `--dur 200ms`, `--dur-slow 320ms`. Easing: `cubic-bezier(0.4, 0, 0.2, 1)`.
- Respect `prefers-reduced-motion` - drop to opacity-only or none.
- No looping, no flashing, no parallax. Celebration moments may use one gentle scale/fade.

## Components - conventions

- **Buttons:** primary = magenta fill, white text, `--radius-full`, large tap target (min 48px height). Secondary = surface with border. One primary action per screen.
- **Symptom slider:** 0-6, large thumb, value always visible, keyboard-operable, labelled ends.
- **Cards:** `--surface`, `--radius-lg`, `--shadow-card`, `--space-5` padding.
- **Prediction card:** always shows value + confidence + plain-language "why". Low confidence says so explicitly.
- **Red-flag banner:** `--alert` for `prompt` severity (`role="alert"`), `--caution` for `discuss` (`role="status"`). Top of the shell, above the storage notices, visible on every screen including mid-check-in. Not a modal. **One banner only** - when several rules fire, the most severe shows and the rest are counted ("and 2 other things worth mentioning"); stacking alert banners is itself the alarm we're avoiding. Dismissible, but keyed to a signature of the firing condition, so it returns on the next check-in that keeps the condition true. Copy never says "warning", "danger", "setback" or "relapse", always states that the app can't tell whether something is serious, and always links to the full red-flag list at `/about#red-flags`.
- **Charts:** hand-rolled SVG, no chart library. `role="img"` with a generated `aria-label` describing start, end, direction and how many days weren't logged. Severity encoded by size **and** colour, never colour alone. Real `<title>` children rather than CSS tooltips, so values are reachable on touch. No animation, no gradient fills. Gaps in data are drawn as gaps - never interpolated.
- **Consent gate:** any feature that sends something new off the device is **off by default**, controlled from the Your Data page, and revocable there. The surface that offers it explains what would be sent in the copy the user is looking at, not behind a link. Never a modal, never pre-checked, and no "no thanks" dismissal - the off state *is* the prompt, and hiding it would remove the only way to change your mind. State plainly what revocation does and does not do; never imply data can be recalled once sent.
- **Secondary signals** (journal tone) must not look as authoritative as primary ones. Smaller chart, no gridlines or axis labels, placed *below* the sentence that states the finding, and always carrying its own caveat. The sentence is the finding; the chart is texture.
- **Milestones:** celebrate what the *data* now enables ("your model is personalised"), never that the person is improving - recovery is not monotonic, and congratulating improvement sets the next ordinary week up to read as failure. One gentle scale/fade on entry, then stillness. No confetti: these users have photophobia.
- **Stat:** one labelled figure (`components/ui/Stat.jsx`), shared by the last-night summary, weekly summary and daily report. Missing values take a hyphen placeholder, never a 0.
- **Disclaimer footer:** persistent, `--fs-xs`, `--text-muted`: "MyLumi is not a diagnostic tool."
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
| `presenting` | A finding, weekly summary |
| `empty` | Baseline progress, no data yet |
| `attentive` | Available for red-flag contexts. Deliberately unused in `RedFlagBanner`: a mascot beside a safety notice softens it, which is the wrong direction for that one component |
| `proud` | Milestone reached |
| `cheering` | Streak rescued |
| `sleepy` | Available. Quiet end-of-day win |
| `lost` | 404 |
| `offline` | Model service unreachable. Dimmed body plus a slash |

`peeking` exists in the source design as a clipped variant for corners and empty
cards; it is not implemented, because nothing in the app currently needs it.

An unknown `state` falls back to `idle` rather than rendering blank.

### Lockups

- **Horizontal** (mark + wordmark, side by side) - the topbar. `AppShell.jsx`.
- **Stacked** - onboarding, splash, README.
- **Wordmark only**, with the mark as the tittle on the final `i` - not
  currently used in the app.

### Favicon

`frontend/public/lumi-mark.svg` is a second copy of the mark in the `idle`
state, with hardcoded hex because a favicon cannot read CSS custom properties.
**When the brand colours change, both files change.** Keep the geometry in step.
