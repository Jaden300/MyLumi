/* Fetches insights for the current dataset.

   Builds feature rows through `toFeatureRow` - the documented chokepoint for
   what leaves the device - and calls the batched endpoint once. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchInsights, isConfigured } from '../lib/api.js';
import { toFeatureRow } from '../lib/derive.js';
import { useLumiData } from './useLumiData.jsx';

/** Sparse entries -> feature rows, each paired with the night that followed it.
 *
 * The pairing is what makes the forecast "this episode -> next episode". Only
 * genuinely adjacent nights are paired: if a user misses Tuesday, Monday's row
 * gets no target rather than being silently paired with Wednesday, which would
 * teach the model a two-day transition while labelling it a one-day one. */
export function buildRows(entries, injuryDate) {
  return entries.map((entry, index) => {
    const next = entries[index + 1] ?? null;
    const isAdjacent = next && daysApart(entry.nightOf, next.nightOf) === 1;
    return toFeatureRow(entry, isAdjacent ? next : null, injuryDate);
  }).filter(Boolean);
}

function daysApart(a, b) {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

export function useInsights() {
  const { getAllEntries, profile, daysSinceInjury } = useLumiData();
  const [state, setState] = useState({ loading: false, insights: null });

  const entries = getAllEntries();
  // Refetching on every render would hammer a cold service. The signature covers
  // what actually changes an answer: how many episodes exist and what the latest
  // one is (a completed morning check-in mutates the last entry in place).
  const signature = `${entries.length}:${entries.at(-1)?.nightOf ?? ''}:${
    entries.at(-1)?.morning ? 'm' : ''
  }${entries.at(-1)?.night ? 'n' : ''}`;
  const lastSignature = useRef(null);
  /* Monotonic request id. A cold start can take ~50s, which is long enough for
     the data to change (a check-in in another tab, a "Try again" click) and for
     a second request to overtake the first. Without this, whichever response
     landed LAST won - so a stale answer could overwrite a fresh one and be shown
     as current, which is exactly the "never silently-stale results" promise. */
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const rows = buildRows(entries, profile?.injuryDate ?? null);
    const id = (generation.current += 1);
    setState((s) => ({ ...s, loading: true }));
    const insights = await fetchInsights(rows, daysSinceInjury);
    // Ignore anything a newer request has already superseded, and anything that
    // arrives after this screen is gone.
    if (!mounted.current || id !== generation.current) return;
    setState({ loading: false, insights });
  }, [entries, profile?.injuryDate, daysSinceInjury]);

  useEffect(() => {
    if (!isConfigured()) {
      setState({ loading: false, insights: null });
      return;
    }
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    load();
    // `load` is intentionally excluded: it changes identity on every render
    // because `entries` is a fresh array each time. `signature` is the real
    // dependency - it changes exactly when the answer could change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return { ...state, configured: isConfigured(), reload: load };
}
