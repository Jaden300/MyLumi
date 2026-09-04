# MyLumi - frontend

React + Vite. See the [project README](../README.md) for what MyLumi is and how
the pieces fit together.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest - 608 tests
npm run build
```

Set `VITE_API_URL` to point at the inference API (see `.env.example`). Unset, the
app runs fully on local computation - only the model-backed insight cards go
quiet, and they say so.

## Layout

| Path | Contents |
|---|---|
| `src/lib/` | Pure functions - dates, storage, derived features, statistics. Fully tested. |
| `src/lib/derive.js` | **Numeric outbound chokepoint** (`toFeatureRow`) |
| `src/lib/journal.js` | **Text outbound chokepoint** (`buildJournalTexts`) + consent |
| `src/lib/api.js` | The only file that makes network calls |
| `src/lib/redFlags.js` | Safety rules. Imports no API client, no storage, no React. |
| `src/lib/painRegions.js` | The region vocabulary and the rig-bone tables that resolve a tap |
| `src/lib/painPicking.js` | Raycast hit -> body region. No three.js import, so it is testable in node. |
| `src/lib/painTrajectory.js` | Per-region trends and projections, on-device. Imports no API client. |
| `src/lib/agreement.js` | What someone wrote vs what they rated, joined on the device |
| `src/hooks/` | State: `useLumiData` (single source), check-in flow, insights, consent |
| `src/components/` | UI, grouped by area |
| `src/pages/` | One per route |
| `src/styles/` | `tokens.css` → `base.css` → `components.css`, in that order |

## Conventions

- Components read and mutate through `useLumiData` - they never import
  `storage.js` or `entries.js` directly.
- A missing answer is `null`, never `0`. `RatingScale` uses discrete buttons
  rather than a slider precisely so "unanswered" can stay empty.
- Non-clinical state (theme, dismissals, consent, milestone acknowledgement)
  lives in `prefs`, never in `data` - `data` is the clinical record and the
  export payload.
- Charts are hand-rolled SVG. Severity is encoded by size **and** colour, gaps
  are drawn as gaps, and values are reachable on touch.
