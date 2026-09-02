/* Recovery milestones. Pure - no storage, no React.

   What a milestone is allowed to celebrate matters here. These mark points where
   MyLumi can genuinely do MORE - 7 nights is when the models will speak at all,
   14 is when the confidence tier rises, 21 is full confidence, 30 is a month of
   history. Every one is a fact about the data, not a judgement about the person.

   What is deliberately NOT a milestone: symptom burden falling, a "best week",
   or anything else framed as the user getting better. Recovery is not monotonic,
   and a celebration for improving sets up the next ordinary week to read as a
   failure - the same reason DailyReport refuses to say "you're doing well".

   Milestones are keyed to NIGHTS LOGGED, not to the current streak. A user who
   logged 30 nights, missed one, and is on a streak of 2 has still done the work
   and their model is still personalised. Tying the celebration to the streak
   would take it away from them for missing a single bad day - the exact thing
   streak rescue exists to avoid. */

export const MILESTONES = [
  {
    nights: 7,
    title: '7 nights logged',
    body: 'Enough for MyLumi to start looking for patterns in your own data. Your first forecast is now available.',
  },
  {
    nights: 14,
    title: '14 nights logged',
    body: 'Your model is getting more specific to you - MyLumi is no longer working from a handful of nights.',
  },
  {
    nights: 21,
    title: '21 nights logged',
    body: "Enough history for MyLumi's highest confidence tier. The patterns it finds are drawn from three weeks of your own data.",
  },
  {
    nights: 30,
    title: '30 nights logged',
    body: "A full month of recovery recorded. Whatever the numbers say, that's a month of showing up for a tedious thing twice a day.",
  },
];

/**
 * The highest milestone reached at this many complete nights, or null.
 *
 * Returns the milestone itself rather than a boolean so the caller never has to
 * hold its own copy of the thresholds.
 */
export function milestoneFor(completeNights) {
  if (!Number.isFinite(completeNights)) return null;
  let reached = null;
  for (const milestone of MILESTONES) {
    if (completeNights >= milestone.nights) reached = milestone;
  }
  return reached;
}

/**
 * The milestone that should be celebrated right now: the highest one reached,
 * unless it has already been acknowledged.
 *
 * Acknowledgement is by milestone COUNT rather than a boolean, so a user who
 * clears the 7-night card still sees the 14-night one later.
 */
export function pendingMilestone(completeNights, acknowledged = null) {
  const reached = milestoneFor(completeNights);
  if (!reached) return null;
  if (Number.isFinite(acknowledged) && acknowledged >= reached.nights) return null;
  return reached;
}

/** Nights remaining until the next milestone, or null past the last one. */
export function nextMilestone(completeNights) {
  if (!Number.isFinite(completeNights)) return null;
  const next = MILESTONES.find((m) => completeNights < m.nights);
  return next ? { ...next, remaining: next.nights - completeNights } : null;
}
