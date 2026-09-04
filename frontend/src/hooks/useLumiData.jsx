/* The single source of app state. Components read and mutate through this -
   they never import storage.js or entries.js directly. */

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../lib/entries.js';
import { isStorageAvailable, KEYS } from '../lib/storage.js';
import { buildDemoData } from '../lib/demoSeed.js';

const LumiDataContext = createContext(null);

export function LumiDataProvider({ children }) {
  const [data, setData] = useState(() => api.reconcileTimezone(api.loadData()));
  const [storageError, setStorageError] = useState(null);
  // Both are fixed at mount: storage availability can't change mid-session, and
  // the recovery notice describes what happened during the initial load.
  const [recovery] = useState(() => api.getRecoveryNotice());
  const [storageAvailable] = useState(() => isStorageAvailable());

  /* Persist on every change. Wrapping this in one effect means no mutation path
     can forget to save. */
  useEffect(() => {
    const result = api.saveData(data);
    setStorageError(result.ok ? null : result.reason);
  }, [data]);

  /* Keep tabs in sync. Without this, a check-in completed in one tab is silently
     clobbered when a stale tab next writes. */
  useEffect(() => {
    function onStorage(event) {
      if (event.key !== KEYS.data || event.newValue == null) return;
      setData(api.loadData());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const now = useCallback(() => new Date(), []);

  const saveNight = useCallback((nightOf, values) => {
    let outcome = { ok: false, reason: 'unknown' };
    setData((current) => {
      const result = api.saveNightCheckIn(current, nightOf, values);
      outcome = result;
      return result.ok ? result.data : current;
    });
    return outcome;
  }, []);

  const saveMorning = useCallback((nightOf, values) => {
    let outcome = { ok: false, reason: 'unknown' };
    setData((current) => {
      const result = api.saveMorningCheckIn(current, nightOf, values);
      outcome = result;
      return result.ok ? result.data : current;
    });
    return outcome;
  }, []);

  const redeemRescue = useCallback((nightOf) => {
    let outcome = { ok: false, reason: 'unknown' };
    setData((current) => {
      const result = api.redeemRescue(current, nightOf);
      outcome = result;
      return result.ok ? result.data : current;
    });
    return outcome;
  }, []);

  const updateProfile = useCallback((patch) => {
    setData((current) => api.setProfile(current, patch));
  }, []);

  const deleteAll = useCallback(() => {
    setData(api.deleteAllData());
  }, []);

  /* Demo data replaces the whole record rather than merging into it. Merging
     would interleave fabricated entries with real ones and leave no way to tell
     them apart afterwards - `meta.isDemoData` is a property of the whole blob,
     not of individual entries, so a mixed record could not honestly carry it. */
  /* `options` reaches buildDemoData unchanged, which is how the longer run for
     the pain timeline is requested. One generator, two lengths - see the note
     on DEMO_LONG_NIGHTS in demoSeed.js for why this is not a second dataset. */
  const loadDemo = useCallback((options) => {
    setData(buildDemoData(new Date(), options));
  }, []);

  const value = useMemo(
    () => ({
      data,
      profile: data.profile,
      isOnboarded: api.isOnboarded(data),
      status: api.getCheckInStatus(data, now()),
      streak: api.getStreak(data, now()),
      daysSinceInjury: api.getDaysSinceInjury(data, now()),
      storageAvailable,
      storageError,
      recovery,
      isDemoData: data.meta?.isDemoData === true,
      getEntry: (nightOf) => api.getEntry(data, nightOf),
      getEntryRange: (start, end) => api.getEntryRange(data, start, end),
      getAllEntries: () => api.getAllEntries(data),
      exportJSON: () => api.exportJSON(data),
      saveNight,
      saveMorning,
      redeemRescue,
      updateProfile,
      deleteAll,
      loadDemo,
    }),
    [
      data,
      storageError,
      storageAvailable,
      recovery,
      now,
      saveNight,
      saveMorning,
      redeemRescue,
      updateProfile,
      deleteAll,
      loadDemo,
    ],
  );

  return <LumiDataContext.Provider value={value}>{children}</LumiDataContext.Provider>;
}

export function useLumiData() {
  const context = useContext(LumiDataContext);
  if (!context) throw new Error('useLumiData must be used inside <LumiDataProvider>');
  return context;
}
