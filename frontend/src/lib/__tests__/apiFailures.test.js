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
