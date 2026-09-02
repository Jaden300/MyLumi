/* The milestone to celebrate right now, and the acknowledgement that dismisses it.

   Acknowledgement lives in `prefs`, not `data` - the same rule as red-flag
   dismissals and journal consent. "I have seen this card" is not a clinical
   observation and must not appear in an export handed to a clinician. */

import { useCallback, useState } from 'react';
import { loadPrefs, savePrefs } from '../lib/entries.js';
import { pendingMilestone } from '../lib/milestones.js';
import { isDayComplete } from '../lib/derive.js';
import { useLumiData } from './useLumiData.jsx';

export function useMilestone() {
  const { getAllEntries } = useLumiData();
  const [acknowledged, setAcknowledged] = useState(
    () => loadPrefs().milestoneAcknowledged ?? null,
  );

  /* Complete nights, not the streak - see the header comment in lib/milestones.js.
     A missed day must not withdraw a milestone the user already earned. */
  const completeNights = getAllEntries().filter(isDayComplete).length;
  const milestone = pendingMilestone(completeNights, acknowledged);

  /* Persisted outside the setState updater, for the reason documented in
     useRedFlags.js: React may run an updater more than once. */
  const acknowledge = useCallback(() => {
    if (!milestone) return;
    savePrefs({ ...loadPrefs(), milestoneAcknowledged: milestone.nights });
    setAcknowledged(milestone.nights);
  }, [milestone]);

  return { milestone, completeNights, acknowledge };
}
