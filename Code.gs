/**
 * Travel Log & Leave Optimizer — Google Apps Script backend.
 * ===========================================================
 * A single Web App deployment serves every operation, routed by an `action`
 * field. It owns one spreadsheet with two tabs and a Drive media directory.
 *
 * SHEET SCHEMA
 *   Tab "Trips":    ID | City | State_Country | Start_Date | End_Date |
 *                   Transport_Mode | Accommodation | Drive_Folder_URL | Photo_URLs
 *   Tab "Holidays": Date | Holiday_Name
 *
 * DEPLOYMENT
 *   1. Create a Google Sheet; note its ID (the long token in its URL).
 *   2. Extensions → Apps Script, paste this file, set SPREADSHEET_ID below.
 *   3. Run `setup()` once (authorize scopes; it creates tabs + headers).
 *   4. Deploy → New deployment → Web app:
 *        Execute as: Me   |   Who has access: Anyone
 *   5. Copy the /exec URL into the PWA's Settings → Apps Script URL.
 *
 * NOTE ON CORS: the PWA POSTs as text/plain (a "simple" request) so no
 * preflight is needed. We always reply with JSON.
 */

// ⬇️ EDIT THIS — or leave blank to bind to the container spreadsheet.
var SPREADSHEET_ID = '';

var TRIPS_TAB = 'Trips';
var HOLIDAYS_TAB = 'Holidays';
var CONFIG_TAB = 'Config';
var MEDIA_ROOT = 'Travel_App_Media';

// ── Security ─────────────────────────────────────────────────────────────────
// This Web App is deployed "Anyone" (no Google login) so the PWA can call it
// without OAuth/CORS friction. That means the /exec URL alone would let anyone
// who obtains it read or modify your trips. To prevent that, the API key lives
// in this spreadsheet's "Config" tab (cell next to SHARED_SECRET). Every request
// must carry a matching `token` or it is rejected.
//
// The key in the SHEET — not in this code — is the source of truth, so you only
// ever deploy this script ONCE. To create or rotate the key afterwards, use the
// "Travel App" menu that appears in the sheet (Generate / Show API key), then
// paste it into the PWA's Settings → "API access key" and click Verify. No more
// Apps Script edits or redeploys. An empty/missing key DISABLES the check.
var CONFIG_HEADERS = ['Key', 'Value'];

/** Ensure the Config tab exists and return it. */
function getConfigSheet() {
  var book = getBook();
  var sheet = book.getSheetByName(CONFIG_TAB);
  if (!sheet) {
    sheet = book.insertSheet(CONFIG_TAB);
    sheet.appendRow(CONFIG_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** Read any key/value from the Config tab ('' if missing). */
function getConfigValue(key) {
  var book = getBook();
  var sheet = book.getSheetByName(CONFIG_TAB);
  if (!sheet) return '';
  var values = sheet.getDataRange().getValues();
  for (var r = 0; r < values.length; r++) {
    if (String(values[r][0]).trim() === key) {
      return String(values[r][1] || '').trim();
    }
  }
  return '';
}

/** Read the shared secret from the Config tab. '' (missing/blank) = check off. */
function getSecret() {
  return getConfigValue('SHARED_SECRET');
}

/** Write/replace any key/value in the Config tab; returns the value. */
function setConfigValue(key, value) {
  var sheet = getConfigSheet();
  var values = sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]).trim() === key) {
      sheet.getRange(r + 1, 2).setValue(value);
      return value;
    }
  }
  sheet.appendRow([key, value]);
  return value;
}

/** Write/replace the shared secret in the Config tab; returns the value. */
function setSecret(value) {
  return setConfigValue('SHARED_SECRET', value);
}

/** A long random key (two UUIDs, hyphens stripped → 64 hex chars). */
function randomSecret() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

/** True when the request carries the right key (or no key is configured). */
function authorized(token) {
  var secret = getSecret();
  if (!secret) return true; // check disabled — generate a key from the sheet menu
  return String(token) === secret;
}

// ── Sheet menu: manage the API key without touching Apps Script ──────────────
// Reload the spreadsheet after deploying to see the "Travel App" menu.
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Travel App')
    .addItem('Show API key', 'showApiKey')
    .addItem('Generate / rotate API key', 'rotateApiKey')
    .addToUi();
}

function showApiKey() {
  var ui = SpreadsheetApp.getUi();
  var key = getSecret();
  if (!key) {
    ui.alert('No API key yet', 'Choose "Generate / rotate API key" to create one, then paste it into the app (Settings → API access key).', ui.ButtonSet.OK);
  } else {
    ui.alert('Your API key', key + '\n\nCopy it into the app: Settings → API access key, then click Verify.', ui.ButtonSet.OK);
  }
}

function rotateApiKey() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert('Generate a new API key?', 'This replaces any existing key. Each device/app then needs the new key pasted in before it can sync again.', ui.ButtonSet.OK_CANCEL);
  if (resp !== ui.Button.OK) return;
  var key = setSecret(randomSecret());
  ui.alert('New API key', key + '\n\nPaste it into the app: Settings → API access key, then click Verify.', ui.ButtonSet.OK);
}

var TRIP_HEADERS = [
  'ID', 'City', 'State_Country', 'Start_Date', 'End_Date',
  'Transport_Mode', 'Accommodation', 'Drive_Folder_URL', 'Photo_URLs',
  // Multi-vector track model (appended; existing rows read blank for these).
  'Origin_City', 'Operator_Name', 'Distance_KM', 'Layovers', 'Layover_Count_As_Visit',
  // Calendar sync: the source event id(s) — also flags a row as calendar-imported.
  'Google_Event_ID',
];
var HOLIDAY_HEADERS = ['Date', 'Holiday_Name'];

// ── Spreadsheet helpers ──────────────────────────────────────────────────────
function getBook() {
  return SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name, headers) {
  var book = getBook();
  var sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else if (headers && headers.length) {
    // Top-up the header row if columns were appended to the schema (so older
    // sheets pick up new fields like Origin_City/Distance_KM and round-trip them).
    var lastCol = sheet.getLastColumn();
    var current = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    if (current.length < headers.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  return sheet;
}

/** One-time initialiser — run manually from the editor to authorize + scaffold. */
function setup() {
  getSheet(TRIPS_TAB, TRIP_HEADERS);
  getSheet(HOLIDAYS_TAB, HOLIDAY_HEADERS);
  getConfigSheet();
  return 'Tabs ready.';
}

// ── Read all rows from a sheet into array-of-objects ─────────────────────────
function readObjects(sheet, headers) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var head = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.join('') === '') continue; // skip blank rows
    var obj = {};
    for (var c = 0; c < head.length; c++) {
      obj[head[c]] = formatCell(row[c]);
    }
    out.push(obj);
  }
  return out;
}

// Dates come back as JS Date objects; normalise to YYYY-MM-DD strings.
function formatCell(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return v === null || v === undefined ? '' : String(v);
}

// ── HTTP entry points ────────────────────────────────────────────────────────
function doGet(e) {
  try {
    if (!authorized(e && e.parameter && e.parameter.token)) {
      return json({ error: 'Unauthorized' });
    }
    var action = (e && e.parameter && e.parameter.action) || 'getAll';
    if (action === 'ping') {
      // Lightweight, side-effect-free check used by the app's "Verify" button.
      // Reaching here means the URL is valid and the key was accepted.
      return json({ ok: true });
    }
    if (action === 'getAll') {
      var trips = readObjects(getSheet(TRIPS_TAB, TRIP_HEADERS), TRIP_HEADERS);
      var holidays = readObjects(getSheet(HOLIDAYS_TAB, HOLIDAY_HEADERS), HOLIDAY_HEADERS);
      return json({ trips: trips, holidays: holidays });
    }
    return json({ error: 'Unknown action: ' + action });
  } catch (err) {
    return json({ error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (!authorized(body.token)) {
      return json({ error: 'Unauthorized' });
    }
    switch (body.action) {
      case 'saveTrip':
        return json({ trip: saveTrip(body.trip) });
      case 'deleteTrip':
        return json({ deleted: deleteTrip(body.id) });
      case 'uploadImage':
        return json({ url: uploadImage(body) });
      case 'syncFolder':
        return json(syncFolder(body));
      case 'parseTicket':
        return json(parseUploadedTicket(body));
      case 'syncCalendar':
        return json(syncTripsFromCalendar(body));
      default:
        return json({ error: 'Unknown action: ' + body.action });
    }
  } catch (err) {
    return json({ error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// ── Trip upsert / delete ─────────────────────────────────────────────────────
function findRowById(sheet, id) {
  var numRows = sheet.getLastRow() - 1; // exclude header
  if (numRows < 1) return -1; // header-only / empty sheet — nothing to scan
  var ids = sheet.getRange(2, 1, numRows, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2; // 1-based + header
  }
  return -1;
}

function tripToRow(trip) {
  return TRIP_HEADERS.map(function (h) {
    return trip[h] === undefined || trip[h] === null ? '' : trip[h];
  });
}

function saveTrip(trip) {
  var sheet = getSheet(TRIPS_TAB, TRIP_HEADERS);
  if (!trip.ID) trip.ID = 't_' + Date.now();
  var row = findRowById(sheet, trip.ID);
  var values = tripToRow(trip);
  if (row === -1) {
    sheet.appendRow(values);
  } else {
    sheet.getRange(row, 1, 1, TRIP_HEADERS.length).setValues([values]);
  }
  return trip;
}

function deleteTrip(id) {
  var sheet = getSheet(TRIPS_TAB, TRIP_HEADERS);
  var row = findRowById(sheet, id);
  if (row !== -1) sheet.deleteRow(row);
  return id;
}

// ── Drive media archiving ────────────────────────────────────────────────────
/** Get-or-create a folder by name under `parent` (or root). */
function getOrCreateFolder(name, parent) {
  var scope = parent || DriveApp.getRootFolder();
  var it = scope.getFoldersByName(name);
  return it.hasNext() ? it.next() : scope.createFolder(name);
}

/** Pull a Drive folder ID out of a folder URL (…/folders/<ID>). */
function folderIdFromUrl(url) {
  if (!url) return null;
  var m = String(url).match(/folders\/([A-Za-z0-9_\-]+)/);
  return m ? m[1] : null;
}

/** Resolve the parent folder: the user-configured root, else Travel_App_Media. */
function resolveRoot(rootFolderId) {
  if (rootFolderId) {
    try { return DriveApp.getFolderById(rootFolderId); } catch (e) { /* fall through */ }
  }
  return getOrCreateFolder(MEDIA_ROOT);
}

/** Per-trip sub-folder name: "<City>_<YYYY-MM>" (location + month-year). */
function tripFolderName(city, startDate) {
  var c = (city || 'Trip').replace(/[^\w\- ]/g, '').trim() || 'Trip';
  var ym = (startDate || '').slice(0, 7) || 'undated';
  return c + '_' + ym;
}

/**
 * Archive one image into <root>/<City>_<YYYY-MM>/, make it publicly viewable,
 * append the share URL to the trip's Photo_URLs cell, and return the URL.
 * `body.rootFolderId` (from Settings) is the parent; falls back to Travel_App_Media.
 * Called once per image (sequential queue) to stay under execution limits.
 */
function uploadImage(body) {
  var root = resolveRoot(body.rootFolderId);
  var folder = getOrCreateFolder(tripFolderName(body.city, body.startDate), root);

  var bytes = Utilities.base64Decode(body.base64);
  var blob = Utilities.newBlob(bytes, body.mime || 'image/jpeg',
    'photo_' + Date.now() + '.jpg');
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // Embeddable image URL usable directly in <img src>.
  // NOTE: the older `drive.google.com/uc?export=view&id=` link returns image
  // bytes to a server-side fetch but is BLOCKED from <img> embedding in a
  // browser (Google sends framing/disposition headers that fail the load).
  // The lh3 host renders reliably cross-origin. Append `=w1000` for a sized variant.
  var url = 'https://lh3.googleusercontent.com/d/' + file.getId();

  // Write back the folder URL + append the photo URL onto the trip row.
  var sheet = getSheet(TRIPS_TAB, TRIP_HEADERS);
  var row = findRowById(sheet, body.tripId);
  if (row !== -1) {
    var folderCol = TRIP_HEADERS.indexOf('Drive_Folder_URL') + 1;
    var photoCol = TRIP_HEADERS.indexOf('Photo_URLs') + 1;
    sheet.getRange(row, folderCol).setValue(folder.getUrl());
    var existing = String(sheet.getRange(row, photoCol).getValue() || '').trim();
    var merged = existing ? existing + ', ' + url : url;
    sheet.getRange(row, photoCol).setValue(merged);
  }
  return url;
}

/**
 * Re-read a trip's Drive folder and make the gallery mirror it. Lists every image
 * in the folder (resolved from the stored folder URL, or derived as
 * <root>/<City>_<YYYY-MM>/), ensures each is link-viewable (so photos the user
 * dropped into the folder by hand also become public), rewrites the row's
 * Photo_URLs to match, and returns the URLs.
 *   body = { id, folderUrl, rootFolderId, city, startDate }
 */
function syncFolder(body) {
  var folder = null;
  var fid = folderIdFromUrl(body.folderUrl);
  if (fid) {
    try { folder = DriveApp.getFolderById(fid); } catch (e) { folder = null; }
  }
  if (!folder) {
    // No stored folder — try to locate the derived sub-folder under the root.
    var root = resolveRoot(body.rootFolderId);
    var name = tripFolderName(body.city, body.startDate);
    var it = root.getFoldersByName(name);
    if (it.hasNext()) folder = it.next();
  }
  if (!folder) return { urls: [], folderUrl: '' };

  var files = folder.getFiles();
  var urls = [];
  while (files.hasNext()) {
    var f = files.next();
    if (f.getMimeType().indexOf('image/') === 0) {
      try {
        f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (e) { /* may already be shared or be a shortcut */ }
      urls.push('https://lh3.googleusercontent.com/d/' + f.getId());
    }
  }

  // Mirror the folder contents into the sheet row.
  if (body.id) {
    var sheet = getSheet(TRIPS_TAB, TRIP_HEADERS);
    var row = findRowById(sheet, body.id);
    if (row !== -1) {
      sheet.getRange(row, TRIP_HEADERS.indexOf('Drive_Folder_URL') + 1).setValue(folder.getUrl());
      sheet.getRange(row, TRIP_HEADERS.indexOf('Photo_URLs') + 1).setValue(urls.join(', '));
    }
  }
  return { urls: urls, folderUrl: folder.getUrl() };
}

// ── Gemini Flash ticket parser (opt-in) ──────────────────────────────────────
/**
 * Proxy a ticket/boarding-pass image (base64) to the Gemini Flash API and return
 * a structured journey object. DISABLED until you add a GEMINI_API_KEY row to the
 * Config tab (get a free key at aistudio.google.com). Optionally set GEMINI_MODEL
 * (default gemini-1.5-flash).
 *   body = { base64, mime, filename }
 *   returns { parsed: { transportMode, operatorName, originCity, destinationCity,
 *                       departureDate, arrivalDate, layovers[] } }  OR  { error }
 * NOTE: free-tier Gemini is NOT private — Google may use uploaded data. Opt in
 * consciously; ticket documents contain names/PNRs.
 */
function parseUploadedTicket(body) {
  var apiKey = getConfigValue('GEMINI_API_KEY');
  if (!apiKey) {
    return { error: 'AI ticket parser is off. Add a GEMINI_API_KEY row in the Config tab to enable it.' };
  }
  if (!body || !body.base64) return { error: 'No file data received' };

  // gemini-1.5-flash is retired for new API keys; default to a current model.
  // Override with a GEMINI_MODEL row in the Config tab if needed.
  var model = getConfigValue('GEMINI_MODEL') || 'gemini-2.0-flash';
  var prompt =
    'You parse travel tickets. From this ticket/boarding-pass/screenshot, extract the journey. ' +
    'Return ONLY a JSON object (no markdown, no backticks, no commentary) with EXACTLY these keys: ' +
    'transportMode (one of: flight, train, bus, car), operatorName, originCity, destinationCity, ' +
    'departureDate (YYYY-MM-DD), arrivalDate (YYYY-MM-DD or ""), layovers (array of city names, [] if none). ' +
    'Use full city names, not airport/station codes. Unknown fields = "" (or [] for layovers).';

  var payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: body.mime || 'image/jpeg', data: body.base64 } },
      ],
    }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  };
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    model + ':generateContent?key=' + encodeURIComponent(apiKey);

  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  if (resp.getResponseCode() !== 200) {
    var hint = resp.getResponseCode() === 404
      ? ' — set a GEMINI_MODEL row in Config (e.g. gemini-2.0-flash or gemini-2.5-flash).'
      : '';
    return { error: 'Gemini error ' + resp.getResponseCode() + ': ' + resp.getContentText().slice(0, 160) + hint };
  }

  var text;
  try {
    text = JSON.parse(resp.getContentText()).candidates[0].content.parts[0].text;
  } catch (e) {
    return { error: 'Empty / unexpected Gemini response' };
  }
  var parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    try {
      parsed = JSON.parse(String(text).replace(/```json|```/g, '').trim());
    } catch (e2) {
      return { error: 'Model did not return valid JSON' };
    }
  }
  return { parsed: parsed };
}

// ── Google Calendar sync (manual trigger only) ───────────────────────────────
/**
 * Crawl the user's default Google Calendar and import travel into the Trips tab.
 * MANUAL ONLY — invoked by the Timeline "📅 Calendar" button (action=syncCalendar);
 * there is no time-driven trigger.
 *
 *  • First sync (sheet empty or no CAL_LAST_SYNC in Config) crawls 4 YEARS back to
 *    today (+7 days) for full history; later syncs only scan since the last run
 *    (with a 2-day overlap buffer).
 *  • Dedupe: each imported row stores its source Google_Event_ID(s); events whose
 *    id is already present are skipped instantly.
 *  • 48-hour merge: events are clustered with a sliding 48h look-ahead, so a
 *    flight + its hotel (+ onward legs) to one place collapse into a single trip.
 *    Start_Date = earliest event, End_Date = latest checkout, City = the transport
 *    leg's destination, hotel names → Accommodation. All event ids stored for dedupe.
 *
 * First run will prompt for Calendar authorization (re-run setup() or just tap the
 * button and approve). Nothing leaves the user's Google account.
 */
/**
 * Run this ONCE from the Apps Script editor (Run ▸ authorizeCalendar) and approve
 * the prompt to grant the Calendar permission the web app needs. No data is written
 * — it just reads the calendar's name to trigger the OAuth consent screen. After
 * approving, the Timeline "📅 Calendar" button works.
 */
function authorizeCalendar() {
  var cal = CalendarApp.getDefaultCalendar();
  return 'Authorized ✓ — default calendar: ' + (cal ? cal.getName() : '(none found)');
}

function syncTripsFromCalendar(body) {
  var cal = CalendarApp.getDefaultCalendar();
  if (!cal) return { error: 'No default Google Calendar available' };
  var sheet = getSheet(TRIPS_TAB, TRIP_HEADERS);
  var tz = Session.getScriptTimeZone();

  // Already-imported event ids (cells may hold a comma-joined merge of ids).
  var data = sheet.getDataRange().getValues();
  var idCol = data[0].indexOf('Google_Event_ID');
  var seen = {};
  for (var r = 1; r < data.length; r++) {
    var cell = idCol >= 0 ? String(data[r][idCol] || '') : '';
    cell.split(',').forEach(function (id) {
      var t = id.trim();
      if (t) seen[t] = true;
    });
  }

  // Crawl window — deep on first sync, incremental afterward.
  var now = new Date();
  var lastSync = getConfigValue('CAL_LAST_SYNC');
  var firstSync = data.length < 2 || !lastSync;
  var start = firstSync
    ? new Date(now.getFullYear() - 4, now.getMonth(), now.getDate())
    : new Date(new Date(lastSync).getTime() - 2 * 864e5); // last run − 2 days
  var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);

  var events = cal.getEvents(start, end);
  // Collect classified travel events, sorted chronologically.
  var items = [];
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    if (seen[ev.getId()]) continue;
    var kind = classifyCalEvent(ev);
    if (kind !== 'transport' && kind !== 'lodging') continue;
    items.push({
      id: ev.getId(),
      kind: kind,
      start: ev.getStartTime(),
      end: ev.getEndTime(),
      title: ev.getTitle() || '',
      city: extractCity(ev),
      mode: kind === 'transport' ? calTransportMode(ev) : '',
    });
  }
  items.sort(function (a, b) { return a.start - b.start; });

  // Cluster with a 48h sliding look-ahead so a flight + its hotel (+ onward legs)
  // to the same place collapse into ONE trip instead of separate rows. Each event
  // joins the current cluster if it starts within 48h of the previous event.
  var WINDOW = 48 * 3600 * 1000;
  var clusters = [];
  var cur = null;
  for (var c = 0; c < items.length; c++) {
    var it = items[c];
    if (cur && it.start.getTime() <= cur.windowEnd) {
      cur.items.push(it);
      if (it.end.getTime() > cur.end.getTime()) cur.end = it.end;
      cur.windowEnd = it.start.getTime() + WINDOW;
    } else {
      cur = { items: [it], start: it.start, end: it.end, windowEnd: it.start.getTime() + WINDOW };
      clusters.push(cur);
    }
  }

  // One trip per cluster: City from the transport leg's destination (a hotel's
  // own name never becomes the City); hotel titles go into Accommodation; every
  // source event id is recorded so nothing re-imports next time.
  var rows = [];
  for (var q = 0; q < clusters.length; q++) {
    var cl = clusters[q];
    var leg = null;
    var hotels = [];
    var ids = [];
    for (var x = 0; x < cl.items.length; x++) {
      ids.push(cl.items[x].id);
      if (!leg && cl.items[x].kind === 'transport') leg = cl.items[x];
      if (cl.items[x].kind === 'lodging') hotels.push(cl.items[x].title);
    }
    var primary = leg || cl.items[0];
    rows.push({
      ID: 'cal_' + primary.id,
      City: (leg && leg.city) || primary.city || 'Trip',
      State_Country: '',
      Origin_City: '',
      Start_Date: Utilities.formatDate(cl.start, tz, 'yyyy-MM-dd'),
      End_Date: Utilities.formatDate(cl.end, tz, 'yyyy-MM-dd'),
      Transport_Mode: leg ? leg.mode : '',
      Operator_Name: '',
      Accommodation: '[CAL] ' + (hotels.filter(Boolean).join(', ') || 'Google Calendar'),
      Layover_Count_As_Visit: 'FALSE',
      Google_Event_ID: ids.join(','),
    });
  }

  for (var n = 0; n < rows.length; n++) saveTrip(rows[n]);

  // Clean up history: collapse any previously-imported calendar rows that belong
  // to the same trip (e.g. an old separate flight row + hotel row).
  var merged = remergeCalendarRows();

  setConfigValue('CAL_LAST_SYNC', Utilities.formatDate(now, tz, "yyyy-MM-dd'T'HH:mm:ss"));
  return {
    imported: rows.length,
    merged: merged,
    firstSync: firstSync,
    scannedFrom: Utilities.formatDate(start, tz, 'yyyy-MM-dd'),
  };
}

/**
 * Re-cluster existing calendar-synced rows (those carrying a Google_Event_ID) by
 * date proximity and collapse same-trip duplicates created by earlier, brittler
 * imports. Only touches calendar rows — manually-logged trips are never altered.
 * Returns the number of duplicate rows removed.
 */
function remergeCalendarRows() {
  var sheet = getSheet(TRIPS_TAB, TRIP_HEADERS);
  var data = sheet.getDataRange().getValues();
  var H = data[0];
  var col = {};
  ['ID', 'City', 'Start_Date', 'End_Date', 'Transport_Mode', 'Accommodation', 'Google_Event_ID'].forEach(function (k) {
    col[k] = H.indexOf(k);
  });
  if (col.Google_Event_ID < 0) return 0;

  // Gather calendar rows (keep the full row array so we can preserve other fields).
  var cal = [];
  for (var r = 1; r < data.length; r++) {
    if (!String(data[r][col.Google_Event_ID] || '').trim()) continue;
    var sd = String(data[r][col.Start_Date] || '');
    if (!sd) continue;
    cal.push({ row: data[r], start: sd, end: String(data[r][col.End_Date] || sd) });
  }
  if (cal.length < 2) return 0;
  cal.sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });

  // Cluster: a row joins the running cluster if it starts within 2 days of the
  // cluster's latest end (the same 48h cushion used at import time).
  var DAY = 864e5;
  var clusters = [];
  var cur = null;
  for (var i = 0; i < cal.length; i++) {
    var ts = new Date(cal[i].start).getTime();
    if (cur && ts <= cur.endMs + 2 * DAY) {
      cur.rows.push(cal[i]);
      cur.endMs = Math.max(cur.endMs, new Date(cal[i].end).getTime());
    } else {
      cur = { rows: [cal[i]], endMs: new Date(cal[i].end).getTime() };
      clusters.push(cur);
    }
  }

  var removed = 0;
  for (var c = 0; c < clusters.length; c++) {
    var group = clusters[c].rows;
    if (group.length < 2) continue;

    // Keeper = a row with a Transport_Mode (the leg → real city), else the first.
    var keeper = group.filter(function (g) { return String(g.row[col.Transport_Mode] || ''); })[0] || group[0];

    var minStart = group[0].start;
    var maxEnd = group[0].end;
    var ids = [];
    var accs = [];
    for (var j = 0; j < group.length; j++) {
      if (group[j].start < minStart) minStart = group[j].start;
      if (group[j].end > maxEnd) maxEnd = group[j].end;
      String(group[j].row[col.Google_Event_ID]).split(',').forEach(function (g) { if (g.trim()) ids.push(g.trim()); });
      var a = String(group[j].row[col.Accommodation] || '').replace(/^\[CAL\]\s*/, '').trim();
      if (a && a !== 'Google Calendar') accs.push(a);
    }

    // Rebuild the keeper from its FULL row (preserves State_Country, Operator, etc.),
    // then override the merged fields.
    var trip = {};
    for (var k = 0; k < H.length; k++) trip[H[k]] = keeper.row[k];
    trip.Start_Date = minStart;
    trip.End_Date = maxEnd;
    trip.Accommodation = '[CAL] ' + (accs.join(', ') || 'Google Calendar');
    trip.Google_Event_ID = ids.join(',');
    saveTrip(trip);

    // Delete the redundant rows.
    for (var m = 0; m < group.length; m++) {
      if (group[m] !== keeper) {
        deleteTrip(String(group[m].row[col.ID]));
        removed++;
      }
    }
  }
  return removed;
}

/** Classify a calendar event as 'transport' | 'lodging' | 'other' by its title. */
function classifyCalEvent(ev) {
  var t = ((ev.getTitle() || '') + ' ' + (ev.getLocation() || '')).toLowerCase();
  if (/\b(flight|fly|airport|airlines?|indigo|vistara|air india|spicejet|akasa|emirates|train|rail|express|vande bharat|shatabdi|rajdhani|bus|volvo|coach|road trip|drive to)\b/.test(t)) {
    return 'transport';
  }
  if (/\b(hotel|resort|reservation|stay|inn|lodge|airbnb|villa|homestay|check[- ]?in|check[- ]?out|booking)\b/.test(t)) {
    return 'lodging';
  }
  return 'other';
}

/**
 * Best-effort city. Prefers "… to <City>" in the title (transport legs), else the
 * city token inside a location/address. Addresses list the city near the end
 * ("Hotel, Street, Mumbai, Maharashtra, India"), so we pick the 3rd-from-last
 * part (before state + country), not the street at the front.
 */
function extractCity(ev) {
  var title = ev.getTitle() || '';
  var m = title.match(/\bto\s+([A-Za-z][A-Za-z .'\-]+)/);
  if (m) return m[1].trim().replace(/[,.]+$/, '');
  var loc = ev.getLocation() || '';
  if (loc) {
    var parts = loc.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (parts.length >= 3) return parts[parts.length - 3];
    if (parts.length === 2) return parts[1];
    if (parts.length === 1) return parts[0];
  }
  return title.trim();
}

/** Map a transport event title to a Transport_Mode. */
function calTransportMode(ev) {
  var t = (ev.getTitle() || '').toLowerCase();
  if (/train|rail|express|vande bharat|shatabdi|rajdhani/.test(t)) return 'Train';
  if (/bus|volvo|coach/.test(t)) return 'Bus';
  if (/road trip|drive|car|cab|taxi/.test(t)) return 'Car';
  return 'Flight';
}

