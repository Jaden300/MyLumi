import { useParams, useNavigate } from 'react-router-dom';
import { useLumiData } from '../hooks/useLumiData.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Lumi } from '../components/lumi/Lumi.jsx';
import { PainSummaryCard } from '../components/pain/PainSummaryCard.jsx';
import { formatNightLabel, formatTime12h, formatDuration } from '../lib/dates.js';
import { deriveSleepDuration, hasDstShift } from '../lib/derive.js';
import { SYMPTOMS, MAX_SYMPTOM_BURDEN } from '../lib/constants.js';

function Row({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="row row--between" style={{ padding: 'var(--space-2) 0' }}>
      <span className="text-muted text-sm">{label}</span>
      <strong className="text-sm">{value}</strong>
    </div>
  );
}

export function EntryDetail() {
  const { nightOf } = useParams();
  const navigate = useNavigate();
  const { getEntry } = useLumiData();
  const entry = getEntry(nightOf);

  if (!entry?.night && !entry?.morning) {
    return (
      <div className="hero">
        <div className="hero__art">
          <Lumi size={120} state="lost" />
        </div>
        <h1 className="hero__title">Nothing logged</h1>
        <p className="hero__lede">This night stayed empty.</p>
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Button variant="secondary" onClick={() => navigate('/history')}>
            Back to history
          </Button>
        </div>
      </div>
    );
  }

  const night = entry.night;
  const morning = entry.morning;
  const duration = deriveSleepDuration(entry);

  return (
    <div className="stack stack--loose">
      <header className="stack stack--tight">
        <h1 className="h-size-h2">{formatNightLabel(entry.nightOf)}</h1>
        {Number.isFinite(night?.symptomBurden) && (
          <p className="text-muted text-sm">
            Symptom burden {night.symptomBurden} of {MAX_SYMPTOM_BURDEN}
          </p>
        )}
      </header>

      <div className="grid grid--2">
        {night && (
          <Card title="Symptoms">
            {SYMPTOMS.map((symptom) => (
              <Row
                key={symptom.key}
                label={symptom.label}
                value={
                  Number.isFinite(night.symptoms?.[symptom.key])
                    ? `${night.symptoms[symptom.key]} / 6`
                    : null
                }
              />
            ))}
          </Card>
        )}

        <PainSummaryCard pain={night?.pain} />

        <Card title="Sleep">
          <Row label="Planned bedtime" value={formatTime12h(night?.sleep?.plannedBedtime)} />
          <Row label="Woke at" value={formatTime12h(morning?.wakeTime)} />
          <Row label="Time asleep" value={formatDuration(duration)} />
          <Row label="Times woken" value={morning?.awakenings} />
          <Row
            label="Sleep quality"
            value={Number.isFinite(morning?.sleepQuality) ? `${morning.sleepQuality} / 6` : null}
          />
          <Row label="Pre-sleep stress" value={night?.sleep?.preSleepStress ? `${night.sleep.preSleepStress} / 5` : null} />
          <Row label="Sleep aid" value={night?.sleep ? (night.sleep.sleepAidUsed ? 'Yes' : 'No') : null} />
          {duration != null && hasDstShift(entry) && (
            <p className="text-muted text-sm" style={{ marginTop: 'var(--space-3)' }}>
              The clocks changed this night, so this duration may be off by an hour.
            </p>
          )}
        </Card>

        {morning && (
          <Card title="The next morning">
            <Row label="Mood" value={Number.isFinite(morning.moodMorning) ? `${morning.moodMorning} / 6` : null} />
            <Row label="Energy" value={Number.isFinite(morning.energy) ? `${morning.energy} / 6` : null} />
            <Row label="Readiness" value={Number.isFinite(morning.readiness) ? `${morning.readiness} / 6` : null} />
            <Row label="Remembered dreams" value={morning.dreamRecall ? 'Yes' : 'No'} />
          </Card>
        )}
      </div>

      {(night?.journal?.day || night?.journal?.factors || morning?.journal?.wakeFeeling) && (
        <Card title="Your notes" variant="feature">
          <Lumi size={170} state="reading" className="lumi-deco lumi-deco--br" />
          <div className="stack">
            {night?.journal?.day && <JournalNote label="That day" text={night.journal.day} />}
            {night?.journal?.factors && (
              <JournalNote label="What helped or hurt" text={night.journal.factors} />
            )}
            {morning?.journal?.wakeFeeling && (
              <JournalNote label="On waking" text={morning.journal.wakeFeeling} />
            )}
          </div>
        </Card>
      )}

      <Button variant="secondary" onClick={() => navigate('/history')}>
        Back to history
      </Button>
    </div>
  );
}

function JournalNote({ label, text }) {
  return (
    <div className="stack stack--tight">
      <span className="stat__label">{label}</span>
      <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>
        {text}
      </p>
    </div>
  );
}
