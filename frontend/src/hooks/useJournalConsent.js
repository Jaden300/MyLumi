/* Whether journal text may leave this device. Off unless explicitly turned on.

   A thin React wrapper over the two pure functions in lib/journal.js - the rule
   itself is tested there, without a React test environment.

   Consent lives in `prefs`, NOT in `data`, for the same reason red-flag
   dismissals do (see useRedFlags.js): `data` is the clinical record and it is
   also the export payload. A user who handed their export to a clinician should
   not find a record of their privacy settings in it. */

import { useCallback, useEffect, useState } from 'react';
import { loadPrefs, savePrefs } from '../lib/entries.js';
import { KEYS } from '../lib/storage.js';
import { readJournalConsent, writeJournalConsent } from '../lib/journal.js';

export function useJournalConsent() {
  const [state, setState] = useState(() => readJournalConsent(loadPrefs()));

  /* A second tab that granted consent before this one revoked it would otherwise
     keep its stale `true` in React state and carry on sending. Every other piece
     of prefs state in the app tolerates that drift; consent does not, because the
     failure mode is "the other tab kept sending your journal after you turned it
     off". useLumiData already listens on `storage` for the same class of reason. */
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== null && event.key !== KEYS.prefs) return;
      setState(readJournalConsent(loadPrefs()));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /* The write happens HERE, not inside a setState updater - the same rule
     documented at length in useRedFlags.js. React may run an updater more than
     once (and does, under StrictMode), so a persist side effect placed in one
     runs an unpredictable number of times. Consent is the last flag in this app
     that should persist unpredictably. */
  const setConsent = useCallback((granted) => {
    const next = writeJournalConsent(loadPrefs(), granted);
    savePrefs(next);
    setState(readJournalConsent(next));
  }, []);

  const grant = useCallback(() => setConsent(true), [setConsent]);
  const revoke = useCallback(() => setConsent(false), [setConsent]);

  return { ...state, grant, revoke, setConsent };
}
