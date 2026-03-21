// ============================================
// Create Mating Record
// ============================================

function createMatingRecord(userId, data) {
  const sheet = getMatingsSheet();
  const matingId = generateMatingId(sheet);
  const now = new Date();
  const dateRecorded = Utilities.formatDate(now, TIMEZONE, "dd/MM/yyyy");
  const lastUpdate   = Utilities.formatDate(now, TIMEZONE, "dd/MM/yyyy HH:mm");

  // คำนวณวันนัดหมายจากวันผสม
  const matingDateObj = parseDateToObject(data.matingDate);
  const checkDate   = addDays(matingDateObj, DAYS_CHECK);
  const confirmDate = addDays(matingDateObj, DAYS_CONFIRM);
  const dueDate     = addDays(matingDateObj, DAYS_DUE);

  const checkDateStr   = Utilities.formatDate(checkDate,   TIMEZONE, "dd/MM/yyyy");
  const confirmDateStr = Utilities.formatDate(confirmDate, TIMEZONE, "dd/MM/yyyy");
  const dueDateStr     = Utilities.formatDate(dueDate,     TIMEZONE, "dd/MM/yyyy");

  const rowData = new Array(14).fill("");
  rowData[COLUMNS.MATING_ID]     = matingId;
  rowData[COLUMNS.DATE_RECORDED] = dateRecorded;
  rowData[COLUMNS.MATING_DATE]   = data.matingDate;
  rowData[COLUMNS.SOW_ID]        = data.sowId;
  rowData[COLUMNS.MATING_METHOD] = data.matingMethod;
  rowData[COLUMNS.SEMEN_BOAR_ID] = data.semenBoarId || "";
  rowData[COLUMNS.CHECK_DATE]    = checkDateStr;
  rowData[COLUMNS.CONFIRM_DATE]  = confirmDateStr;
  rowData[COLUMNS.DUE_DATE]      = dueDateStr;
  rowData[COLUMNS.STATUS]        = STATUSES.WAITING_CHECK;
  rowData[COLUMNS.CHECK_RESULT]  = "";
  rowData[COLUMNS.LAST_UPDATE]   = lastUpdate;
  rowData[COLUMNS.RECORDED_BY]   = userId.toString();
  rowData[COLUMNS.NOTES]         = data.notes || "";

  sheet.appendRow(rowData);

  return {
    matingId, dateRecorded,
    matingDate:   data.matingDate,
    sowId:        data.sowId,
    matingMethod: data.matingMethod,
    semenBoarId:  data.semenBoarId || "",
    checkDate:    checkDateStr,
    confirmDate:  confirmDateStr,
    dueDate:      dueDateStr,
    status:       STATUSES.WAITING_CHECK,
    recordedBy:   userId.toString(),
    notes:        data.notes || "",
  };
}

// ============================================
// ID Generator
// ============================================

function generateMatingId(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return MATING_ID_PREFIX + MATING_ID_START;
  let maxId = MATING_ID_START - 1;
  for (let i = 1; i < data.length; i++) {
    const id = data[i][COLUMNS.MATING_ID];
    if (id && id.toString().startsWith(MATING_ID_PREFIX)) {
      const num = parseInt(id.toString().substring(MATING_ID_PREFIX.length));
      if (!isNaN(num) && num > maxId) maxId = num;
    }
  }
  return MATING_ID_PREFIX + (maxId + 1);
}

// ============================================
// Find / Search
// ============================================

function findRecordsBySowId(sowId) {
  const sheet = getMatingsSheet();
  const data = sheet.getDataRange().getValues();
  const results = [];
  const search = sowId.toUpperCase();
  for (let i = 1; i < data.length; i++) {
    if ((data[i][COLUMNS.SOW_ID] || "").toString().toUpperCase().includes(search)) {
      results.push(parseRecordFromRow(data[i], i + 1));
    }
  }
  return results;
}

function getRecordById(matingId) {
  const sheet = getMatingsSheet();
  const data = sheet.getDataRange().getValues();
  const searchId = (matingId || "").toString().trim();
  for (let i = 1; i < data.length; i++) {
    if ((data[i][COLUMNS.MATING_ID] || "").toString().trim() === searchId) {
      return parseRecordFromRow(data[i], i + 1);
    }
  }
  return null;
}

function getRecordsByUser(userId) {
  const sheet = getMatingsSheet();
  const data = sheet.getDataRange().getValues();
  const results = [];
  const userIdStr = (userId || "").toString().trim();
  for (let i = 1; i < data.length; i++) {
    if ((data[i][COLUMNS.RECORDED_BY] || "").toString().trim() === userIdStr) {
      results.push(parseRecordFromRow(data[i], i + 1));
    }
  }
  return results;
}

function getRecordsByStatus(status) {
  const sheet = getMatingsSheet();
  const data = sheet.getDataRange().getValues();
  const results = [];
  const target = status.toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if ((data[i][COLUMNS.STATUS] || "").toString().toLowerCase() === target) {
      results.push(parseRecordFromRow(data[i], i + 1));
    }
  }
  return results;
}

// ============================================
// Today's Appointments
// ============================================

function getTodayAppointments() {
  const sheet = getMatingsSheet();
  const data = sheet.getDataRange().getValues();
  const today = Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy");
  const result = { checks: [], confirms: [], farrowings: [] };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = (row[COLUMNS.STATUS] || "").toString();
    if (status === STATUSES.FARROWED) continue;

    const checkDate   = fmtDate(row[COLUMNS.CHECK_DATE]);
    const confirmDate = fmtDate(row[COLUMNS.CONFIRM_DATE]);
    const dueDate     = fmtDate(row[COLUMNS.DUE_DATE]);

    if (checkDate === today)   result.checks.push(parseRecordFromRow(row, i + 1));
    if (confirmDate === today)  result.confirms.push(parseRecordFromRow(row, i + 1));
    if (dueDate === today)      result.farrowings.push(parseRecordFromRow(row, i + 1));
  }
  return result;
}

// ============================================
// Upcoming Appointments (7 days)
// ============================================

function getUpcomingAppointments(days) {
  const sheet = getMatingsSheet();
  const data  = sheet.getDataRange().getValues();
  const now   = new Date();
  now.setHours(0, 0, 0, 0);

  // สร้าง Set วันที่ในช่วง 1-N วันข้างหน้า (ไม่รวมวันนี้)
  const dateSet = {};
  for (let d = 1; d <= days; d++) {
    const dt = new Date(now.getTime());
    dt.setDate(dt.getDate() + d);
    const key = Utilities.formatDate(dt, TIMEZONE, "dd/MM/yyyy");
    dateSet[key] = d; // เก็บว่าอีกกี่วัน
  }

  // จัดกลุ่มตามวันที่ (key = "dd/MM/yyyy")
  const byDate = {};

  for (let i = 1; i < data.length; i++) {
    const row    = data[i];
    const status = (row[COLUMNS.STATUS] || "").toString();
    if (status === STATUSES.FARROWED) continue;

    const record = parseRecordFromRow(row, i + 1);

    [
      { date: record.checkDate,   type: "check" },
      { date: record.confirmDate, type: "confirm" },
      { date: record.dueDate,     type: "farrow" },
    ].forEach(({ date, type }) => {
      if (date && dateSet[date] !== undefined) {
        if (!byDate[date]) byDate[date] = { daysFromNow: dateSet[date], items: [] };
        byDate[date].items.push({ ...record, apptType: type });
      }
    });
  }

  // เรียงตามวันที่
  return Object.keys(byDate)
    .sort((a, b) => byDate[a].daysFromNow - byDate[b].daysFromNow)
    .map(date => ({ date, daysFromNow: byDate[date].daysFromNow, items: byDate[date].items }));
}

// ============================================
// Monthly Report
// ============================================

function getMonthlyReport() {
  const sheet = getMatingsSheet();
  const data  = sheet.getDataRange().getValues();
  const now   = new Date();
  const thisMonth = Utilities.formatDate(now, TIMEZONE, "MM/yyyy");

  const report = {
    month: Utilities.formatDate(now, TIMEZONE, "MM/yyyy"),
    totalMated:    0,   // ผสมในเดือนนี้
    pregnant:      0,   // ตั้งท้องอยู่
    farrowed:      0,   // คลอดในเดือนนี้
    remate:        0,   // ผสมซ้ำ
    waitingCheck:  0,   // รอตรวจท้อง
    pregnancyRate: 0,   // อัตราตั้งท้อง (%)
    upcomingFarrow: [],  // กำหนดคลอดที่เหลือในเดือนนี้
  };

  let confirmedPreg = 0;

  for (let i = 1; i < data.length; i++) {
    const row    = data[i];
    const record = parseRecordFromRow(row, i + 1);
    if (!record.matingId) continue;

    const matingMonth = record.matingDate ? record.matingDate.substring(3) : ""; // MM/yyyy

    // ผสมในเดือนนี้
    if (matingMonth === thisMonth) {
      report.totalMated++;
    }

    // สถานะปัจจุบัน
    switch (record.status) {
      case STATUSES.PREGNANT:      report.pregnant++;     break;
      case STATUSES.REMATE:        report.remate++;       break;
      case STATUSES.WAITING_CHECK: report.waitingCheck++; break;
      case STATUSES.FARROWED: {
        // คลอดในเดือนนี้ — ครอบด้วย {} เพื่อให้ const ใช้ได้ใน case
        const lastUpdate = record.lastUpdate || "";
        if (lastUpdate.substring(3, 10) === thisMonth) {
          report.farrowed++;
        }
        break;
      }
    }

    // คำนวณอัตราตั้งท้อง (จากที่ผสมแล้วรู้ผล)
    if (record.checkResult === "ตั้งท้อง") confirmedPreg++;

    // กำหนดคลอดที่เหลือในเดือนนี้
    if (record.dueDate && record.status !== STATUSES.FARROWED) {
      const dueMonth = record.dueDate.substring(3); // MM/yyyy
      if (dueMonth === thisMonth) {
        report.upcomingFarrow.push(record);
      }
    }
  }

  // อัตราตั้งท้อง — คิดจากทั้งหมดที่ตรวจผลแล้ว
  const checkedAll = data.slice(1).filter(row => {
    const r = parseRecordFromRow(row, 0);
    return r.checkResult === "ตั้งท้อง" || r.status === STATUSES.REMATE;
  }).length;
  report.pregnancyRate = checkedAll > 0
    ? Math.round((confirmedPreg / checkedAll) * 100)
    : 0;

  return report;
}

// ============================================
// Update Operations
// ============================================

function updateRecordStatus(matingId, newStatus) {
  const sheet = getMatingsSheet();
  const data = sheet.getDataRange().getValues();
  const searchId = (matingId || "").toString().trim();
  for (let i = 1; i < data.length; i++) {
    if ((data[i][COLUMNS.MATING_ID] || "").toString().trim() === searchId) {
      const row = i + 1;
      sheet.getRange(row, COLUMNS.STATUS + 1).setValue(newStatus);
      sheet.getRange(row, COLUMNS.LAST_UPDATE + 1).setValue(
        Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy HH:mm")
      );
      return true;
    }
  }
  return false;
}

function updateCheckResult(matingId, result) {
  const sheet = getMatingsSheet();
  const data = sheet.getDataRange().getValues();
  const searchId = (matingId || "").toString().trim();
  for (let i = 1; i < data.length; i++) {
    if ((data[i][COLUMNS.MATING_ID] || "").toString().trim() === searchId) {
      const row = i + 1;
      sheet.getRange(row, COLUMNS.CHECK_RESULT + 1).setValue(result);
      const newStatus = result === "ตั้งท้อง" ? STATUSES.PREGNANT : STATUSES.REMATE;
      sheet.getRange(row, COLUMNS.STATUS + 1).setValue(newStatus);
      sheet.getRange(row, COLUMNS.LAST_UPDATE + 1).setValue(
        Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy HH:mm")
      );
      return true;
    }
  }
  return false;
}

function addNoteToRecord(matingId, note) {
  const sheet = getMatingsSheet();
  const data = sheet.getDataRange().getValues();
  const searchId = (matingId || "").toString().trim();
  for (let i = 1; i < data.length; i++) {
    if ((data[i][COLUMNS.MATING_ID] || "").toString().trim() === searchId) {
      const row = i + 1;
      const existing = data[i][COLUMNS.NOTES] || "";
      const timestamp = Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy HH:mm");
      const newNote = `[${timestamp}] ${note}`;
      sheet.getRange(row, COLUMNS.NOTES + 1).setValue(existing ? `${existing}\n${newNote}` : newNote);
      sheet.getRange(row, COLUMNS.LAST_UPDATE + 1).setValue(timestamp);
      return true;
    }
  }
  return false;
}

// ============================================
// Daily Reminder (Time-based Trigger)
// ============================================

function sendDailyReminders() {
  try {
    const reportChatId = getReportChatId();
    if (!reportChatId) return;

    const today = Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy");
    const appts = getTodayAppointments();
    const upcoming = getUpcomingAppointments(3); // แจ้งล่วงหน้า 3 วัน
    const totalToday = appts.checks.length + appts.confirms.length + appts.farrowings.length;
    const totalUpcoming = upcoming.reduce((s, g) => s + g.items.length, 0);

    // ถ้าไม่มีอะไรเลย ไม่ต้องส่ง
    if (totalToday === 0 && totalUpcoming === 0) return;

    const typeLabel = { check: "🔍 ตรวจท้อง", confirm: "✅ ตรวจยืนยัน", farrow: "🍼 กำหนดคลอด" };
    let msg = `🐷 *รายงานประจำวัน ${today}*\n\n`;

    // ── วันนี้ ──
    if (totalToday > 0) {
      msg += `*📅 นัดวันนี้ (${totalToday} รายการ):*\n`;
      if (appts.checks.length > 0) {
        msg += `🔍 ตรวจท้อง ${appts.checks.length} ตัว:\n`;
        appts.checks.forEach(r => { msg += `  • ${r.sowId} (\`${r.matingId}\`) ผสม ${r.matingDate}\n`; });
      }
      if (appts.confirms.length > 0) {
        msg += `✅ ตรวจยืนยัน ${appts.confirms.length} ตัว:\n`;
        appts.confirms.forEach(r => { msg += `  • ${r.sowId} (\`${r.matingId}\`) ผสม ${r.matingDate}\n`; });
      }
      if (appts.farrowings.length > 0) {
        msg += `🍼 กำหนดคลอด ${appts.farrowings.length} ตัว:\n`;
        appts.farrowings.forEach(r => { msg += `  • ${r.sowId} (\`${r.matingId}\`) ผสม ${r.matingDate}\n`; });
      }
      msg += "\n";
    }

    // ── 3 วันข้างหน้า ──
    if (totalUpcoming > 0) {
      msg += `*🗓️ นัดใน 3 วันข้างหน้า (${totalUpcoming} รายการ):*\n`;
      upcoming.forEach(g => {
        const dayLabel = g.daysFromNow === 1 ? "พรุ่งนี้" : `อีก ${g.daysFromNow} วัน`;
        msg += `📆 ${g.date} — ${dayLabel}\n`;
        g.items.forEach(r => {
          msg += `  • ${typeLabel[r.apptType]} *${r.sowId}* (\`${r.matingId}\`)\n`;
        });
      });
    }

    sendMessage(reportChatId, msg, { parse_mode: "Markdown" });
  } catch (error) {
    Logger.log("sendDailyReminders error: " + error.toString());
  }
}

// ============================================
// Parse Row to Object
// ============================================

/**
 * แปลง Date Object ที่ GAS ส่งกลับจาก getValues() ให้เป็น String dd/MM/yyyy
 * (Google Sheets คืนค่าเซลล์ที่เป็นวันที่เป็น Date Object อัตโนมัติ)
 */
function fmtDate(val) {
  if (!val) return "";
  if (val instanceof Date) return Utilities.formatDate(val, TIMEZONE, "dd/MM/yyyy");
  return val.toString();
}

function fmtDateTime(val) {
  if (!val) return "";
  if (val instanceof Date) return Utilities.formatDate(val, TIMEZONE, "dd/MM/yyyy HH:mm");
  return val.toString();
}

function parseRecordFromRow(row, rowNumber) {
  return {
    rowNumber,
    matingId:     (row[COLUMNS.MATING_ID]     || "").toString(),
    dateRecorded: fmtDate(row[COLUMNS.DATE_RECORDED]),
    matingDate:   fmtDate(row[COLUMNS.MATING_DATE]),
    sowId:        (row[COLUMNS.SOW_ID]        || "").toString(),
    matingMethod: (row[COLUMNS.MATING_METHOD] || "").toString(),
    semenBoarId:  (row[COLUMNS.SEMEN_BOAR_ID] || "").toString(),
    checkDate:    fmtDate(row[COLUMNS.CHECK_DATE]),
    confirmDate:  fmtDate(row[COLUMNS.CONFIRM_DATE]),
    dueDate:      fmtDate(row[COLUMNS.DUE_DATE]),
    status:       (row[COLUMNS.STATUS]        || "").toString(),
    checkResult:  (row[COLUMNS.CHECK_RESULT]  || "").toString(),
    lastUpdate:   fmtDateTime(row[COLUMNS.LAST_UPDATE]),
    recordedBy:   (row[COLUMNS.RECORDED_BY]   || "").toString(),
    notes:        (row[COLUMNS.NOTES]         || "").toString(),
  };
}

// ============================================
// Date Helpers
// ============================================

function parseDateToObject(dateStr) {
  // รับรูปแบบ dd/MM/yyyy
  const parts = dateStr.split("/");
  return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
}

function addDays(dateObj, days) {
  const result = new Date(dateObj.getTime());
  result.setDate(result.getDate() + days);
  return result;
}
