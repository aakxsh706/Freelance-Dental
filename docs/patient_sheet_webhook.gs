/**
 * Patient contact sheet - receiving end.
 *
 * Paste this into the sheet's own Apps Script project
 * (Extensions > Apps Script), set TOKEN below, then deploy it as a Web app.
 * Setup instructions are in README.md under "Patient sheet sync".
 *
 * The clinic runs offline and sends the FULL list of active patients whenever
 * it happens to have a connection, so this script must be safe to call
 * repeatedly with the same data. It reconciles rather than appends:
 *
 *   - rows are matched by patient code, so a patient edited while the clinic
 *     was offline is updated in place rather than added a second time;
 *   - a row whose values already match is left alone and counted as
 *     unchanged, so a sync with nothing to do writes nothing;
 *   - a call that fails halfway is corrected by the next one, because the
 *     clinic sends the whole desired state every time.
 *
 * Only contact details arrive here. No clinical data is sent.
 */

// Must match PATIENT_SHEET_WEBHOOK_TOKEN in backend/.env.
// Change both together; the script rejects anything else.
var TOKEN = 'CHANGE_ME_TO_A_LONG_RANDOM_STRING';

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return reply({ ok: false, error: 'Empty request.' });
    }

    var payload = JSON.parse(e.postData.contents);

    // The deployment has to be readable by "Anyone" for the clinic to reach
    // it without a Google login, so the token is the only thing standing
    // between this URL and anyone who finds it. Check it first, always.
    if (payload.token !== TOKEN) {
      return reply({ ok: false, error: 'Bad token.' });
    }

    var columns = payload.columns || [];
    var rows = payload.rows || [];
    if (!columns.length) {
      return reply({ ok: false, error: 'No columns supplied.' });
    }

    var lock = LockService.getScriptLock();
    // Two syncs overlapping would both read the sheet, both decide a patient
    // is missing, and both append them.
    lock.waitLock(30000);
    try {
      return reply(writeRows(columns, rows));
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function writeRows(columns, rows) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var width = columns.length;

  // Header, written once and rewritten if it drifts.
  var existingHeader = sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, width).getDisplayValues()[0]
    : [];
  if (!sameRow(existingHeader, columns)) {
    sheet.getRange(1, 1, 1, width).setValues([columns]);
    sheet.getRange(1, 1, 1, width).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  // Patient code -> sheet row number, built once rather than searching per
  // patient: a clinic with a few thousand records would otherwise make this
  // quadratic and time the request out.
  var lastRow = sheet.getLastRow();
  var existing = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, width).getDisplayValues()
    : [];

  var positionOf = {};
  for (var i = 0; i < existing.length; i++) {
    var code = String(existing[i][0] || '');
    if (code && !(code in positionOf)) {
      positionOf[code] = i + 2;
    }
  }

  var added = 0;
  var updated = 0;
  var unchanged = 0;
  var toAppend = [];

  for (var r = 0; r < rows.length; r++) {
    var row = padTo(rows[r], width);
    var key = String(row[0] || '');
    if (!key) {
      continue;
    }

    if (key in positionOf) {
      var line = positionOf[key];
      if (sameRow(existing[line - 2], row)) {
        unchanged++;
      } else {
        var target = sheet.getRange(line, 1, 1, width);
        target.setNumberFormat('@');
        target.setValues([row]);
        updated++;
      }
    } else {
      toAppend.push(row);
      added++;
    }
  }

  if (toAppend.length) {
    var appendRange = sheet.getRange(
      sheet.getLastRow() + 1, 1, toAppend.length, width);
    appendRange.setNumberFormat('@');
    appendRange.setValues(toAppend);
  }

  return { ok: true, added: added, updated: updated, unchanged: unchanged };
}

function padTo(row, width) {
  var out = (row || []).slice(0, width);
  while (out.length < width) {
    out.push('');
  }
  // Everything is written as text: a phone number like "+91 90000 00001" must
  // not be coerced into a number, and a patient code must not become a date.
  return out.map(function (value) {
    return value === null || value === undefined ? '' : String(value);
  });
}

function sameRow(a, b) {
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  for (var i = 0; i < a.length; i++) {
    var left = a[i] === undefined || a[i] === null ? '' : a[i];
    if (String(left) !== String(b[i])) {
      return false;
    }
  }
  return true;
}

function reply(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}
