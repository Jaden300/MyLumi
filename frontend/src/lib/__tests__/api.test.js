/* The privacy boundary and the failure contract.

   These tests exist to make two promises hard to break by accident:
   journal text must never leave through a numeric call, and a network failure
   must never reach render as an exception. */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...import.meta.env };

async function loadApi(apiUrl = 'https://api.test') {
  vi.resetModules();
  import.meta.env.VITE_API_URL = apiUrl;
  return import('../api.js');
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  import.meta.env.VITE_API_URL = ORIGINAL_ENV.VITE_API_URL;
});

describe('fetchInsights', () => {
  it('posts feature rows to the batched endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ forecast: {}, correlation: {}, anomaly: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchInsights } = await loadApi();
    await fetchInsights([{ nightOf: '2026-01-01' }], 12);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/v1/insights');
    const body = JSON.parse(options.body);
    expect(body.rows).toHaveLength(1);
    expect(body.daysSinceInjury).toBe(12);
  });

  it('never sends journal text through the numeric endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ forecast: {}, correlation: {}, anomaly: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchInsights } = await loadApi();
    // Even if a caller mistakenly hands over a row carrying text, the payload is
    // whatever it was given - so this asserts the CALLER contract holds by
    // checking the serialised body for the field names journal text uses.
    await fetchInsights([{ nightOf: '2026-01-01', symptomBurden: 20 }], null);

    const body = fetchMock.mock.calls[0][1].body;
    for (const field of ['journal', 'wakeFeeling', 'factors']) {
      expect(body).not.toContain(field);
    }
  });

  it('returns an offline envelope instead of throwing on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));

    const { fetchInsights } = await loadApi();
    const result = await fetchInsights([], null);

    expect(result.offline).toBe(true);
    for (const section of ['forecast', 'correlation', 'anomaly']) {
      expect(result[section].available).toBe(false);
      expect(result[section].reason).toBeTruthy();
    }
  });

  it('treats an HTTP error as offline rather than a crash', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }));

    const { fetchInsights } = await loadApi();
    const result = await fetchInsights([], null);
    expect(result.offline).toBe(true);
    expect(result.forecast.available).toBe(false);
  });

  it('makes no network call at all when unconfigured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { fetchInsights, isConfigured } = await loadApi('');
    const result = await fetchInsights([], null);

    expect(isConfigured()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.offline).toBe(true);
  });
});

describe('analyseJournal', () => {
  it('sends text only to the dedicated NLP endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: true, points: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { analyseJournal } = await loadApi();
    await analyseJournal([{ nightOf: '2026-01-01', day: 'a rough day' }]);

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/v1/nlp');
  });

  it('degrades to an offline envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    const { analyseJournal } = await loadApi();
    const result = await analyseJournal([]);
    expect(result.available).toBe(false);
    expect(result.points).toEqual([]);
  });

  it('makes no call at all when unconfigured', async () => {
    // The equivalent guard for fetchInsights was covered; this path was not.
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { analyseJournal } = await loadApi('');
    const result = await analyseJournal([{ nightOf: '2026-01-01', day: 'private' }]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.available).toBe(false);
  });

  it('sends no numeric or clinical fields through the text endpoint', async () => {
    // The inverse of the numeric endpoint's no-journal-text assertion, run
    // through the real payload builder rather than a hand-written object.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: true, points: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { analyseJournal } = await loadApi();
    const { buildJournalTexts } = await import('../journal.js');

    const texts = buildJournalTexts([
      {
        nightOf: '2026-01-01',
        night: {
          symptoms: { headache: 6 },
          symptomBurden: 42,
          journal: { day: 'a rough day', factors: '' },
        },
        morning: { sleepQuality: 3, journal: { wakeFeeling: 'groggy' } },
      },
    ]);
    await analyseJournal(texts);

    const body = fetchMock.mock.calls[0][1].body;
    expect(body).toContain('a rough day');
    expect(body).not.toContain('symptomBurden');
    expect(body).not.toContain('headache');
    expect(body).not.toContain('sleepQuality');
  });
});

describe('pingHealth', () => {
  it('hits /health and swallows failures', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('asleep'));
    vi.stubGlobal('fetch', fetchMock);

    const { pingHealth } = await loadApi();
    expect(() => pingHealth()).not.toThrow();
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/health');
  });

  it('does nothing when unconfigured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { pingHealth } = await loadApi('');
    pingHealth();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
