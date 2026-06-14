/**
 * Voyage — Travel Log & Leave Optimizer
 * Google Apps Script backend (serverless API over a single user-owned Sheet).
 *
 * ────────────────────────────────────────────────────────────────────────
 * SETUP
 * 1. Create a Google Sheet. Note its name; this script auto-creates a "Trips"
 *    tab and a hidden "Config" tab on first run.
 * 2. Extensions → Apps Script → paste this file as Code.gs.
 * 3. Set your secret token:
 *      a) Project Settings → Script properties → add  SECURE_TOKEN = <your-key>
 *      OR
 *      b) leave the HARDCODED_TOKEN constant below (less secure).
 *    The PWA must send the exact same token.
 * 4. Deploy → New deployment → type "Web app":
 *      - Execute as: Me
 *      - Who has access: Anyone  (token still gates every request)
 *    Copy the /exec URL into the PWA Settings → Apps Script URL.
 * ────────────────────────────────────────────────────────────────────────
 *
 * SECURITY MODEL
 * Apps Script web apps cannot read custom HTTP headers, so the shared secret
 * travels in the request body (POST) or query string (GET). Every entry point
 * validates it with a constant-time-ish comparison before touching the Sheet or
 * Drive. "Anyone" access is required for the PWA to reach the endpoint without a
 * Google login; the token is what actually authorizes the caller.
 */

// Fallback token if no Script Property is set. Prefer the Script Property.
var HARDCODED_TOKEN = 'CHANGE_ME_SET_A_STRONG_TOKEN';

var SHEET_TRIPS = 'Trips';
var SHEET_CONFIG = 'Config';
var DRIVE_ROOT = 'Travel_App_Media';

// Column order for the Trips sheet (row 1 = header).
var COLUMNS = [
  'remoteId',
  'localId',
  'city',
  'state',
  'country',
  'startDate',
  'endDate',
  'transit',
  'accommodation',
  'notes',
  'photos',
  'driveFolder',
  'updatedAt',
];

/* ── Entry points ─────────────────────────────────────────────────────── */

function doGet(e) {
  return route_(e, (e.parameter && e.parameter.action) || 'ping', e.parameter || {});
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Invalid JSON body', code: 'BAD_JSON' });
  }
  return route_(e, body.action, body);
}

/* ── Router + auth ────────────────────────────────────────────────────── */

function route_(e, action, params) {
  try {
    if (!checkToken_(params.token)) {
      return json_({ ok: false, error: 'Unauthorized: bad token', code: 'UNAUTHORIZED' });
    }
    switch (action) {
      case 'ping':
        return json_({ ok: true, message: 'Voyage backend connected ✓', time: new Date().toISOString() });
      case 'getTrips':
        return json_({ ok: true, trips: getTrips_() });
      case 'upsertTrip':
        return json_({ ok: true, remoteId: upsertTrip_(params.trip) });
      case 'deleteTrip':
        return json_({ ok: true, deleted: deleteTrip_(params.remoteId) });
      case 'uploadMedia':
        return json_({ ok: true, url: uploadMedia_(params.localId, params.image) });
      default:
        return json_({ ok: false, error: 'Unknown action: ' + action, code: 'UNKNOWN_ACTION' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err), code: 'SERVER_ERROR' });
  }
}

/**
 * Validate the supplied token against, in order:
 *   1. Script Property SECURE_TOKEN (recommended)
 *   2. A hidden cell Config!B1 (optional)
 *   3. HARDCODED_TOKEN constant
 */
function checkToken_(supplied) {
  if (!supplied) return false;
  var expected = PropertiesService.getScriptProperties().getProperty('SECURE_TOKEN');
  if (!expected) {
    try {
      var cfg = getOrCreateSheet_(SHEET_CONFIG);
      var cell = cfg.getRange('B1').getValue();
      if (cell) expected = String(cell);
    } catch (e) {}
  }
  if (!expected) expected = HARDCODED_TOKEN;
  return safeEquals_(String(supplied), String(expected));
}

// Length-aware comparison to reduce trivial timing leaks.
function safeEquals_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ── Sheet helpers ────────────────────────────────────────────────────── */

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet_(name) {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (name === SHEET_TRIPS) {
      sh.appendRow(COLUMNS);
      sh.setFrozenRows(1);
    }
    if (name === SHEET_CONFIG) {
      sh.getRange('A1').setValue('SECURE_TOKEN');
      sh.hideSheet();
    }
  }
  // Ensure header exists for Trips.
  if (name === SHEET_TRIPS && sh.getLastRow() === 0) {
    sh.appendRow(COLUMNS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function getTrips_() {
  var sh = getOrCreateSheet_(SHEET_TRIPS);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var header = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (!row[0] && !row[1] && !row[2]) continue; // skip blank rows
    var obj = {};
    for (var c = 0; c < header.length; c++) obj[header[c]] = row[c];
    // Normalize array-ish fields back to arrays for the client.
    obj.transit = splitCsv_(obj.transit);
    obj.photos = splitCsv_(obj.photos);
    obj.startDate = toIso_(obj.startDate);
    obj.endDate = toIso_(obj.endDate);
    out.push(obj);
  }
  return out;
}

/**
 * Insert or update a trip. Matches on remoteId, else localId; assigns a new
 * remoteId for fresh rows. Returns the remoteId.
 */
function upsertTrip_(trip) {
  if (!trip) throw new Error('Missing trip payload');
  var sh = getOrCreateSheet_(SHEET_TRIPS);
  var values = sh.getDataRange().getValues();
  var header = values[0];
  var idxRemote = header.indexOf('remoteId');
  var idxLocal = header.indexOf('localId');

  var remoteId = trip.remoteId || '';
  var targetRow = -1;
  for (var r = 1; r < values.length; r++) {
    if ((remoteId && String(values[r][idxRemote]) === String(remoteId)) ||
        (trip.localId && String(values[r][idxLocal]) === String(trip.localId))) {
      targetRow = r + 1; // 1-based sheet row
      remoteId = values[r][idxRemote] || remoteId;
      break;
    }
  }
  if (!remoteId) remoteId = 'T' + Date.now() + Math.floor(Math.random() * 1000);

  var rowData = COLUMNS.map(function (col) {
    if (col === 'remoteId') return remoteId;
    var v = trip[col];
    if (Array.isArray(v)) return v.join(',');
    return v == null ? '' : v;
  });

  if (targetRow === -1) {
    sh.appendRow(rowData);
  } else {
    sh.getRange(targetRow, 1, 1, COLUMNS.length).setValues([rowData]);
  }
  return remoteId;
}

function deleteTrip_(remoteId) {
  if (!remoteId) throw new Error('Missing remoteId');
  var sh = getOrCreateSheet_(SHEET_TRIPS);
  var values = sh.getDataRange().getValues();
  var header = values[0];
  var idxRemote = header.indexOf('remoteId');
  for (var r = values.length - 1; r >= 1; r--) {
    if (String(values[r][idxRemote]) === String(remoteId)) {
      sh.deleteRow(r + 1);
      return true;
    }
  }
  return false;
}

/* ── Drive media handling ─────────────────────────────────────────────── */

/**
 * Decode a base64 image, store it in
 *   Drive / Travel_App_Media / <folder> / <name>
 * make it publicly viewable, and append its URL to the matching trip row's
 * `photos` cell. Returns the public sharing URL.
 *
 * @param {string} localId   trip local id (to attach the URL to its row)
 * @param {{name,mimeType,base64,folder}} image
 */
function uploadMedia_(localId, image) {
  if (!image || !image.base64) throw new Error('Missing image payload');

  var root = getOrCreateFolder_(DriveApp.getRootFolder(), DRIVE_ROOT);
  var folderName = image.folder || ('misc_' + new Date().toISOString().slice(0, 10));
  var folder = getOrCreateFolder_(root, folderName);

  var raw = image.base64.indexOf('base64,') >= 0
    ? image.base64.split('base64,')[1]
    : image.base64;
  var bytes = Utilities.base64Decode(raw);
  var blob = Utilities.newBlob(bytes, image.mimeType || 'image/jpeg', image.name || ('photo_' + Date.now() + '.jpg'));

  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // Direct-view thumbnail URL that renders in <img>.
  var url = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1000';

  if (localId) appendPhotoToRow_(localId, url, folderName);
  return url;
}

function appendPhotoToRow_(localId, url, folderName) {
  var sh = getOrCreateSheet_(SHEET_TRIPS);
  var values = sh.getDataRange().getValues();
  var header = values[0];
  var idxLocal = header.indexOf('localId');
  var idxPhotos = header.indexOf('photos');
  var idxFolder = header.indexOf('driveFolder');
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idxLocal]) === String(localId)) {
      var existing = values[r][idxPhotos] ? String(values[r][idxPhotos]).split(',').filter(String) : [];
      existing.push(url);
      sh.getRange(r + 1, idxPhotos + 1).setValue(existing.join(','));
      if (folderName) sh.getRange(r + 1, idxFolder + 1).setValue(folderName);
      return;
    }
  }
}

function getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/* ── Utils ────────────────────────────────────────────────────────────── */

function splitCsv_(v) {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v;
  return String(v).split(',').map(function (s) { return s.trim(); }).filter(String);
}

function toIso_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
