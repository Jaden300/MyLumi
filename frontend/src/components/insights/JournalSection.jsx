/* Picks the journal-analysis state, the way InsightsSection does for the numeric
   cards - the page stays a list of sections and does not branch.

   States, exactly one of which renders:
     1. not configured        -> nothing (a build with no API URL stays quiet)
     2. no journal text yet   -> nothing (offering to analyse nothing is noise)
     3. consent not given     -> the opt-in prompt
     4. consent given         -> the results card, incl. its own loading/offline */

import { useJournalInsights } from '../../hooks/useJournalInsights.js';
import { JournalConsentPrompt } from './JournalConsentPrompt.jsx';
import { SentimentCard } from './SentimentCard.jsx';

export function JournalSection() {
  const { configured, consented, hasJournalText, loading, sentiment, grant, revoke } =
    useJournalInsights();

  if (!configured) return null;
  if (!hasJournalText) return null;
  if (!consented) return <JournalConsentPrompt onGrant={grant} />;

  return <SentimentCard result={sentiment} loading={loading} onRevoke={revoke} />;
}
