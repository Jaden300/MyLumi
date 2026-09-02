/* Night check-in: 6 steps, ~2 minutes.

   Symptoms are split 3 per screen rather than shown as one list of nine. Nine
   sliders on one screen is a wall of input for someone with cognitive fatigue
   and light sensitivity — the split is a clinical decision, not decoration. */

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
    version: 1,
    title: 'Night check-in',
    steps: [
      symptomStep(1, SYMPTOM_KEYS.slice(0, 3)),
      symptomStep(2, SYMPTOM_KEYS.slice(3, 6)),
      symptomStep(3, SYMPTOM_KEYS.slice(6, 9)),
      {
        id: 'mood',
        label: 'Mood',
        component: 'MoodStep',
        validate: (values) => Number.isFinite(values.mood),
      },
      {
        // Journal is always optional — requiring writing on a bad day is exactly
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
      mood: null,
      journal: { day: '', factors: '' },
      sleep: { plannedBedtime: null, preSleepStress: null, sleepAidUsed: false },
    }),
    submit: (nightOf, values) => saveNight(nightOf, values),
  };
}
