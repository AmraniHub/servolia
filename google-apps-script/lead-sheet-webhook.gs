/**
 * Servolia — lead backup webhook for Google Sheets.
 *
 * Mirrors every lead submitted through servolia.com (free-audit, contact,
 * intake, chatbot) into a Sheet as a live backup outside Supabase. This is
 * optional and fire-and-forget on the app side — see
 * src/app/api/contact/route.ts, step 3 ("Mirror to Google Sheets (backup)").
 * If this webhook is slow or down, lead capture in the CRM is unaffected.
 *
 * DEPLOY:
 *   1. Create a new Google Sheet (in your Workspace account).
 *   2. Extensions → Apps Script. Delete the placeholder code, paste this file.
 *   3. Deploy → New deployment → type "Web app".
 *        - Execute as: Me
 *        - Who has access: Anyone
 *      (This does NOT expose your sheet's contents publicly — it only
 *      accepts POST requests and appends rows. Nobody can read data back
 *      through this endpoint.)
 *   4. Copy the deployment URL it gives you.
 *   5. Set it as GOOGLE_SHEETS_WEBHOOK_URL in Vercel (Production env) —
 *      `vercel env add GOOGLE_SHEETS_WEBHOOK_URL production`, or via the
 *      Vercel dashboard. Redeploy servolia.com for it to take effect.
 */

// Fixed column order — anything in the payload not listed here still gets
// captured, JSON-stringified, in the trailing "extra_fields" column.
var COLUMNS = [
  "timestamp", "type", "source", "lead_id",
  "name", "email", "phone",
  "business", "businessName",
  "niche", "industry",
  "plan", "planName",
  "website", "websiteUrl",
  "country", "city", "language",
  "clientValue",
  "problem", "problems",
];

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(COLUMNS.concat(["extra_fields"]));
    }

    var data = JSON.parse(e.postData.contents);

    var row = COLUMNS.map(function (key) {
      var v = data[key];
      if (v === undefined || v === null) return "";
      if (Array.isArray(v)) return v.join(", ");
      return v;
    });

    var extra = {};
    for (var key in data) {
      if (COLUMNS.indexOf(key) === -1) extra[key] = data[key];
    }
    row.push(Object.keys(extra).length ? JSON.stringify(extra) : "");

    sheet.appendRow(row);

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
