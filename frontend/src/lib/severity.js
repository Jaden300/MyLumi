/* Burden -> severity level. One clinical mapping, one implementation.

   Shared by the heat strip and the trajectory chart. Two copies of this would
   drift, and the failure would be silent and hard to spot: the same night would
   render one colour on the dashboard and a different one on the insights page,
   with nothing to indicate which was right. */

import { MAX_SYMPTOM_BURDEN } from './constants.js';
import { PAIN_MAX } from './painRegions.js';

/** 0-6, matching the --sev-0..--sev-6 ramp. */
export function severityLevel(burden) {
  if (!Number.isFinite(burden)) return null;
  return Math.min(6, Math.max(0, Math.floor((burden / MAX_SYMPTOM_BURDEN) * 7)));
}

export function severityToken(burden) {
  const level = severityLevel(burden);
  return level === null ? 'var(--border)' : `var(--sev-${level})`;
}

/* Pain ratings run 0-10 while the severity ramp has seven steps, so they need
   their own mapping onto it. Same shape as severityLevel, different domain -
   kept here rather than inlined at the call site for the reason in the header:
   a second copy would drift, and the same rating would then render one colour
   in history and another anywhere it was shown next. */
export function painSeverityLevel(score) {
  if (!Number.isFinite(score)) return null;
  return Math.min(6, Math.max(0, Math.floor((score / PAIN_MAX) * 7)));
}

export function painSeverityToken(score) {
  const level = painSeverityLevel(score);
  return level === null ? 'var(--border)' : `var(--sev-${level})`;
}
