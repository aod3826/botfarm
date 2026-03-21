const SHEET_NAME = "Matings";
const MATING_ID_PREFIX = "MT";
const MATING_ID_START = 1001;
const TIMEZONE = "Asia/Bangkok";

// วันคำนวณนัดหมาย
const DAYS_CHECK     = 21;   // ตรวจท้อง
const DAYS_CONFIRM   = 45;   // ตรวจยืนยัน
const DAYS_DUE       = 114;  // กำหนดคลอด

// ลำดับคอลัมน์ใน Sheet (เริ่มจาก 0)
const COLUMNS = {
  MATING_ID:     0,  // A
  DATE_RECORDED: 1,  // B
  MATING_DATE:   2,  // C
  SOW_ID:        3,  // D
  MATING_METHOD: 4,  // E
  SEMEN_BOAR_ID: 5,  // F
  CHECK_DATE:    6,  // G  (+21 วัน)
  CONFIRM_DATE:  7,  // H  (+45 วัน)
  DUE_DATE:      8,  // I  (+114 วัน)
  STATUS:        9,  // J
  CHECK_RESULT:  10, // K
  LAST_UPDATE:   11, // L
  RECORDED_BY:   12, // M
  NOTES:         13, // N
};

const STATUSES = {
  WAITING_CHECK:   "รอตรวจท้อง",
  PREGNANT:        "ตั้งท้อง",
  REMATE:          "ผสมซ้ำ",
  FARROWED:        "คลอดแล้ว",
};

const MATING_METHODS = {
  AI:      "ผสมเทียม",
  NATURAL: "ผสมจริง",
};

// ============================================
// Telegram API helpers
// ============================================

function getTelegramUrl() {
  return `https://api.telegram.org/bot${getBotToken()}`;
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(getSpreadsheetId());
}

function getMatingsSheet() {
  return getSpreadsheet().getSheetByName(SHEET_NAME);
}

function validateConfig() {
  const errors = [];
  const token = getBotToken();
  if (!token || token === "YOUR_BOT_TOKEN_HERE") {
    errors.push("BOT_TOKEN ยังไม่ได้ตั้งค่า");
  }
  if (!getSpreadsheetId() || getSpreadsheetId() === "YOUR_SPREADSHEET_ID_HERE") {
    errors.push("SPREADSHEET_ID ยังไม่ได้ตั้งค่า");
  }
  if (errors.length > 0) {
    throw new Error("ข้อผิดพลาดการตั้งค่า:\n" + errors.join("\n"));
  }
  return true;
}

// ============================================
// Script Properties helpers
// ============================================

function getScriptProperties() {
  return PropertiesService.getScriptProperties();
}

function setBotToken(token) {
  if (!token) throw new Error("Bot token ว่างเปล่า");
  getScriptProperties().setProperty("BOT_TOKEN", token);
}
function getBotToken() {
  return getScriptProperties().getProperty("BOT_TOKEN") || "YOUR_BOT_TOKEN_HERE";
}

function setWebhookUrl(url) {
  if (!url) throw new Error("Webhook URL ว่างเปล่า");
  getScriptProperties().setProperty("WEBHOOK_URL", url);
}
function getWebhookUrl() {
  return getScriptProperties().getProperty("WEBHOOK_URL") || "";
}

function setSpreadsheetId(id) {
  if (!id) throw new Error("Spreadsheet ID ว่างเปล่า");
  getScriptProperties().setProperty("SPREADSHEET_ID", id);
}
function getSpreadsheetId() {
  return getScriptProperties().getProperty("SPREADSHEET_ID") || "YOUR_SPREADSHEET_ID_HERE";
}

function setReportChatId(chatId) {
  getScriptProperties().setProperty("REPORT_CHAT_ID", chatId.toString());
}
function getReportChatId() {
  return getScriptProperties().getProperty("REPORT_CHAT_ID") || "";
}
