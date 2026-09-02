/* Red-flag findings, plus the dismissal state that decides whether to show one.

   Dismissals live in `prefs`, NOT in `data`. `data` is the clinical record and it
   is also the export payload - a user who dismissed a banner should not find that
   fact in the JSON they hand to a clinician, and it should not travel through
   `normalizeData` alongside real observations. `prefs` already exists for exactly
   this class of thing (the theme lives there) and is outside the export.

   A dismissal is stored against the finding's SIGNATURE rather than its id, so it
   lapses the moment a new check-in arrives that keeps the condition true. That is
   how "dismissible, but reappears while the condition holds" works here: no timer,
   no scheduled job, and no way to silence a rule permanently. */

import { useCallback, useMemo, useState } from 'react';
import { loadPrefs, savePrefs } from '../lib/entries.js';
import { evaluateRedFlags } from '../lib/redFlags.js';
import { useLumiData } from './useLumiData.jsx';
import { toLocalISODate, prevDay } from '../lib/dates.js';

/* The rules look back 21 days; fetching a little more costs nothing and keeps
   the window logic entirely inside redFlags.js. */
const RANGE_DAYS = 30;

export function useRedFlags() {
  const { getEntryRange, daysSinceInjury } = useLumiData();
  const [dismissals, setDismissals] = useState(() => loadPrefs().redFlagDismissals ?? {});

  const today = toLocalISODate(new Date());
  let start = today;
  for (let i = 0; i < RANGE_DAYS; i += 1) start = prevDay(start);
  const entries = getEntryRange(start, today);

  const { rules } = useMemo(
    () => evaluateRedFlags(entries, { now: new Date(), daysSinceInjury }),
    // Entries is a fresh array each render; its content is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries.map((e) => `${e.nightOf}:${e.night ? 1 : 0}`).join(','), daysSinceInjury],
  );

  const visible = rules.filter((rule) => dismissals[rule.id] !== rule.signature);

  /* Showing three alert banners at once IS the alarm the design system forbids,
     so one finding surfaces and the rest are counted. `evaluateRedFlags` already
     sorted by severity, so the first is the most serious. */
  const primary = visible[0] ?? null;
  const othersCount = Math.max(0, visible.length - 1);

  /* The write happens HERE, not inside a setState updater. React may call an
     updater more than once (and does, under StrictMode), so a side effect placed
     in one runs an unpredictable number of times - or, when React discards the
     render, not at all. That is exactly how an earlier version of this silently
     failed to persist anything. */
  const dismiss = useCallback(() => {
    if (!primary) return;
    const next = { ...dismissals, [primary.id]: primary.signature };

    /* Prune entries for rules that are no longer firing, so prefs cannot grow
       without bound as a user's patterns change over months. */
    const live = new Set(rules.map((r) => r.id));
    for (const id of Object.keys(next)) {
      if (!live.has(id)) delete next[id];
    }

    savePrefs({ ...loadPrefs(), redFlagDismissals: next });
    setDismissals(next);
  }, [primary, rules, dismissals]);

  return { finding: primary, othersCount, dismiss };
}
