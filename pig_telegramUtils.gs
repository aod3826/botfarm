// ============================================
// Send / Edit Messages
// ============================================

function sendMessage(chatId, text, options = {}) {
  const url = `${getTelegramUrl()}/sendMessage`;
  const payload = { chat_id: chatId, text: text, ...options };
  const params = { method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true };
  try {
    const response = UrlFetchApp.fetch(url, params);
    const result   = JSON.parse(response.getContentText());
    if (!result.ok) Logger.log("sendMessage error: " + JSON.stringify(result));
  } catch (e) {
    Logger.log("sendMessage exception: " + e.toString());
  }
}

function sendMessageWithKeyboard(chatId, text, keyboard, options = {}) {
  return sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard }, ...options });
}

function editMessage(chatId, messageId, text, options = {}) {
  const url = `${getTelegramUrl()}/editMessageText`;
  const payload = { chat_id: chatId, message_id: messageId, text: text, ...options };
  const params = { method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true };
  try {
    UrlFetchApp.fetch(url, params);
  } catch (e) {
    Logger.log("editMessage exception: " + e.toString());
  }
}

function answerCallbackQuery(callbackQueryId, text = "", showAlert = false) {
  const url = `${getTelegramUrl()}/answerCallbackQuery`;
  const payload = { callback_query_id: callbackQueryId, text: text, show_alert: showAlert };
  const params = { method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true };
  try {
    UrlFetchApp.fetch(url, params);
  } catch (e) {
    Logger.log("answerCallbackQuery exception: " + e.toString());
  }
}

// ============================================
// Format Mating Record Message
// ============================================

function formatMatingMessage(r) {
  const statusEmoji = {
    [STATUSES.WAITING_CHECK]: "🔍",
    [STATUSES.PREGNANT]:      "🤰",
    [STATUSES.REMATE]:        "🔄",
    [STATUSES.FARROWED]:      "🍼",
  };
  const emoji = statusEmoji[r.status] || "🐷";

  let msg = `🐷 *รายละเอียดการผสมพันธุ์*\n`;
  msg += `รหัส: \`${r.matingId}\`\n\n`;
  msg += `🏷️ *แม่พันธุ์:* ${r.sowId}\n`;
  msg += `📅 *วันที่ผสม:* ${r.matingDate}\n`;
  msg += `🔬 *วิธีผสม:* ${r.matingMethod}\n`;
  msg += `🧬 *รหัสน้ำเชื้อ/พ่อพันธุ์:* ${r.semenBoarId || "-"}\n`;
  msg += `${emoji} *สถานะ:* ${r.status}\n`;
  if (r.checkResult) msg += `🔍 *ผลตรวจท้อง:* ${r.checkResult}\n`;
  msg += `\n📅 *นัดหมายสำคัญ:*\n`;
  msg += `┣ ตรวจท้อง (+21 วัน): ${r.checkDate}\n`;
  msg += `┣ ตรวจยืนยัน (+45 วัน): ${r.confirmDate}\n`;
  msg += `┗ กำหนดคลอด (+114 วัน): ${r.dueDate}\n`;
  if (r.notes) msg += `\n📝 ${r.notes.split("\n").slice(-1)[0]}\n`; // แสดงแค่หมายเหตุล่าสุด
  msg += `\n_อัปเดต: ${r.lastUpdate}_`;
  return msg;
}

// ============================================
// Format List
// ============================================

function formatMatingList(records, title = "รายการ") {
  if (!records || records.length === 0) return "📭 ไม่พบรายการครับ";
  let msg = `📊 *${title}*\n\n`;
  records.forEach((r, i) => {
    msg += `${i + 1}. *${r.sowId}* — ผสม ${r.matingDate}\n`;
    msg += `   รหัส: \`${r.matingId}\` | สถานะ: ${r.status}\n`;
    msg += `   คลอด: ${r.dueDate}\n\n`;
  });
  return msg;
}

// ============================================
// Inline Keyboards
// ============================================

function createMatingActionKeyboard(matingId, currentStatus) {
  const keyboard = [];

  if (currentStatus === STATUSES.WAITING_CHECK) {
    // รอตรวจท้อง → ปุ่มบันทึกผลตรวจเป็นหลัก
    keyboard.push([
      { text: "✅ ตั้งท้อง",             callback_data: `check_${matingId}_ตั้งท้อง` },
      { text: "🔄 ไม่ตั้ง (ผสมซ้ำ)",     callback_data: `status_${matingId}_${STATUSES.REMATE}` },
    ]);
    keyboard.push([
      { text: "📝 เพิ่มหมายเหตุ",        callback_data: `note_${matingId}` },
    ]);

  } else if (currentStatus === STATUSES.PREGNANT) {
    // ตั้งท้อง → รอคลอด หรือเกิดปัญหา
    keyboard.push([
      { text: "🍼 คลอดแล้ว",            callback_data: `status_${matingId}_${STATUSES.FARROWED}` },
      { text: "🔄 ผสมซ้ำ",              callback_data: `status_${matingId}_${STATUSES.REMATE}` },
    ]);
    keyboard.push([
      { text: "📝 เพิ่มหมายเหตุ",        callback_data: `note_${matingId}` },
    ]);

  } else if (currentStatus === STATUSES.REMATE) {
    // ผสมซ้ำ → บันทึกการผสมใหม่ หรือตรวจใหม่
    keyboard.push([
      { text: "✅ ตั้งท้อง (ผสมซ้ำติด)", callback_data: `check_${matingId}_ตั้งท้อง` },
      { text: "📝 เพิ่มหมายเหตุ",        callback_data: `note_${matingId}` },
    ]);

  } else {
    // คลอดแล้ว หรืออื่นๆ → ปุ่มน้อยลง
    keyboard.push([
      { text: "📝 เพิ่มหมายเหตุ",        callback_data: `note_${matingId}` },
    ]);
  }

  return keyboard;
}
