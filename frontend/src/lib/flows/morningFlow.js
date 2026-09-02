/* Morning check-in: 3 steps, ~2 minutes.

   Shorter than the night flow by design — it runs when the user has just woken
   up, which is the worst moment to ask for sustained attention. */

export function createMorningFlow(saveMorning) {
  return {
    kind: 'morning',
    draftKey: 'morning',
    version: 1,
    title: 'Morning check-in',
    steps: [
      {
        id: 'wake',
        label: 'Waking',
        component: 'WakeStep',
        validate: (values) => Boolean(values.wakeTime) && Boolean(values.awakenings),
      },
      {
        id: 'quality',
        label: 'Sleep',
        component: 'SleepQualityStep',
        validate: (values) => Number.isFinite(values.sleepQuality),
      },
      {
        id: 'state',
        label: 'This morning',
        component: 'MorningStateStep',
        validate: (values) =>
          Number.isFinite(values.moodMorning) &&
          Number.isFinite(values.energy) &&
          Number.isFinite(values.readiness),
      },
    ],
    initialValues: () => ({
      wakeTime: null,
      awakenings: null,
      sleepQuality: null,
      dreamRecall: false,
      moodMorning: null,
      energy: null,
      readiness: null,
      journal: { wakeFeeling: '' },
    }),
    submit: (nightOf, values) => saveMorning(nightOf, values),
  };
}
