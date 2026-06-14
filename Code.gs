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
var MEDIA_ROOT = 'Travel_App_Media';

var TRIP_HEADERS = [
  'ID', 'City', 'State_Country', 'Start_Date', 'End_Date',
  'Transport_Mode', 'Accommodation', 'Drive_Folder_URL', 'Photo_URLs',
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
  }
  return sheet;
}

/** One-time initialiser — run manually from the editor to authorize + scaffold. */
function setup() {
  getSheet(TRIPS_TAB, TRIP_HEADERS);
  getSheet(HOLIDAYS_TAB, HOLIDAY_HEADERS);
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
    var action = (e && e.parameter && e.parameter.action) || 'getAll';
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
    switch (body.action) {
      case 'saveTrip':
        return json({ trip: saveTrip(body.trip) });
      case 'deleteTrip':
        return json({ deleted: deleteTrip(body.id) });
      case 'uploadImage':
        return json({ url: uploadImage(body) });
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

/**
 * Archive one image into Travel_App_Media/<YYYY-MM-DD>_<City>/, make it publicly
 * viewable, append the share URL to the trip's Photo_URLs cell, and return the URL.
 * Called once per image (sequential queue) to stay under execution limits.
 */
function uploadImage(body) {
  var city = (body.city || 'Trip').replace(/[^\w\- ]/g, '').trim() || 'Trip';
  var date = (body.startDate || '').slice(0, 10) || 'undated';
  var root = getOrCreateFolder(MEDIA_ROOT);
  var folder = getOrCreateFolder(date + '_' + city, root);

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
