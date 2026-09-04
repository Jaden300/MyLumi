/* Journal sentiment, fetched only with explicit consent.

   Mirrors useInsights (same signature-gated fetch, so a cold free-tier service
   is not hammered) with three differences that all exist because this hook sends
   free text rather than numbers:

   1. `consented` is checked FIRST, inside the effect. Guarding only in the
      component that renders the card would leave a hook that still fires on
      mount - the gate has to sit where the request is made, not where the result
      is displayed.

   2. Revoking resets `lastSignature` so a later re-grant actually refetches.
      Without that, turning consent off and on again would show nothing, because
      the signature would still match the fetch from before the revocation.

   3. Results live in React state only and are NEVER persisted. Writing `points`
      to localStorage would put data derived from journal text on disk, and then
      revocation would have to clean that up too. In memory means revocation is
      complete by construction; the cost is one refetch per page load, which the
      signature gate already bounds. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyseJournal, isConfigured } from '../lib/api.js';
import { findAgreement } from '../lib/agreement.js';
import { buildJournalTexts, journalSignature } from '../lib/journal.js';
import { useLumiData } from './useLumiData.jsx';
import { useJournalConsent } from './useJournalConsent.js';

export function useJournalInsights() {
  const { getAllEntries } = useLumiData();
  const { consented, grantedAt, grant, revoke } = useJournalConsent();
  const [state, setState] = useState({ loading: false, sentiment: null });

  const texts = buildJournalTexts(getAllEntries());
  const signature = journalSignature(texts);
  const lastSignature = useRef(null);

  /* Read inside the async continuation so a response that arrives AFTER the user
     revoked is dropped rather than populating the card. An in-flight request
     cannot be recalled, but its result does not have to be shown. */
  const consentRef = useRef(consented);
  consentRef.current = consented;

  // Monotonic request id; see load() for the revoke-then-regrant race.
  const generation = useRef(0);

  const load = useCallback(async (payload) => {
    const id = (generation.current += 1);
    setState((s) => ({ ...s, loading: true }));
    const sentiment = await analyseJournal(payload);
    /* Consent revoked while the request was in flight: drop the result, but
       still clear `loading`. Returning outright leaves the hook stuck reporting
       loading forever, and a re-grant that produces the same signature will not
       refetch, so the card would spin with nothing behind it. */
    if (!consentRef.current) {
      setState({ loading: false, sentiment: null });
      return;
    }
    /* A revoke-then-regrant leaves two requests racing. Without an ordering
       guard the older one can land last and be displayed as current - showing
       sentiment computed from text the user has since edited. */
    if (id !== generation.current) return;
    setState({ loading: false, sentiment });
  }, []);

  useEffect(() => {
    if (!isConfigured() || !consented) {
      lastSignature.current = null;
      setState({ loading: false, sentiment: null });
      return;
    }
    if (texts.length === 0) {
      lastSignature.current = null;
      setState({ loading: false, sentiment: null });
      return;
    }
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    load(texts);
    // `texts` and `load` are excluded deliberately: `texts` is a fresh array on
    // every render, and `signature` is the real dependency - it changes exactly
    // when the answer could change. Same reasoning as useInsights.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, consented]);

  /* The text-vs-numbers comparison, computed here because this is where both
     halves already are: the server's word counts in `state.sentiment`, and the
     PCSS ratings in local storage.

     NOTHING NEW IS SENT. `findAgreement` imports no API client. Symptom scores
     appearing in this hook is worth a second look precisely because it is the
     one place text and numbers meet, so: they meet after the response, on the
     device, and the result goes to a paragraph and nowhere else.

     Derived FROM `state.sentiment` deliberately. A separate memo over
     getAllEntries() would compute the same answer and then survive a
     revocation, because nothing about it depends on the consented fetch. This
     way it is null the moment the sentiment result is cleared - revocation
     stays complete by construction rather than by remembering to clear a second
     piece of state. */
  const mentions = state.sentiment?.available ? state.sentiment.mentions : null;
  const agreement = useMemo(
    () => (mentions ? findAgreement(mentions, getAllEntries()) : null),
    [mentions, getAllEntries],
  );

  return {
    ...state,
    agreement,
    configured: isConfigured(),
    consented,
    grantedAt,
    hasJournalText: texts.length > 0,
    grant,
    revoke,
  };
}
