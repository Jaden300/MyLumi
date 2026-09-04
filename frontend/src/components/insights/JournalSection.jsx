/* Picks the journal-analysis state, the way InsightsSection does for the numeric
   cards - the page stays a list of sections and does not branch.

   States, exactly one of which renders:
     1. not configured        -> says so (see below)
     2. no journal text yet   -> nothing (offering to analyse nothing is noise)
     3. consent not given     -> the opt-in prompt
     4. consent given         -> the results card, incl. its own loading/offline */

import { useJournalInsights } from '../../hooks/useJournalInsights.js';
import { JournalConsentPrompt } from './JournalConsentPrompt.jsx';
import { SentimentCard } from './SentimentCard.jsx';
import { Card } from '../ui/Card.jsx';

export function JournalSection() {
  const { configured, consented, hasJournalText, loading, sentiment, agreement, grant, revoke } =
    useJournalInsights();

  /* This used to render nothing, which was worse here than on the numeric side:
     it hid the consent prompt too, so a user on an unconfigured build was never
     offered the feature and had no way to learn it existed. */
  if (!configured) {
    return (
      <Card title="Journal tone">
        <p className="text-sm">
          Model service is not configured for this build, so journal tone cannot
          be read. Nothing you have written has been sent anywhere.
        </p>
      </Card>
    );
  }
  if (!hasJournalText) return null;
  if (!consented) return <JournalConsentPrompt onGrant={grant} />;

  return (
    <SentimentCard
      result={sentiment}
      agreement={agreement}
      loading={loading}
      onRevoke={revoke}
    />
  );
}
