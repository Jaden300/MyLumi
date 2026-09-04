/* Night check-in: 6 steps, ~2 minutes.

   Symptoms are split 3 per screen rather than shown as one list of nine. Nine
   sliders on one screen is a wall of input for someone with cognitive fatigue
   and light sensitivity - the split is a clinical decision, not decoration. */

import { SYMPTOM_KEYS } from '../constants.js';

const allAnswered = (values, keys) => keys.every((k) => Number.isFinite(values.symptoms?.[k]));

const symptomStep = (index, keys) => ({
  id: `symptoms-${index}`,
  label: 'Symptoms',
  component: 'SymptomStep',
  props: { keys, group: index },
  validate: (values) => allAnswered(values, keys),
});

export function createNightFlow(saveNight) {
  return {
    kind: 'night',
    draftKey: 'night',
    /* Bumped to 2 when the pain map step was inserted. A draft saved against
       the six-step flow stores a step index that means something different in
       the seven-step one, so the version guard discards it rather than
       restoring someone onto the wrong screen. Costs at most one in-flight
       check-in per user, once. */
    version: 2,
    title: 'Night check-in',
    steps: [
      symptomStep(1, SYMPTOM_KEYS.slice(0, 3)),
      symptomStep(2, SYMPTOM_KEYS.slice(3, 6)),
      symptomStep(3, SYMPTOM_KEYS.slice(6, 9)),
      {
        /* Directly after the symptom ratings: where it hurts is the same
           question as how much, asked spatially, and the two belong together
           before the flow moves on to mood and sleep.

           Complete means the user has said something, which is either marking
           somewhere or saying nothing hurts. An empty region map with no
           `answered` flag is an accidental Next, not an answer. */
        id: 'pain',
        label: 'Pain',
        component: 'PainMapStep',
        validate: (values) => values.pain?.answered === true,
      },
      {
        id: 'mood',
        label: 'Mood',
        component: 'MoodStep',
        validate: (values) => Number.isFinite(values.mood),
      },
      {
        // Journal is always optional - requiring writing on a bad day is exactly
        // when a user abandons the app.
        id: 'journal',
        label: 'Journal',
        component: 'JournalStep',
        validate: () => true,
      },
      {
        id: 'sleep',
        label: 'Sleep',
        component: 'SleepIntentStep',
        validate: (values) =>
          Boolean(values.sleep?.plannedBedtime) && Number.isFinite(values.sleep?.preSleepStress),
      },
    ],
    initialValues: () => ({
      symptoms: {},
      pain: { answered: false, regions: {} },
      mood: null,
      journal: { day: '', factors: '' },
      sleep: { plannedBedtime: null, preSleepStress: null, sleepAidUsed: false },
    }),
    submit: (nightOf, values) => saveNight(nightOf, values),
  };
}
