// Client for the Google Apps Script backend.
//
// No auth token — setup is just the deployed /exec URL. The script's "Anyone"
// access + the unguessable random URL is the only gate (fine for a personal,
// single-user app).
//
// Requests use `redirect: 'follow'` because Apps Script /exec issues a 302 to
// googleusercontent.com for the actual payload.

/** Thrown for transport failures so callers can surface a clean message. */
export class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

function requireConfig(settings) {
  if (!settings?.APPS_SCRIPT_URL) throw new ApiError('Apps Script URL not configured', 'NO_URL');
}

/**
 * Low-level POST. Uses text/plain to dodge a CORS preflight (Apps Script does
 * not respond to OPTIONS); the body is still JSON the server parses.
 */
async function post(settings, action, payload = {}) {
  requireConfig(settings);
  const body = JSON.stringify({ action, ...payload });

  const res = await fetch(settings.APPS_SCRIPT_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
  });
  return handle(res);
}

async function get(settings, action, params = {}) {
  requireConfig(settings);
  const url = new URL(settings.APPS_SCRIPT_URL);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
  return handle(res);
}

async function handle(res) {
  let data;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(`Unexpected backend response: ${text.slice(0, 120)}`, 'BAD_JSON');
  }
  if (!res.ok || data.ok === false) {
    throw new ApiError(data.error || `Request failed (${res.status})`, data.code || 'API_ERROR');
  }
  return data;
}

/* ── Public API surface ───────────────────────────────────────────────── */

export const api = {
  /** Verify the backend URL is reachable. */
  ping: (settings) => get(settings, 'ping'),

  /** Fetch all trip rows from the sheet. */
  getTrips: (settings) => get(settings, 'getTrips'),

  /** Create or update a trip row. Returns { remoteId }. */
  upsertTrip: (settings, trip) => post(settings, 'upsertTrip', { trip }),

  /** Delete a trip row by remote id. */
  deleteTrip: (settings, remoteId) => post(settings, 'deleteTrip', { remoteId }),

  /**
   * Upload one compressed image. The backend stores it in
   * Drive/Travel_App_Media/<folder>/ and returns its public URL.
   * @param {{name, mimeType, base64, folder}} image
   */
  uploadMedia: (settings, { localId, image }) =>
    post(settings, 'uploadMedia', { localId, image }),
};
