# Data Schema — MyLumi

> Local-first. Everything lives in the browser; there is no account and no server copy.

## The core decision: key by *sleep episode*

A night check-in on Jan 5 and the morning check-in on Jan 6 describe **one sleep episode**. Entries are keyed by **`nightOf`** — the local date the night *began* — and hold both halves:

```
entries["2026-01-05"] = {
  nightOf: "2026-01-05",
  night:   { ... },   // filled Jan 5 evening: that day's symptoms + sleep intention
  morning: { ... },   // filled Jan 6 morning: wake data + Jan 6 morning state
}
```

**Why not key by calendar day?** Then `day["2026-01-06"].morning` would describe sleep that began in `day["2026-01-05"].night`, and every query would need an adjacent-key join. Off-by-one bugs forever.

**What this buys us:**
- Sleep duration is a pure function of *one* record (`deriveSleepDuration`).
- "Is the morning check-in due?" is a check on *yesterday's* record — one lookup.
- One record = one ML training row. Forecasting is "this episode → next episode."

**The one wart, stated honestly:** `morning.moodMorning` etc. are observations about the *following* calendar day. That's intentional — they're the outcome of that night's sleep. To plot them on a calendar, use `morningDateOf(nightOf)`.

**Partial episodes are first-class.** `{ night: {...}, morning: null }` is normal and valid. No field is ever faked to fill a gap.

## Day rollover: 4:00am, not midnight

```
currentNightOf(now):  local hour < 4  →  yesterday's date
                      otherwise       →  today's date
```

A patient checking in at 1:15am means "the night of yesterday." A midnight rollover would file it on the wrong day and break their streak — for exactly the insomnia the app exists to track. Everything (which entry is today, what's due, whether the streak survives) is a function of this one call.

## Storage keys

| Key | Contents |
|---|---|
| `mylumi.v1.data` | The whole record — one JSON blob (~40KB for a month) |
| `mylumi.v1.draft.night` | In-progress night check-in |
| `mylumi.v1.draft.morning` | In-progress morning check-in |
| `mylumi.v1.prefs` | Theme and other non-clinical UI prefs |

One blob because the dataset is tiny: one read, one write, atomic version bump, and export is `JSON.stringify(load())`. Drafts are separate keys so a draft write (which happens on every step) can never corrupt real data.

The shared `mylumi.` prefix is what makes "delete all my data" provably complete.

## Record shape

See [`src/lib/schema.js`](../frontend/src/lib/schema.js) for the authoritative structure. Notable fields:

- **`night.symptomBurden`** — the sum of the 9 PCSS items (0–54). Stored despite being derived: it's read by the dashboard, history, chart, and later the forecast, and computing it in six places is where inconsistency starts. One writer (`buildNightBlock`), migration-recomputable.
- **`morning.awakenings`** — a **string** (`"0" | "1" | "2" | "3+"`). Storing `3` would silently discard "or more" and lie to the model. Only `awakeningsToOrdinal` flattens it, and that loss is documented at the point it happens.
- **Times** (`plannedBedtime`, `wakeTime`) — wall-clock `"HH:mm"` strings, not instants. These are self-reports ("about half eleven"), not measurements; an instant would over-claim precision. `<input type="time">` returns exactly this format.
- **Sleep duration** — *not* stored. Derived from the pair, both of which live in the same record.

## Rules that protect the clinical record

**No backfilling, ever.** Check-in routes take no date parameter; the target night is always derived. Retrospective symptom recall is unreliable and would poison training data. A missed night stays missed.

**No silent overwrites.** `saveNightCheckIn`/`saveMorningCheckIn` refuse to replace an existing block without an explicit `overwrite` flag — a wrong device clock could otherwise point at a night already logged.

**A rescued night writes no data.** See below.

## Streaks

A `nightOf` counts when **both** halves are present. The streak is **derived on read** by walking backwards from `prevDay(currentNightOf)` — the stored `current`/`longest` are a cache, and the computed value always wins. No timers, no catch-up job; a user who disappears for a week gets a correct 0 automatically.

**Tonight is never counted as broken.** It can't be complete yet, so evaluation stops at last night. Otherwise every user would see a broken streak all evening.

### Rescue

One per calendar month, granted lazily on read (no cron). Redeemable **only for last night**, and only if the interrupted run was ≥ 2 — rescuing a 1-night streak wastes the allowance on nothing. Unused rescues don't roll over. Scoped to the *current* month, so rescuing Jan 31 on Feb 1 spends February's allowance (marginally generous, but explainable in one sentence).

**A rescue writes no entry data.** `rescueHistory` records it and history labels the night "Streak rescued — no data logged." The streak is a motivation feature and must never put invented scores into the clinical record.

## Failure modes handled

| Case | Behaviour |
|---|---|
| localStorage unavailable (private browsing, webviews) | Probe on boot; fall back to an in-memory store with the same interface. Persistent banner: entries won't survive the tab. Never white-screens. |
| Quota exceeded | `writeJSON` returns `{ok:false, reason:'quota'}`; the UI says so and keeps the draft. Journal fields capped at 5000 chars. |
| Corrupt / hand-edited JSON | Preserved under `mylumi.v1.data.corrupt.<timestamp>`, never deleted. App boots fresh with a recovery banner. |
| Multi-tab | `storage` event listener reloads state, so a stale tab can't clobber a check-in made in another. |
| Timezone travel | New zone recorded in `meta.timezoneChanges`; **historical entries keep their original local dates**. Re-deriving them would rewrite the clinical record. |
| DST transition | Wall-clock sleep maths is an hour out twice a year. `dstShiftMinutes(nightOf)` detects it and the UI says the duration may be off, rather than reporting a wrong number silently. |

## The ML feature contract

`toFeatureRow(entry, nextEntry, injuryDate)` in [`src/lib/derive.js`](../frontend/src/lib/derive.js) is the single chokepoint describing what would cross the wire to Render in Phase 3. It is deliberately readable and deliberately **excludes journal text** — free text is the most sensitive content in the app and will get its own explicit payload when NLP lands, never sent as a side effect of a numeric call.
