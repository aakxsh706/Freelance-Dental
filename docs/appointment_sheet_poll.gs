/**
 * Booking sheet - Apps Script side of the PULL-based appointment sync (the
 * reverse of patient_sheet_webhook.gs, which pushes FROM Django).
 *
 * WHY A doGet AND NOT A doPost: the clinic PC runs this backend offline,
 * behind a home/office router - no port forwarding, no public IP. A push
 * FROM here would mean UrlFetchApp.fetch() - which runs on GOOGLE'S own
 * servers - reaching into 127.0.0.1 on a NAT'd PC, which can never work in
 * the real deployment (an earlier version of this integration tried exactly
 * that, and only "worked" because it was tested with both ends on the same
 * localhost machine). The clinic PC CAN make outbound calls to Google,
 * though - see patient_sheet_webhook.gs's one-way push in the other
 * direction - so the fix is to have Django ask instead of wait: this script
 * just answers "what's new" whenever it is asked, and Django asks it every
 * few minutes (backend/clinic/appointment_sheet_poll.py).
 *
 * Setup, once:
 *   1. Open the booking sheet, then Extensions > Apps Script.
 *   2. Replace the editor contents with this file.
 *   3. Set TOKEN below to the value of APPOINTMENT_SHEET_TOKEN in
 *      backend/.env. They must match.
 *   4. Deploy > New deployment > Web app, with *Execute as* "Me" and
 *      *Who has access* "Anyone". Copy the Web app URL into
 *      APPOINTMENT_SHEET_POLL_URL in backend/.env.
 *
 * That is the entire setup - no trigger of any kind needs installing, unlike
 * the old push version. Full instructions are in README.md under
 * "Appointment sheet sync".
 *
 * Expected sheet columns, in this order, header in row 1:
 *
 *   Patient Name | Phone | Email | Reason | Notes | Appointment Date |
 *   Appointment Time | Sync ID | Sync Status | Synced At
 *
 * The first 6 are filled in by the public website (or whoever/whatever
 * writes rows) when the booking is made. This script owns the last 3:
 *
 *   - Sync ID: a UUID assigned here, lazily, the first time a ready row (its
 *     first six columns filled in) is seen with no Sync ID yet. It is the
 *     idempotency key Django uses (Appointment.external_reference), so a row
 *     handed back by doGet more than once - which happens on purpose, see
 *     below - becomes at most one Appointment.
 *   - Sync Status / Synced At: written by the optional ?mark= call below,
 *     purely so staff glancing at the sheet can see which rows have landed.
 *     Correctness never depends on this: Django's own dedup by Sync ID is
 *     authoritative either way, so skipping this call, or it failing,
 *     cannot create a duplicate appointment or lose a booking.
 *
 * doGet returns every row that HAS a Sync ID, regardless of Sync Status -
 * deliberately not just the ones not yet marked Imported. That is simpler
 * than tracking "pending" here, and it is cheap and safe: Django re-sees
 * already-imported rows on every poll and reports them as duplicates rather
 * than erroring or double-booking.
 */

// Must match APPOINTMENT_SHEET_TOKEN in backend/.env.
var TOKEN = 'CHANGE_ME_TO_A_LONG_RANDOM_STRING';

// Column positions (1-indexed, matching the header row above).
var COL = {
  PATIENT_NAME: 1,
  PHONE: 2,
  EMAIL: 3,
  REASON: 4,
  NOTES: 5,
  APPOINTMENT_DATE: 6,
  APPOINTMENT_TIME: 7,
  SYNC_ID: 8,
  SYNC_STATUS: 9,
  SYNCED_AT: 10,
};
var WIDTH = 10;

var IMPORTED = 'Imported';

/**
 * GET <web app URL>?token=...
 *   -> assigns Sync IDs to any newly-ready row, then returns
 *      { ok: true, rows: [...] } for every row that has one.
 *
 * GET <web app URL>?token=...&mark=<syncId>
 *   -> an optional courtesy call Django makes right after it successfully
 *      imports that row, so Sync Status/Synced At reflect it on the sheet.
 *      Returns { ok: true } and touches nothing else. See the module
 *      comment above - this branch is cosmetic, never load-bearing.
 */
function doGet(e) {
  var token = (e && e.parameter && e.parameter.token) || '';
  if (!TOKEN || token !== TOKEN) {
    return jsonResponse({ ok: false, error: 'Bad or unconfigured token.' });
  }

  try {
    var mark = e.parameter.mark;
    if (mark) {
      markImported(String(mark));
      return jsonResponse({ ok: true });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    assignMissingSyncIds(sheet);
    return jsonResponse({ ok: true, rows: readSyncedRows(sheet) });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

/**
 * Assigns a Sync ID to every row whose first six columns are filled in but
 * which has none yet. Lock-guarded, same caution as the patient sync script
 * uses, so two overlapping polls cannot both decide the same row needs one.
 */
function assignMissingSyncIds(sheet) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return;
    }

    var all = sheet.getRange(2, 1, lastRow - 1, WIDTH).getValues();
    for (var i = 0; i < all.length; i++) {
      var values = all[i];
      var hasSyncId = String(values[COL.SYNC_ID - 1] || '').length > 0;
      if (hasSyncId) {
        continue;
      }

      var ready =
        String(values[COL.PATIENT_NAME - 1] || '').length > 0 &&
        String(values[COL.PHONE - 1] || '').length > 0 &&
        String(values[COL.EMAIL - 1] || '').length > 0 &&
        String(values[COL.REASON - 1] || '').length > 0 &&
        String(values[COL.APPOINTMENT_DATE - 1] || '').length > 0 &&
        String(values[COL.APPOINTMENT_TIME - 1] || '').length > 0;
      // Notes (column 5) is deliberately not required - it is optional on
      // the booking form.
      if (!ready) {
        continue;
      }

      var row = i + 2;
      sheet.getRange(row, COL.SYNC_ID).setValue(Utilities.getUuid());
    }
  } finally {
    lock.releaseLock();
  }
}

/** Every row with a Sync ID, in the JSON shape Django expects. */
function readSyncedRows(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  var all = sheet.getRange(2, 1, lastRow - 1, WIDTH).getValues();
  var rows = [];
  for (var i = 0; i < all.length; i++) {
    var values = all[i];
    var syncId = String(values[COL.SYNC_ID - 1] || '');
    if (!syncId) {
      continue;
    }
    rows.push(rowPayload(values, syncId));
  }
  return rows;
}

function rowPayload(values, syncId) {
  return {
    row_id: syncId,
    patient_name: String(values[COL.PATIENT_NAME - 1] || ''),
    phone: String(values[COL.PHONE - 1] || ''),
    email: String(values[COL.EMAIL - 1] || ''),
    reason: String(values[COL.REASON - 1] || ''),
    notes: String(values[COL.NOTES - 1] || ''),
    appointment_date: formatDateCell(values[COL.APPOINTMENT_DATE - 1]),
    appointment_time: formatTimeCell(values[COL.APPOINTMENT_TIME - 1]),
  };
}

/** Finds the row with this Sync ID and marks it Imported, if still present. */
function markImported(syncId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return;
    }
    var ids = sheet.getRange(2, COL.SYNC_ID, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0] || '') === syncId) {
        var row = i + 2;
        sheet.getRange(row, COL.SYNC_STATUS).setValue(IMPORTED);
        sheet.getRange(row, COL.SYNCED_AT).setValue(new Date());
        return;
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/** The backend wants YYYY-MM-DD; a date-formatted cell comes through as a
 * JS Date object, but a plain-text cell comes through as a string already
 * in that shape - handle both. */
function formatDateCell(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value || '').trim();
}

/** The backend wants HH:MM (24-hour); same two possible shapes as the date. */
function formatTimeCell(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
  }
  return String(value || '').trim();
}
