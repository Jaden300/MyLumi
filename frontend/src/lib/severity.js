/* Burden -> severity level. One clinical mapping, one implementation.

   Shared by the heat strip and the trajectory chart. Two copies of this would
   drift, and the failure would be silent and hard to spot: the same night would
   render one colour on the dashboard and a different one on the insights page,
   with nothing to indicate which was right. */

import { MAX_SYMPTOM_BURDEN } from './constants.js';

/** 0-6, matching the --sev-0..--sev-6 ramp. */
export function severityLevel(burden) {
  if (!Number.isFinite(burden)) return null;
  return Math.min(6, Math.max(0, Math.floor((burden / MAX_SYMPTOM_BURDEN) * 7)));
}

export function severityToken(burden) {
  const level = severityLevel(burden);
  return level === null ? 'var(--border)' : `var(--sev-${level})`;
}
