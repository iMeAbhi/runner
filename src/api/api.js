// Thin client for the Google Apps Script web-app endpoint (see Code.gs).
//
// Apps Script web apps don't return CORS preflight-friendly headers for custom
// content types, so we POST as text/plain (a "simple request") and send JSON in
// the body. GET reads use query params. All actions are routed via an `action`
// field so a single deployment serves every operation.

const TIMEOUT_MS = 30000;

function withTimeout(promise, ms = TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error('Request timed out')), ms)
    ),
  ]);
}

/** GET all rows from both tabs: { trips: [...], holidays: [...] }. */
export async function fetchAll(baseUrl, token = '') {
  if (!baseUrl) throw new Error('No Apps Script URL configured');
  // The shared secret authenticates the request (see SHARED_SECRET in Code.gs).
  const auth = token ? `&token=${encodeURIComponent(token)}` : '';
  const url = `${baseUrl}?action=getAll&t=${Date.now()}${auth}`;
  const res = await withTimeout(fetch(url, { method: 'GET' }));
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { trips: data.trips || [], holidays: data.holidays || [] };
}

/**
 * Non-destructive connectivity + key check. Resolves to { ok: true } when the
 * URL is reachable and the token is accepted; throws 'Unauthorized' on a key
 * mismatch, or a network error if unreachable. Backs the Settings "Verify" button.
 */
export async function ping(baseUrl, token = '') {
  if (!baseUrl) throw new Error('No Apps Script URL configured');
  const auth = token ? `&token=${encodeURIComponent(token)}` : '';
  const res = await withTimeout(
    fetch(`${baseUrl}?action=ping&t=${Date.now()}${auth}`, { method: 'GET' })
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function post(baseUrl, payload, token = '') {
  if (!baseUrl) throw new Error('No Apps Script URL configured');
  const res = await withTimeout(
    fetch(baseUrl, {
      method: 'POST',
      // text/plain keeps this a CORS "simple request" (no preflight).
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      // The shared secret travels in the body and is checked server-side.
      body: JSON.stringify({ ...payload, token }),
      redirect: 'follow',
    })
  );
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

/**
 * Send ONE ticket/screenshot (base64) to the backend's Gemini proxy for parsing.
 * Returns { parsed: {...} } or { error }. Callers send one file per request.
 */
export const parseTicket = (baseUrl, { base64, mime, filename }, token) =>
  post(baseUrl, { action: 'parseTicket', base64, mime, filename }, token);

/** Manually trigger the calendar import. Returns { imported, firstSync }. */
export const syncCalendar = (baseUrl, token) =>
  post(baseUrl, { action: 'syncCalendar' }, token);

/** Upsert a trip row (no media). Returns { trip }. */
export const saveTrip = (baseUrl, trip, token) =>
  post(baseUrl, { action: 'saveTrip', trip }, token);

export const removeTrip = (baseUrl, id, token) =>
  post(baseUrl, { action: 'deleteTrip', id }, token);

/**
 * Upload ONE compressed image for a trip. The spec mandates a sequential queue
 * (one file per HTTP request) to dodge Apps Script timeouts — callers must await
 * each call before sending the next. Returns { url } of the public Drive file.
 * `rootFolderId` (from Settings) is the parent folder; the backend files the
 * image into a "<City>_<YYYY-MM>" sub-folder beneath it.
 */
export const uploadImage = (
  baseUrl,
  { tripId, city, startDate, base64, mime, rootFolderId },
  token
) =>
  post(
    baseUrl,
    {
      action: 'uploadImage',
      tripId,
      city,
      startDate,
      base64,
      mime,
      rootFolderId,
    },
    token
  );

/**
 * Re-sync a trip's gallery from its Drive folder (picks up photos added to the
 * folder by hand and makes them public). Returns { urls, folderUrl }.
 */
export const syncFolder = (baseUrl, { id, folderUrl, rootFolderId, city, startDate }, token) =>
  post(
    baseUrl,
    {
      action: 'syncFolder',
      id,
      folderUrl,
      rootFolderId,
      city,
      startDate,
    },
    token
  );
