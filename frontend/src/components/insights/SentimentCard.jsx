/* Journal tone. The quietest card in the app, on purpose.

   docs/responsible-ai.md calls sentiment a SECONDARY signal, never a substitute
   for the numbers. So this deliberately does not look like the trajectory chart:
   the sparkline has no gridlines, no axis labels and half the height, and it sits
   BELOW the sentence rather than above it. The sentence is the finding; the line
   is texture. A word-list score rendered at the same visual weight as the PCSS
   burden chart would claim an authority it does not have.

   The mean is shown as a word AND the number. A bare "0.213" is false precision
   handed to a patient; hiding the number entirely would undercut the claim that
   every score in this app is auditable. The word leads, the number follows in
   small muted text.

   Title is "Journal tone", not "Sentiment analysis" - plainer, and it does not
   imply a measurement of the person rather than of the words. */

import { Card } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { Lumi } from '../lumi/Lumi.jsx';
import { ConfidenceBadge } from './ConfidenceBadge.jsx';
import {
  describeMeanSentiment,
  describeSentiment,
  buildSentimentSegments,
} from '../../lib/journal.js';
import { formatShortDate } from '../../lib/dates.js';

const W = 320;
const H = 64;
const PAD = { top: 8, right: 8, bottom: 8, left: 8 };

const TREND_SENTENCE = {
  improving: "What you've been writing has read a little more positively over time.",
  declining: "What you've been writing has read a little more negatively over time.",
  steady: "The tone of what you've written has stayed fairly steady.",
};

export function SentimentCard({ result, loading, onRevoke }) {
  if (loading && !result) {
    return (
      <Card title="Journal tone">
        <div className="stack">
          <p className="text-muted text-sm" role="status">
            Reading your journal entries. This can take up to a minute if the model service hasn't
            been used in a while.
          </p>
          <RevokeRow onRevoke={onRevoke} />
        </div>
      </Card>
    );
  }

  /* Not loading and no result. The caller has already established that consent
     is on and there is journal text, so rendering nothing leaves the section
     silently blank with no way back except a page reload - which is what a
     revoke-then-regrant used to do. Say something honest instead. */
  if (!result) {
    return (
      <Card title="Journal tone">
        <div className="stack">
          <p className="text-muted text-sm">
            Nothing to show right now. This will fill in the next time your journal entries are
            read.
          </p>
          <RevokeRow onRevoke={onRevoke} />
        </div>
      </Card>
    );
  }

  /* Offline and "nothing scorable yet" share one envelope and one path, the same
     collapse InsightsSection makes. Consent stays ON through both - an empty
     result is not a reason to silently revoke something the user chose. */
  if (result.offline || !result.available) {
    return (
      <Card title="Journal tone">
        <div className="stack">
          <p className="text-sm">{result.reason}</p>
          <RevokeRow onRevoke={onRevoke} />
        </div>
      </Card>
    );
  }

  const { points, trend, meanSentiment, confidence, nDays } = result;
  const word = describeMeanSentiment(meanSentiment);
  const segments = buildSentimentSegments(points);

  return (
    <Card title="Journal tone" variant="feature">
      <Lumi size={160} state="reading" className="lumi-deco lumi-deco--bl" />
      <div className="stack">
        <div className="row row--between" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <p className="text-sm">
            {/* No hedged direction under the backend's 5-entry threshold. Same
                discipline as refusing a prediction under 7 nights. */}
            {trend
              ? TREND_SENTENCE[trend]
              : "Not enough journal entries yet to see a direction - here's what MyLumi has so far."}
          </p>
          <ConfidenceBadge confidence={confidence} nDays={nDays} />
        </div>

        {word && (
          <p className="text-sm">
            On average, what you wrote reads as <strong>{word}</strong>.{' '}
            <span className="text-muted text-sm">
              (average {meanSentiment} on a -1 to +1 scale, from {nDays}{' '}
              {nDays === 1 ? 'entry' : 'entries'})
            </span>
          </p>
        )}

        <Sparkline segments={segments} label={describeSentiment(result)} />

        <RevokeRow onRevoke={onRevoke} />
      </div>
    </Card>
  );
}

/* The canonical off-switch. It used to be a backup for the toggle on the Your
   data page; with that page gone, consent is revoked from where the feature
   actually appears, so it must render on every branch of this card - including
   the offline and nothing-to-show ones, where the user can still change their
   mind. */
function RevokeRow({ onRevoke }) {
  if (!onRevoke) return null;
  return (
    <div>
      <Button variant="secondary" onClick={onRevoke}>
        Turn off journal analysis
      </Button>
    </div>
  );
}

/* No gridlines, no axis text, no numeric labels - see the header comment.
   Position relative to the zero line carries the sign, so the reading does not
   depend on colour, per the design system. */
function Sparkline({ segments, label }) {
  const all = segments.flat();
  if (all.length === 0) return null;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const spanDays = Math.max(1, all[all.length - 1].x);

  const sx = (x) => PAD.left + (x / spanDays) * plotW;
  // Sentiment is -1..+1; map it so 0 sits exactly on the mid-line.
  const sy = (s) => PAD.top + plotH / 2 - (Math.max(-1, Math.min(1, s)) * plotH) / 2;

  return (
    <svg className="sentiment-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <line
        x1={PAD.left}
        y1={sy(0)}
        x2={W - PAD.right}
        y2={sy(0)}
        className="sentiment-spark__zero"
      />

      {/* One polyline per unbroken run: the line breaks across nights that were
          not scored, rather than being drawn through them. */}
      {segments.map((segment) =>
        segment.length > 1 ? (
          <polyline
            key={segment[0].nightOf}
            className="sentiment-spark__line"
            points={segment.map((p) => `${sx(p.x)},${sy(p.sentiment)}`).join(' ')}
          />
        ) : null,
      )}

      {all.map((point) => (
        <circle
          key={point.nightOf}
          cx={sx(point.x)}
          cy={sy(point.sentiment)}
          r={2.5}
          className={
            point.sentiment < 0
              ? 'sentiment-spark__point sentiment-spark__point--negative'
              : 'sentiment-spark__point'
          }
        >
          {/* A real <title> child, reachable on touch - the design-system chart
              rule. A CSS tooltip would be invisible on a phone. */}
          <title>
            {formatShortDate(point.nightOf)}: {describeMeanSentiment(point.sentiment)}
          </title>
        </circle>
      ))}
    </svg>
  );
}
