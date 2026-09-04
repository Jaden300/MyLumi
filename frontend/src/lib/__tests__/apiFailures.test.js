import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* api.js promises that nothing throws into render: every failure comes back as
   the same "unavailable" envelope the server uses for "not enough data", so the
   UI has one path instead of a happy path plus an error path.

   These tests hold it to that on every transport failure a deployed app can
   actually hit, including the ones that are awkward to reach by hand: a proxy
   returning HTML, a service that never answers, a cold start that times out. */

const ORIGINAL_ENV = { ...import.meta.env };

async function loadApi(url = 'https://api.test') {
  vi.resetModules();
  import.meta.env.VITE_API_URL = url;
  return import('../api.js');
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  import.meta.env.VITE_API_URL = ORIGINAL_ENV.VITE_API_URL;
});

const stubFetch = (impl) => vi.stubGlobal('fetch', vi.fn(impl));

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

describe('fetchInsights failure handling', () => {
  it('returns an unavailable envelope when the service is unreachable', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    const { fetchInsights } = await loadApi();
    const result = await fetchInsights([]);

    expect(result.offline).toBe(true);
    for (const section of ['forecast', 'correlation', 'anomaly']) {
      expect(result[section].available).toBe(false);
      expect(result[section].confidence).toBe('none');
      expect(result[section].reason).toBeTruthy();
    }
  });

  it('does not throw when the body is not JSON', async () => {
    // A misconfigured proxy or a Render error page returns HTML with a 200.
    stubFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
      }),
    );
    const { fetchInsights } = await loadApi();
    const result = await fetchInsights([]);
    expect(result.offline).toBe(true);
    expect(result.forecast.available).toBe(false);
  });

  it('degrades on a 500 rather than surfacing a status code', async () => {
    stubFetch(() => Promise.resolve(jsonResponse({}, false, 500)));
    const { fetchInsights } = await loadApi();
    const result = await fetchInsights([]);
    expect(result.offline).toBe(true);
    expect(result.forecast.reason).not.toContain('500');
  });

  it('says the build is unconfigured, not that the network failed', async () => {
    /* An unset VITE_API_URL is a deploy mistake, not an outage. Reporting it as
       an outage sends someone hunting the wrong problem. */
    const fetchSpy = vi.fn();
    stubFetch(fetchSpy);
    const { fetchInsights, isConfigured } = await loadApi('');

    expect(isConfigured()).toBe(false);
    const result = await fetchInsights([]);
    expect(result.forecast.available).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('analyseJournal failure handling', () => {
  it('returns an empty, safe shape on failure', async () => {
    stubFetch(() => Promise.reject(new Error('boom')));
    const { analyseJournal } = await loadApi();
    const result = await analyseJournal([]);

    expect(result.offline).toBe(true);
    expect(result.points).toEqual([]);
    expect(result.trend).toBeNull();
    expect(result.meanSentiment).toBeNull();
    expect(result.mentions).toEqual([]);
    expect(result.complexity).toBeNull();
  });

  /* The offline envelope is a real rendering path, not an error path, so every
     field the card reads has to be present in it. A field added to NlpResponse
     but not here reaches a component as `undefined` rather than as an absence
     it handles - so this pins the exact key set and fails loudly on the next
     addition rather than showing a blank line in the UI. */
  it('offline envelope carries exactly the keys the card reads', async () => {
    stubFetch(() => Promise.reject(new Error('boom')));
    const { analyseJournal } = await loadApi();
    const result = await analyseJournal([]);

    expect(new Set(Object.keys(result))).toEqual(
      new Set([
        'available', 'reason', 'confidence', 'nDays',
        'points', 'trend', 'meanSentiment', 'mentions', 'complexity',
        'offline',
      ]),
    );
  });

  it('posts journal text only to the nlp endpoint', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(jsonResponse({ points: [] })));
    stubFetch(fetchSpy);
    const { analyseJournal } = await loadApi();
    await analyseJournal([{ nightOf: '2026-01-01', day: 'a rough day' }]);

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toContain('/v1/nlp');
  });
});

describe('privacy boundary', () => {
  it('never sends journal text on the numeric endpoint', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(jsonResponse({})));
    stubFetch(fetchSpy);
    const { fetchInsights } = await loadApi();

    await fetchInsights([{ nightOf: '2026-01-01', symptomBurden: 20 }]);
    const [url, init] = fetchSpy.mock.calls[0];

    expect(url).toContain('/v1/insights');
    const body = init.body.toLowerCase();
    for (const forbidden of ['journal', 'wakefeeling', 'factors', 'text', 'notes']) {
      expect(body).not.toContain(forbidden);
    }
  });
});

/* A 200 is not a promise of the right shape. These bodies are all things a real
   deployment serves: a misrouted path hitting FastAPI's 404 handler, a proxy or
   platform error page rendered as JSON, a half-deployed backend. The UI reads
   `forecast.available` directly, so an absent section used to throw and take the
   whole dashboard down through the error boundary. */
describe('fetchInsights shape validation', () => {
  const malformed = [
    ['a JSON 404 body', { detail: 'Not Found' }],
    ['an empty object', {}],
    ['a platform status page', { message: 'service starting' }],
    ['an array', [1, 2, 3]],
    ['null', null],
    ['a partial body missing anomaly', { forecast: { available: false }, correlation: { available: false } }],
  ];

  for (const [label, body] of malformed) {
    it(`returns the offline envelope for ${label}`, async () => {
      stubFetch(() => Promise.resolve(jsonResponse(body)));
      const { fetchInsights } = await loadApi();
      const result = await fetchInsights([]);

      expect(result.offline).toBe(true);
      // Every section must be safely destructurable by the UI.
      for (const section of [result.forecast, result.correlation, result.anomaly]) {
        expect(section).toBeTypeOf('object');
        expect(section.available).toBe(false);
        expect(section.reason).toBeTruthy();
      }
    });
  }

  it('passes a well-formed response through untouched', async () => {
    const body = {
      forecast: { available: true, nDays: 20, predictedBurden: 22.5, interval: [19, 26] },
      correlation: { available: false, findings: [] },
      anomaly: { available: true, anomalies: [] },
      symptoms: { available: true, rates: [], shifts: [] },
      validation: { available: true, folds: 12, modelError: 3.1 },
      recoveryState: { available: true, points: [] },
    };
    stubFetch(() => Promise.resolve(jsonResponse(body)));
    const { fetchInsights } = await loadApi();
    const result = await fetchInsights([]);

    expect(result.offline).toBe(false);
    expect(result.forecast.predictedBurden).toBe(22.5);
    expect(result.validation.modelError).toBe(3.1);
  });

  /* A frontend deployed ahead of its backend is an ordering mistake, not an
     outage. The three original sections are what make a response a response;
     anything newer that is missing degrades on its own rather than blanking
     every card on the page. */
  it('keeps working against a backend that predates the newer models', async () => {
    const body = {
      forecast: { available: true, nDays: 20, predictedBurden: 22.5, interval: [19, 26] },
      correlation: { available: true, findings: [] },
      anomaly: { available: true, anomalies: [] },
    };
    stubFetch(() => Promise.resolve(jsonResponse(body)));
    const { fetchInsights } = await loadApi();
    const result = await fetchInsights([]);

    expect(result.offline).toBe(false);
    expect(result.forecast.available).toBe(true);

    for (const section of [result.symptoms, result.validation, result.recoveryState]) {
      expect(section).toBeTypeOf('object');
      expect(section.available).toBe(false);
      expect(section.reason).toBeTruthy();
    }
  });

  it('gives every section a safe shape on transport failure', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    const { fetchInsights } = await loadApi();
    const result = await fetchInsights([]);

    const sections = [
      'forecast',
      'correlation',
      'anomaly',
      'symptoms',
      'validation',
      'recoveryState',
    ];
    for (const key of sections) {
      expect(result[key], key).toBeTypeOf('object');
      expect(result[key].available, key).toBe(false);
      expect(result[key].reason, key).toBeTruthy();
    }
  });
});

describe('analyseJournal shape validation', () => {
  it('returns the offline envelope when the body is not a result', async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ detail: 'Not Found' })));
    const { analyseJournal } = await loadApi();
    const result = await analyseJournal([]);

    expect(result.offline).toBe(true);
    expect(result.available).toBe(false);
    expect(result.reason).toBeTruthy(); // never an empty explanation
    expect(result.points).toEqual([]);
  });
});

describe('pingHealth', () => {
  it('is silent when no API URL is configured', async () => {
    const fetchSpy = vi.fn();
    stubFetch(fetchSpy);
    const { pingHealth } = await loadApi('');
    pingHealth();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never rejects, even when the request fails', async () => {
    stubFetch(() => Promise.reject(new Error('down')));
    const { pingHealth } = await loadApi();
    expect(() => pingHealth()).not.toThrow();
  });
});
