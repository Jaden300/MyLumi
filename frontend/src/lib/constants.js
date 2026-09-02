/* Clinical vocabulary and scales. See docs/data-schema.md */

export const ROLLOVER_HOUR = 4; // local hour a new "night" begins - see docs/data-schema.md

/* The 9 PCSS (Post-Concussion Symptom Scale) items we track, in check-in order.
   `clinical` is the medical term, `label` is what the user sees, `hint` explains
   the clinical term in plain language. Terminology is used accurately and always
   paired with an explanation - see docs/design-system.md. */
export const SYMPTOMS = [
  { key: 'headache', label: 'Headache', clinical: 'Cephalalgia', hint: 'Head pain of any kind.' },
  {
    key: 'photophobia',
    label: 'Light sensitivity',
    clinical: 'Photophobia',
    hint: 'Discomfort in bright light.',
  },
  {
    key: 'phonophobia',
    label: 'Noise sensitivity',
    clinical: 'Phonophobia',
    hint: 'Discomfort from ordinary sound levels.',
  },
  {
    key: 'brainFog',
    label: 'Brain fog',
    clinical: 'Mental clouding',
    hint: 'Feeling slowed down or not quite clear-headed.',
  },
  { key: 'nausea', label: 'Nausea', clinical: 'Nausea', hint: 'Feeling sick to your stomach.' },
  {
    key: 'dizziness',
    label: 'Dizziness',
    clinical: 'Vertigo / disequilibrium',
    hint: 'Feeling unsteady or like the room is moving.',
  },
  { key: 'fatigue', label: 'Fatigue', clinical: 'Fatigue', hint: 'Low energy or tiring easily.' },
  {
    key: 'moodDisturbance',
    label: 'Irritability or low mood',
    clinical: 'Mood disturbance',
    hint: 'Feeling more irritable, sad, or on edge than usual.',
  },
  {
    key: 'concentration',
    label: 'Trouble concentrating',
    clinical: 'Impaired concentration',
    hint: 'Difficulty holding attention on a task.',
  },
];

export const SYMPTOM_KEYS = SYMPTOMS.map((s) => s.key);

/* PCSS items are rated 0-6. Max aggregate burden is 9 * 6. */
export const SYMPTOM_MIN = 0;
export const SYMPTOM_MAX = 6;
export const MAX_SYMPTOM_BURDEN = SYMPTOM_KEYS.length * SYMPTOM_MAX;

/* Anchors shown at the ends of every 0-6 scale. */
export const SEVERITY_ANCHORS = { min: 'None', max: 'Severe' };

/* Generic 0-6 scales used in the morning check-in. */
export const RATING_MIN = 0;
export const RATING_MAX = 6;

export const SLEEP_QUALITY_ANCHORS = { min: 'Very poor', max: 'Excellent' };
export const MORNING_MOOD_ANCHORS = { min: 'Very low', max: 'Very good' };
export const ENERGY_ANCHORS = { min: 'Drained', max: 'Energised' };
export const READINESS_ANCHORS = { min: 'Not ready', max: 'Fully ready' };

/* Visual analog mood scale (night check-in) is 0-100 - finer grained than the
   0-6 items on purpose, matching how VAS mood measures are normally collected. */
export const MOOD_VAS_MIN = 0;
export const MOOD_VAS_MAX = 100;

/* Pre-sleep stress is 1-5. */
export const STRESS_MIN = 1;
export const STRESS_MAX = 5;
export const STRESS_ANCHORS = { min: 'Very calm', max: 'Very stressed' };

/* Nighttime awakenings is an ordinal bucket, NOT a number. "3+" must stay a
   string in storage - collapsing it to 3 would silently discard "or more". */
export const AWAKENING_OPTIONS = ['0', '1', '2', '3+'];

/* Free-text fields are capped to keep a runaway paste from filling storage. */
export const MAX_JOURNAL_CHARS = 5000;
