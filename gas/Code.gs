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
      case 'resyncCalendar':
        return json(resyncCalendar(body));
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
    String(idCol >= 0 ? data[r][idCol] || '' : '').split(',').forEach(function (id) {
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
    : new Date(new Date(lastSync).getTime() - 2 * 864e5);
  var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14);

  var events = cal.getEvents(start, end);

  // 1) Classify and COLLAPSE "(Day x/y)" series + duplicate copies. Events sharing
  //    the same base title + location are one logical journey/stay spanning all
  //    their day-parts (so an overnight flight or a 4-night hotel is a single leg).
  var groups = {};
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    if (seen[ev.getId()]) continue;
    var title = ev.getTitle() || '';
    var kind = calKind(title);
    if (!kind) continue; // not travel (e.g. a football match) — ignore
    var loc = ev.getLocation() || '';
    var key = kind + '|' + calBaseTitle(title) + '|' + loc;
    var g = groups[key];
    if (!g) {
      g = groups[key] = {
        kind: kind,
        mode: kind === 'transport' ? calMode(title) : '',
        dest: kind === 'transport' ? calDest(title) : calStayCity(title, loc),
        origin: kind === 'transport' ? calOrigin(loc) : '',
        operator: kind === 'transport' ? calOperator(title) : '',
        name: kind === 'lodging' ? calStayName(title) : '',
        start: ev.getStartTime(),
        end: ev.getEndTime(),
        ids: [],
      };
    }
    if (ev.getStartTime() < g.start) g.start = ev.getStartTime();
    if (ev.getEndTime() > g.end) g.end = ev.getEndTime();
    g.ids.push(ev.getId());
  }

  // 2) Sort logical events chronologically.
  var legsAndStays = Object.keys(groups).map(function (k) { return groups[k]; });
  legsAndStays.sort(function (a, b) { return a.start - b.start; });

  // 3) Cluster within a 48h sliding window → one trip per cluster.
  var WINDOW = 48 * 3600 * 1000;
  var clusters = [];
  var cur = null;
  for (var c = 0; c < legsAndStays.length; c++) {
    var e = legsAndStays[c];
    if (cur && e.start.getTime() <= cur.windowEnd) {
      cur.events.push(e);
      if (e.end.getTime() > cur.end.getTime()) cur.end = e.end;
      cur.windowEnd = e.start.getTime() + WINDOW;
    } else {
      cur = { events: [e], start: e.start, end: e.end, windowEnd: e.start.getTime() + WINDOW };
      clusters.push(cur);
    }
  }

  // 4) One rich trip row per cluster.
  var rows = [];
  for (var q = 0; q < clusters.length; q++) rows.push(buildClusterTrip(clusters[q], tz));

  // Snapshot existing rows (manual + prior calendar) for cross-source de-duping:
  // a calendar trip that overlaps an existing same-city trip is absorbed into it
  // rather than added as a duplicate.
  var H = data[0];
  var ci = { ID: H.indexOf('ID'), City: H.indexOf('City'), S: H.indexOf('Start_Date'), E: H.indexOf('End_Date') };
  var existing = [];
  for (var er = 1; er < data.length; er++) {
    var ec = String(data[er][ci.City] || '').trim();
    var es = String(data[er][ci.S] || '');
    if (!ec || !es) continue;
    var obj = {};
    for (var h = 0; h < H.length; h++) obj[H[h]] = data[er][h];
    existing.push({ cityLC: ec.toLowerCase(), start: es, end: String(data[er][ci.E] || es), obj: obj });
  }

  var imported = 0;
  var absorbed = 0;
  for (var n = 0; n < rows.length; n++) {
    var t = rows[n];
    var tc = String(t.City || '').toLowerCase();
    var match = null;
    for (var x = 0; x < existing.length && tc; x++) {
      var e = existing[x];
      var cityHit = e.cityLC === tc || e.cityLC.indexOf(tc) >= 0 || tc.indexOf(e.cityLC) >= 0;
      // date ranges intersect
      if (cityHit && e.start <= t.End_Date && e.end >= t.Start_Date) { match = e; break; }
    }
    if (match) {
      var m = match.obj;
      var gids = String(m.Google_Event_ID || '').split(',').concat(String(t.Google_Event_ID).split(','))
        .map(function (s) { return s.trim(); }).filter(Boolean);
      var u = {}, dedup = [];
      gids.forEach(function (g) { if (!u[g]) { u[g] = 1; dedup.push(g); } });
      m.Google_Event_ID = dedup.join(',');
      // Fill only blanks — never clobber your manual data / photos / dates.
      if (!String(m.Origin_City || '').trim()) m.Origin_City = t.Origin_City;
      if (!String(m.Operator_Name || '').trim()) m.Operator_Name = t.Operator_Name;
      if (!String(m.Layovers || '').trim()) m.Layovers = t.Layovers;
      if (!String(m.Transport_Mode || '').trim()) m.Transport_Mode = t.Transport_Mode;
      saveTrip(m);
      absorbed++;
    } else {
      saveTrip(t);
      existing.push({ cityLC: tc, start: t.Start_Date, end: t.End_Date, obj: t });
      imported++;
    }
  }

  setConfigValue('CAL_LAST_SYNC', Utilities.formatDate(now, tz, "yyyy-MM-dd'T'HH:mm:ss"));
  return {
    imported: imported,
    absorbed: absorbed,
    firstSync: firstSync,
    scannedFrom: Utilities.formatDate(start, tz, 'yyyy-MM-dd'),
  };
}

/** Assemble a trip row from a cluster of logical legs + stays. */
function buildClusterTrip(cl, tz) {
  var legs = [], stays = [], ids = [];
  for (var i = 0; i < cl.events.length; i++) {
    var e = cl.events[i];
    ids = ids.concat(e.ids);
    if (e.kind === 'transport') legs.push(e);
    else if (e.kind === 'lodging') stays.push(e);
  }
  var firstLeg = legs[0] || null;
  var lastLeg = legs.length ? legs[legs.length - 1] : null;
  var origin = firstLeg ? firstLeg.origin : '';

  // Destination: where you stayed, else the final leg's destination. For a round
  // trip with no stay (you flew out and back), the destination is the outbound city.
  var city = (stays.length && stays[0].dest) || (lastLeg && lastLeg.dest) || (cl.events[0] && cl.events[0].dest) || 'Trip';
  if (!stays.length && firstLeg && origin && city && city.toLowerCase() === origin.toLowerCase()) {
    city = firstLeg.dest;
  }

  // Layovers: intermediate transport destinations that aren't the origin or final city.
  var layovers = [];
  for (var j = 0; j < legs.length; j++) {
    var d = legs[j].dest;
    if (d && d.toLowerCase() !== (city || '').toLowerCase() && d.toLowerCase() !== (origin || '').toLowerCase() && layovers.indexOf(d) === -1) {
      layovers.push(d);
    }
  }

  var hotels = stays.map(function (s) { return s.name; }).filter(Boolean);
  var anchorId = firstLeg ? firstLeg.ids[0] : cl.events[0].ids[0];
  return {
    ID: 'cal_' + anchorId,
    City: city,
    State_Country: '',
    Origin_City: origin,
    Start_Date: Utilities.formatDate(cl.start, tz, 'yyyy-MM-dd'),
    End_Date: Utilities.formatDate(cl.end, tz, 'yyyy-MM-dd'),
    Transport_Mode: firstLeg ? firstLeg.mode : '',
    Operator_Name: firstLeg ? firstLeg.operator : '',
    Distance_KM: '',
    Layovers: layovers.join(', '),
    Layover_Count_As_Visit: 'FALSE',
    Accommodation: '[CAL]' + (hotels.length ? ' ' + hotels.join(', ') : ''),
    Google_Event_ID: ids.join(','),
  };
}

/** Delete every calendar-imported row and reset the sync cursor. Returns the count. */
function clearCalendarTrips() {
  var sheet = getSheet(TRIPS_TAB, TRIP_HEADERS);
  var data = sheet.getDataRange().getValues();
  var idIdx = data[0].indexOf('ID');
  var gidIdx = data[0].indexOf('Google_Event_ID');
  if (gidIdx < 0) return 0;
  var ids = [];
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][gidIdx] || '').trim()) ids.push(String(data[r][idIdx]));
  }
  for (var i = 0; i < ids.length; i++) deleteTrip(ids[i]);
  setConfigValue('CAL_LAST_SYNC', '');
  return ids.length;
}

/** Wipe all calendar imports, then run a fresh 4-year sync with the current logic. */
function resyncCalendar(body) {
  var removed = clearCalendarTrips();
  var res = syncTripsFromCalendar(body);
  res.removed = removed;
  return res;
}

// ── Calendar parsing helpers (tuned to "Flight/Train/Bus/Stay" event titles) ──

/** 'transport' | 'lodging' | '' (ignore) from the event title. */
function calKind(title) {
  var t = String(title).toLowerCase();
  if (/^\s*(flight|train|bus|drive|cab|taxi|road trip)\b/.test(t) || /\b(flight|train|bus)\s+to\b/.test(t)) return 'transport';
  if (/^\s*stay\b|\bstay at\b|\bhotel\b|\bcheck[- ]?in\b|\bcheck[- ]?out\b|\breservation\b/.test(t)) return 'lodging';
  return '';
}

/** Drop a trailing "(Day 1/2)" so day-parts of one event group together. */
function calBaseTitle(title) {
  return String(title).replace(/\s*\(day\s*\d+\s*\/\s*\d+\)\s*/i, ' ').replace(/\s+/g, ' ').trim();
}

/** Transport mode from the title prefix. */
function calMode(title) {
  var t = String(title).toLowerCase();
  if (/train/.test(t)) return 'Train';
  if (/bus|coach|volvo/.test(t)) return 'Bus';
  if (/drive|cab|taxi|road trip|car/.test(t)) return 'Car';
  return 'Flight';
}

/** Destination from "… to <City> (CODE)" → cleaned city. */
function calDest(title) {
  var m = String(title).match(/\bto\s+(.+?)(?:\s*\(|$)/i);
  return cleanPlace(m ? m[1] : title);
}

/** Origin city from the location field ("Kolkata CCU", "Jntu, Hyderabad", address). */
function calOrigin(loc) {
  if (!loc) return '';
  var parts = String(loc).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var pick = parts.length >= 3 ? parts[parts.length - 3] : parts[parts.length - 1];
  return cleanPlace(pick);
}

/** Hotel name = the title minus "Stay at " and any day-part. */
function calStayName(title) {
  return calBaseTitle(title).replace(/^stay at\s*/i, '').trim();
}

/** City for a stay: a trailing ", City" in the name, else the location's city. */
function calStayCity(title, loc) {
  var name = calStayName(title);
  var m = name.match(/,\s*([A-Za-z][A-Za-z .'\-]+)$/);
  if (m) return cleanPlace(m[1]);
  return calOrigin(loc);
}

/** Strip trailing airport/station codes ("(SRC)", " CCU") and title-case ALL-CAPS. */
function cleanPlace(s) {
  s = String(s || '').replace(/\s*\([A-Z0-9]+\)\s*$/, '').replace(/\s+[A-Z]{3}$/, '').replace(/[,.]+$/, '').trim();
  if (s && s === s.toUpperCase() && /[A-Z]/.test(s)) {
    s = s.toLowerCase().replace(/\b\w/g, function (ch) { return ch.toUpperCase(); });
  }
  return s;
}

/** Airline name from a flight code "(6E 6154)". */
function calOperator(title) {
  var m = String(title).match(/\(([0-9A-Z]{2})\s?\d{2,4}\)/);
  var map = { '6E': 'IndiGo', 'AI': 'Air India', 'IX': 'Air India Express', 'UK': 'Vistara', 'SG': 'SpiceJet', 'QP': 'Akasa Air', 'G8': 'Go First', '9I': 'Alliance Air' };
  return m ? (map[m[1]] || '') : '';
}

