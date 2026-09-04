/* The journal tone card, and the two paragraphs added to it.

   Same rule as the other card tests: this mounts inside the insights page, so a
   throw here costs the whole screen through the error boundary. Every branch
   must refuse a malformed section rather than render a partial one.

   The extra thing pinned here is RESTRAINT. responsible-ai.md commits to this
   being the quietest card in the app, and the two new findings are paragraphs
   inside it rather than cards of their own. A test that only checked "the
   sentence appears" would pass just as happily if someone promoted either one
   into a second card, so these check the absence cases too. */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SentimentCard } from '../insights/SentimentCard.jsx';

/* A real response shape, as the backend returns it for a consented user with
   three weeks of journal entries. */
const result = {
  available: true,
  reason: null,
  confidence: 'moderate',
  nDays: 19,
  trend: 'improving',
  meanSentiment: 0.213,
  points: [
    { nightOf: '2026-01-01', sentiment: -0.4, words: 14, hits: 3 },
    { nightOf: '2026-01-02', sentiment: -0.1, words: 12, hits: 2 },
    { nightOf: '2026-01-03', sentiment: 0.3, words: 15, hits: 4 },
  ],
  mentions: [{ nightOf: '2026-01-01', mentions: { headache: 2 } }],
  complexity: {
    available: true,
    reason: null,
    confidence: 'low',
    nDays: 19,
    finding: {
      metric: 'wordLength',
      direction: 'falling',
      tau: -0.42,
      statement:
        'Across your last 19 journal entries, your writing has been using shorter words. '
        + 'This describes the entries themselves, not you.',
    },
  },
  offline: false,
};

const agreement = {
  key: 'headache',
  label: 'headache',
  gap: -2,
  mentionedNights: 7,
  silentNights: 9,
  statement:
    'You wrote about headache on nights you rated it lower. '
    + 'Both are your own record of the day - this is just where they differ.',
};

describe('SentimentCard', () => {
  it('renders the tone sentence and keeps the revoke row', () => {
    render(<SentimentCard result={result} onRevoke={() => {}} />);
    expect(screen.getByText(/read a little more positively/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /turn off journal analysis/i })).toBeTruthy();
  });

  it('shows the agreement sentence when one is supplied', () => {
    render(<SentimentCard result={result} agreement={agreement} onRevoke={() => {}} />);
    expect(screen.getByText(/wrote about headache on nights you rated it lower/)).toBeTruthy();
  });

  it('shows nothing extra when there is no agreement finding', () => {
    /* The common case. The floors in lib/agreement.js will not clear most of
       the time, and that silence is the intended rate rather than a failure. */
    render(<SentimentCard result={result} agreement={null} onRevoke={() => {}} />);
    expect(screen.queryByText(/rated it lower/)).toBeNull();
    expect(screen.queryByText(/pointing the same way/)).toBeNull();
  });

  it('names the alternative explanations alongside a writing finding', () => {
    /* The honesty of the weakest model in the app is this paragraph. A finding
       rendered without it invites the frightening reading while claiming to
       have said nothing. */
    render(<SentimentCard result={result} onRevoke={() => {}} />);
    expect(screen.getByText(/using shorter words/)).toBeTruthy();
    expect(screen.getByText(/being in a hurry, typing on a phone/)).toBeTruthy();
  });

  it('never uses cognitive vocabulary around the writing finding', () => {
    const { container } = render(<SentimentCard result={result} onRevoke={() => {}} />);
    const text = container.textContent.toLowerCase();
    for (const banned of ['cognitive', 'cognition', 'decline', 'impair', 'brain fog']) {
      expect(text).not.toContain(banned);
    }
  });

  it('omits the writing paragraph when complexity is below its floor', () => {
    const below = {
      ...result,
      complexity: { available: false, reason: '5 more journal entries', confidence: 'none', nDays: 13, finding: null },
    };
    render(<SentimentCard result={below} onRevoke={() => {}} />);
    expect(screen.queryByText(/shorter words/)).toBeNull();
    // And it must not leak the refusal copy into a card about something else.
    expect(screen.queryByText(/5 more journal entries/)).toBeNull();
  });

  it('omits the writing paragraph when the model ran and found nothing', () => {
    const nothing = {
      ...result,
      complexity: { available: true, reason: null, confidence: 'low', nDays: 19, finding: null },
    };
    render(<SentimentCard result={nothing} onRevoke={() => {}} />);
    expect(screen.queryByText(/shorter words/)).toBeNull();
  });

  it('renders neither paragraph on the offline branch', () => {
    /* Offline is the envelope api.js synthesises. Consent stays ON through it,
       so the revoke row must survive - but nothing derived from a response can
       be shown, because there was no response. */
    const offlineResult = {
      available: false,
      reason: 'MyLumi could not reach the model service.',
      confidence: 'none',
      nDays: 0,
      points: [],
      trend: null,
      meanSentiment: null,
      mentions: [],
      complexity: null,
      offline: true,
    };
    render(<SentimentCard result={offlineResult} agreement={agreement} onRevoke={() => {}} />);
    expect(screen.getByText(/could not reach the model service/)).toBeTruthy();
    expect(screen.queryByText(/rated it lower/)).toBeNull();
    expect(screen.getByRole('button', { name: /turn off journal analysis/i })).toBeTruthy();
  });

  it('does not throw on malformed new sections', () => {
    for (const broken of [
      { ...result, complexity: {} },
      { ...result, complexity: { available: true, finding: {} } },
      { ...result, mentions: null },
    ]) {
      expect(() => render(<SentimentCard result={broken} onRevoke={() => {}} />)).not.toThrow();
    }
    for (const brokenAgreement of [{}, { statement: null }, { label: 'headache' }]) {
      expect(() =>
        render(<SentimentCard result={result} agreement={brokenAgreement} onRevoke={() => {}} />),
      ).not.toThrow();
    }
  });
});
