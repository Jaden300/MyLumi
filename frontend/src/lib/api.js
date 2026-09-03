/* The ONLY file in the app that talks to the network.

   Everything MyLumi knows about a user lives in their browser. This module is
   the one place that sends anything anywhere, which makes the privacy claim
   auditable: to verify what leaves the device, read this file and `toFeatureRow`.

   Two rules it enforces:

   1. Nothing throws into render. Every failure returns the same envelope the
      server uses for "not enough data" - `{ available: false, reason }` - so the
      UI has ONE "we can't tell you right now" path instead of a happy path plus
      an error path.

   2. Journal text only goes through `analyseJournal`, never `fetchInsights`.
      Separate functions calling separate endpoints, so free text can never ride
      along as a side effect of a numeric call. */

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/* Render's free tier sleeps after ~15 minutes idle and takes ~50s to wake. A
   normal 10s timeout would make a healthy service look broken every single time
   a judge opens the app after a break, so we wait it out and say why. */
const COLD_START_TIMEOUT_MS = 60000;
const HEALTH_TIMEOUT_MS = 3000;

export const isConfigured = () => Boolean(BASE_URL);

const offline = (reason) => ({
  available: false,
  reason,
  confidence: 'none',
  nDays: 0,
});

const OFFLINE_MESSAGE = "MyLumi can't reach its model service right now. Your data is safe on this device.";

/* A response section the UI can safely destructure. Guards the shape, not the
   values - a section may legitimately be `{available: false, reason}`. */
const isSection = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

async function post(path, body, { timeout = COLD_START_TIMEOUT_MS } = {}) {
  if (!BASE_URL) return { ok: false, error: 'unconfigured' };

  // AbortController rather than Promise.race so the request is actually
  // cancelled, not just ignored while it keeps the connection open.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, error: `http-${response.status}` };
    /* Parsed in its own try so a malformed body is reported as 'malformed'
       rather than 'network'. Both produce the same user-facing message, but a
       proxy returning an HTML error page is a different problem from an
       unreachable service, and conflating them hides it during a demo. */
    try {
      return { ok: true, data: await response.json() };
    } catch {
      return { ok: false, error: 'malformed' };
    }
  } catch (error) {
    return { ok: false, error: error?.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wake a sleeping instance. Fire-and-forget, called on app mount.
 *
 * Deliberately ignores its own result: this is a nudge to start the cold start
 * early, not a check anyone waits on.
 */
export function pingHealth() {
  if (!BASE_URL) return;
  const controller = new AbortController();
  setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  fetch(`${BASE_URL}/health`, { signal: controller.signal }).catch(() => {});
}

/**
 * Numeric insights. NO journal text - see toFeatureRow in derive.js.
 *
 * Returns the three sections in server shape, with an offline envelope
 * substituted on failure so callers never branch on transport errors.
 */
export async function fetchInsights(rows, daysSinceInjury = null) {
  const result = await post('/v1/insights', { rows, daysSinceInjury });
  const offlineEnvelope = (reason) => ({
    forecast: offline(reason),
    correlation: offline(reason),
    anomaly: offline(reason),
    offline: true,
  });

  if (!result.ok) {
    return offlineEnvelope(
      result.error === 'unconfigured'
        ? 'Model service is not configured for this build.'
        : OFFLINE_MESSAGE,
    );
  }

  /* A 200 is not a promise of the right shape. A misrouted path, a proxy error
     page served as JSON, or a half-deployed backend all return well-formed JSON
     that is missing these sections - and the UI reads `forecast.available`
     directly, so an absent section took down the whole dashboard through the
     error boundary. Treating a wrong shape as "service unavailable" is both true
     and the path the UI already knows how to render. */
  if (!isSection(result.data?.forecast) || !isSection(result.data?.correlation) || !isSection(result.data?.anomaly)) {
    return offlineEnvelope(OFFLINE_MESSAGE);
  }
  return { ...result.data, offline: false };
}

/**
 * Journal sentiment. Sends free text.
 *
 * The consent gate is NOT here. This function will send whatever it is handed -
 * enforcement lives in `useJournalInsights`, which refuses to call it unless
 * `useJournalConsent` reports an explicit opt-in, and in `buildJournalTexts`
 * (lib/journal.js), which is the only thing that should ever build its payload.
 *
 * Stated plainly because the alternative is a comment claiming a guarantee this
 * layer does not provide: any future caller must gate on consent itself.
 */
export async function analyseJournal(texts) {
  const result = await post('/v1/nlp', { texts });
  const offlineEnvelope = () => ({
    ...offline(OFFLINE_MESSAGE),
    points: [],
    trend: null,
    meanSentiment: null,
    offline: true,
  });
  if (!result.ok) return offlineEnvelope();
  // Same reasoning as fetchInsights: a 200 with the wrong shape is not a result.
  // Without this the card rendered an empty explanation paragraph.
  if (!isSection(result.data) || typeof result.data.available !== 'boolean') return offlineEnvelope();
  return { ...result.data, offline: false };
}
