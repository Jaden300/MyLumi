/* Maps a flow step's `component` name to the actual component.

   Flow configs reference steps by NAME rather than importing components
   directly, which keeps the config a plain serializable object — so a saved
   draft can store `stepId` and survive steps being reordered or inserted. */

import { SymptomStep } from './steps/SymptomStep.jsx';
import { MoodStep } from './steps/MoodStep.jsx';
import { JournalStep } from './steps/JournalStep.jsx';
import { SleepIntentStep } from './steps/SleepIntentStep.jsx';
import { WakeStep } from './steps/WakeStep.jsx';
import { SleepQualityStep } from './steps/SleepQualityStep.jsx';
import { MorningStateStep } from './steps/MorningStateStep.jsx';

export const stepRegistry = {
  SymptomStep,
  MoodStep,
  JournalStep,
  SleepIntentStep,
  WakeStep,
  SleepQualityStep,
  MorningStateStep,
};
