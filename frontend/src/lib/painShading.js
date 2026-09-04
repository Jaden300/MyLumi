/* Turning a night's pain ratings into colours for the 3D body.

   Pure, and separate from the component for the reason PainBodyModel's header
   gives: jsdom has no WebGL, so anything decided inside that component cannot
   be tested. Everything decided here can.

   ## Why the timeline uses severity colours when picking does not

   The check-in body deliberately avoids severity colours. Shading a region red
   the moment a pointer touches it would be the app asserting something about a
   body part the user has only just pointed at, possibly to rate it a 1.

   The timeline is the opposite situation. Every colour it draws comes from a
   rating the user themselves gave, so the severity ramp is reporting their own
   data back to them rather than judging anything. Using the SAME ramp as
   PainSummaryCard and the history strip is what stops a 6.5 looking like one
   thing on the timeline and another in history.

   ## Not colour alone

   docs/design-system.md requires severity be encoded by more than hue, and the
   users of this app are frequently at minimum screen brightness with light
   sensitivity. So intensity also drives how far the region lifts away from the
   unlit body colour: a 1 is barely distinguishable from an unmarked region, a
   9 is at full strength. Someone who cannot separate the hues still sees which
   areas are loud. */

import { PAIN_MAX, PAIN_REGION_IDS } from './painRegions.js';
import { painSeverityLevel } from './severity.js';

/* The seven-step severity ramp, as hex, mirroring the --sev-0..--sev-6 custom
   properties in styles/tokens.css.

   Duplicated rather than read from CSS because three.js needs a colour value,
   not a var() reference, and getComputedStyle per region per frame during
   playback is a layout read in a render loop. The light-theme values are used:
   the canvas has its own lighting and sits on the card surface in both themes,
   so the ramp is picked for contrast against the body's violet rather than
   against the page.

   A test asserts this list stays the same length as the ramp painSeverityLevel
   maps onto, so the two cannot drift apart silently. */
export const SEVERITY_HEX = [
  '#15803d',
  '#4d7c0f',
  '#b45309',
  '#c2410c',
  '#dc2626',
  '#be123c',
  '#9f1239',
];

/** Hex for a 0-10 pain score, or null if there is no score. */
export function painHex(score) {
  const level = painSeverityLevel(score);
  return level === null ? null : SEVERITY_HEX[level];
}

/**
 * How strongly a region should be lifted from the base body colour, 0-1.
 *
 * Floored well above zero so that a region rated 0.5 is still visibly marked -
 * the user said it hurt, and a mark that fades to invisible would silently drop
 * a reported area off the body.
 */
export function painIntensity(score) {
  if (!Number.isFinite(score)) return 0;
  const fraction = Math.min(1, Math.max(0, score / PAIN_MAX));
  return 0.35 + 0.65 * fraction;
}

/**
 * One frame's region scores -> `{ regionId: { hex, intensity } }`.
 *
 * Unknown region ids are dropped rather than passed through. A hand-edited
 * export could otherwise put an arbitrary key in front of the renderer, and
 * the vocabulary is frozen precisely so that cannot happen - the same
 * discipline sanitizePain applies at the storage boundary.
 */
export function shadeFrame(regions) {
  const out = {};
  for (const [id, score] of Object.entries(regions ?? {})) {
    if (!PAIN_REGION_IDS.includes(id)) continue;
    const hex = painHex(score);
    if (hex === null) continue;
    out[id] = { hex, intensity: painIntensity(score) };
  }
  return out;
}
