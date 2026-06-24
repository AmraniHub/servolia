/**
 * SERVOLIA — Google Apps Script Lead Receiver
 *
 * HOW TO SET UP (5 minutes):
 * 1. Go to sheets.google.com → create a new sheet named "Servolia Leads"
 * 2. Click Extensions → Apps Script
 * 3. Paste this entire script, click Save
 * 4. Click Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Click Deploy → copy the Web App URL
 * 6. Run: wrangler secret put GOOGLE_SHEETS_WEBHOOK_URL
 *    Paste the URL when prompted
 *
 * The sheet will auto-create these columns on first lead:
 * Timestamp | Name | Email | Business | Problem | Source
 */

const SHEET_NAME = "Leads";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      // Header row
      sheet.appendRow(["Timestamp", "Name", "Email", "Business", "Problem / Plan", "Source", "Status"]);
      sheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#080E1C").setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.name || "",
      data.email || "",
      data.business || "",
      data.problem || data.plan || "",
      data.source || "Website",
      "New",
    ]);

    // Auto-resize columns
    sheet.autoResizeColumns(1, 7);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "Servolia lead webhook active" }))
    .setMimeType(ContentService.MimeType.JSON);
}
