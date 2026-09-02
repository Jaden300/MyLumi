# Design System — MyLumi

> Source of truth for colour, type, and UI conventions. Keep every screen consistent with this. Update this file when a token changes — never hardcode a one-off.

## Direction

**Sleek and modern.** Dark purple + magenta. Not corporate-blue, not wellness-pastel. Generous whitespace, few elements per screen, one clear action at a time, minimal animation, no flashing. This is also a *clinical* decision — users have light sensitivity and cognitive fatigue.

**Dark mode is the primary experience**, light mode fully supported. Both must be finished.

## Colour

Defined as CSS custom properties on `:root`. Dark-first — light mode overrides.

### Brand
| Token | Value | Use |
|---|---|---|
| `--brand-purple` | `#4C1D95` | primary dark purple |
| `--brand-purple-deep` | `#2E1065` | deepest purple, dark-mode surfaces |
| `--brand-magenta` | `#D6249F` | accent, CTAs, highlights |
| `--brand-magenta-soft` | `#E85DB8` | hover/active on magenta |
| `--brand-gradient` | `linear-gradient(135deg, #4C1D95 0%, #D6249F 100%)` | hero / Lumi / celebration moments only — used sparingly |

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

### Semantic (both themes — tune per theme as needed)
| Token | Meaning | Dark | Light |
|---|---|---|---|
| `--positive` | improvement / good sleep | `#4ADE80` | `#15803D` |
| `--caution` | mild concern | `#FBBF24` | `#B45309` |
| `--alert` | red-flag / setback banner | `#FB7185` | `#BE123C` |
| `--info` | neutral insight | `#818CF8` | `#4F46E5` |

Symptom severity scale (0–6) uses a purple→magenta→red ramp; define as `--sev-0 … --sev-6` when the chart work starts.

## Typography

**Display / headings:** `League Spartan` (Google Fonts), weights 500/600/700. Tight, geometric, modern. Use for h1–h3, streak numbers, big stat values.

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

Headings: League Spartan, `letter-spacing: -0.01em`. Body: Inter, default tracking. Large readable type throughout — never go below `--fs-xs` for real content.

## Spacing & shape

- Spacing scale (px): `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64` → tokens `--space-1 … --space-8`.
- Radius: `--radius-sm 8px`, `--radius-md 14px`, `--radius-lg 22px`, `--radius-full 999px`. Cards use `--radius-lg`.
- Shadows: soft, low-contrast, purple-tinted. `--shadow-card: 0 4px 24px rgba(20, 10, 46, 0.35)` (dark) / `0 4px 20px rgba(76, 29, 149, 0.10)` (light).
- Max content width: `--content-max: 560px` (single-column, focused). Dashboards may go wider in a grid.

## Motion

- Durations: `--dur-fast 120ms`, `--dur 200ms`, `--dur-slow 320ms`. Easing: `cubic-bezier(0.4, 0, 0.2, 1)`.
- Respect `prefers-reduced-motion` — drop to opacity-only or none.
- No looping, no flashing, no parallax. Celebration moments may use one gentle scale/fade.

## Components — conventions

- **Buttons:** primary = magenta fill, white text, `--radius-full`, large tap target (min 48px height). Secondary = surface with border. One primary action per screen.
- **Symptom slider:** 0–6, large thumb, value always visible, keyboard-operable, labelled ends.
- **Cards:** `--surface`, `--radius-lg`, `--shadow-card`, `--space-5` padding.
- **Prediction card:** always shows value + confidence + plain-language "why". Low confidence says so explicitly.
- **Red-flag banner:** `--alert`, top of screen, calm wording, not a modal, dismissible but reappears while condition holds.
- **Disclaimer footer:** persistent, `--fs-xs`, `--text-muted`: "MyLumi is not a diagnostic tool."
- **Focus:** visible `--focus-ring` outline on every interactive element. Never remove outlines without replacement.

## Accessibility floor

- Contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI, in both themes.
- Tap targets ≥ 44×44px (prefer 48).
- Everything keyboard-reachable; logical tab order.
- Motion honoured via `prefers-reduced-motion`.
- Never rely on colour alone — pair with text/icon (esp. symptom severity, semantic states).

## Fonts loading

Google Fonts via `<link>` in `index.html`:
`League Spartan` (500,600,700) + `Inter` (400,500,600). `display=swap`. Self-host later if time allows.
