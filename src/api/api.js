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
export async function fetchAll(baseUrl) {
  if (!baseUrl) throw new Error('No Apps Script URL configured');
  const url = `${baseUrl}?action=getAll&t=${Date.now()}`;
  const res = await withTimeout(fetch(url, { method: 'GET' }));
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { trips: data.trips || [], holidays: data.holidays || [] };
}

async function post(baseUrl, payload) {
  if (!baseUrl) throw new Error('No Apps Script URL configured');
  const res = await withTimeout(
    fetch(baseUrl, {
      method: 'POST',
      // text/plain keeps this a CORS "simple request" (no preflight).
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    })
  );
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

/** Upsert a trip row (no media). Returns { trip }. */
export const saveTrip = (baseUrl, trip) =>
  post(baseUrl, { action: 'saveTrip', trip });

export const removeTrip = (baseUrl, id) =>
  post(baseUrl, { action: 'deleteTrip', id });

/**
 * Upload ONE compressed image for a trip. The spec mandates a sequential queue
 * (one file per HTTP request) to dodge Apps Script timeouts — callers must await
 * each call before sending the next. Returns { url } of the public Drive file.
 * `rootFolderId` (from Settings) is the parent folder; the backend files the
 * image into a "<City>_<YYYY-MM>" sub-folder beneath it.
 */
export const uploadImage = (
  baseUrl,
  { tripId, city, startDate, base64, mime, rootFolderId }
) =>
  post(baseUrl, {
    action: 'uploadImage',
    tripId,
    city,
    startDate,
    base64,
    mime,
    rootFolderId,
  });

/**
 * Re-sync a trip's gallery from its Drive folder (picks up photos added to the
 * folder by hand and makes them public). Returns { urls, folderUrl }.
 */
export const syncFolder = (baseUrl, { id, folderUrl, rootFolderId, city, startDate }) =>
  post(baseUrl, {
    action: 'syncFolder',
    id,
    folderUrl,
    rootFolderId,
    city,
    startDate,
  });
