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

  var model = getConfigValue('GEMINI_MODEL') || 'gemini-1.5-flash';
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
    return { error: 'Gemini error ' + resp.getResponseCode() + ': ' + resp.getContentText().slice(0, 180) };
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
 *  • 48-hour merge: a transport leg (flight/train/…) absorbs any lodging/onward leg
 *    to the SAME city starting within 48h — Start_Date = the leg's departure,
 *    End_Date = the latest checkout. Both event ids are recorded on the row.
 *
 * First run will prompt for Calendar authorization (re-run setup() or just tap the
 * button and approve). Nothing leaves the user's Google account.
 */
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
  var legs = [];
  var stays = [];
  for (var i = 0; i < events.length; i++) {
    if (seen[events[i].getId()]) continue;
    var kind = classifyCalEvent(events[i]);
    if (kind === 'transport') legs.push(events[i]);
    else if (kind === 'lodging') stays.push(events[i]);
  }

  var rows = [];
  var usedStay = {};

  // Each transport leg becomes a trip, merging a same-city stay within 48h.
  for (var j = 0; j < legs.length; j++) {
    var leg = legs[j];
    var city = extractCity(leg);
    var legStart = leg.getStartTime();
    var tripEnd = leg.getEndTime();
    var windowEnd = new Date(legStart.getTime() + 48 * 3600 * 1000);
    var ids = [leg.getId()];
    for (var k = 0; k < stays.length; k++) {
      var stay = stays[k];
      if (usedStay[stay.getId()]) continue;
      if (stay.getStartTime() >= legStart && stay.getStartTime() <= windowEnd && cityMatches(stay, city)) {
        if (stay.getEndTime() > tripEnd) tripEnd = stay.getEndTime(); // checkout = End_Date
        usedStay[stay.getId()] = true;
        ids.push(stay.getId());
      }
    }
    rows.push(buildCalRow(leg, city, legStart, tripEnd, ids, tz));
  }

  // Unmatched lodging → standalone stay trips (so hotel-only trips still appear).
  for (var m = 0; m < stays.length; m++) {
    if (usedStay[stays[m].getId()]) continue;
    var s = stays[m];
    rows.push(buildCalRow(s, extractCity(s), s.getStartTime(), s.getEndTime(), [s.getId()], tz));
  }

  for (var n = 0; n < rows.length; n++) saveTrip(rows[n]);

  setConfigValue('CAL_LAST_SYNC', Utilities.formatDate(now, tz, "yyyy-MM-dd'T'HH:mm:ss"));
  return { imported: rows.length, firstSync: firstSync, scannedFrom: Utilities.formatDate(start, tz, 'yyyy-MM-dd') };
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

/** Best-effort destination city: "… to <City>", else the event location, else title. */
function extractCity(ev) {
  var title = ev.getTitle() || '';
  var m = title.match(/\bto\s+([A-Za-z][A-Za-z .'\-]+)/);
  if (m) return m[1].trim().replace(/[,.]+$/, '');
  var loc = ev.getLocation() || '';
  if (loc) return loc.split(',')[0].trim();
  return title.trim();
}

/** Does a lodging event belong to `city`? (title or location mentions it). */
function cityMatches(stay, city) {
  if (!city) return false;
  var hay = ((stay.getTitle() || '') + ' ' + (stay.getLocation() || '')).toLowerCase();
  return hay.indexOf(city.toLowerCase()) !== -1;
}

/** Map a transport event title to a Transport_Mode. */
function calTransportMode(ev) {
  var t = (ev.getTitle() || '').toLowerCase();
  if (/train|rail|express|vande bharat|shatabdi|rajdhani/.test(t)) return 'Train';
  if (/bus|volvo|coach/.test(t)) return 'Bus';
  if (/road trip|drive|car|cab|taxi/.test(t)) return 'Car';
  return 'Flight';
}

/** Build a [CAL]-tagged trip row from an event + merge metadata. */
function buildCalRow(ev, city, startTime, endTime, eventIds, tz) {
  var trip = {};
  trip.ID = 'cal_' + ev.getId();
  trip.City = city || ev.getTitle() || 'Trip';
  trip.State_Country = ''; // left blank; the app autofills on edit
  trip.Origin_City = '';
  trip.Start_Date = Utilities.formatDate(startTime, tz, 'yyyy-MM-dd');
  trip.End_Date = Utilities.formatDate(endTime, tz, 'yyyy-MM-dd');
  trip.Transport_Mode = classifyCalEvent(ev) === 'transport' ? calTransportMode(ev) : '';
  trip.Operator_Name = '';
  trip.Accommodation = '[CAL] imported from Google Calendar';
  trip.Layover_Count_As_Visit = 'FALSE';
  trip.Google_Event_ID = (eventIds || [ev.getId()]).join(',');
  return trip;
}
