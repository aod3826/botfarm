// ============================================
// /find [เบอร์หูแม่พันธุ์]
// ============================================

function handleFindCommand(chatId, searchTerm) {
  if (!searchTerm || !searchTerm.trim()) {
    sendMessage(chatId, "❌ กรุณาระบุเบอร์หูแม่พันธุ์ด้วยครับ\nวิธีใช้: /find [เบอร์หู]");
    return;
  }

  try {
    const records = findRecordsBySowId(searchTerm.trim());

    if (records.length === 0) {
      sendMessage(chatId, `📭 ไม่พบข้อมูลแม่พันธุ์เบอร์ "${searchTerm.trim()}" ครับ`);
      return;
    }

    if (records.length === 1) {
      const r = records[0];
      const message = formatMatingMessage(r);
      const keyboard = createMatingActionKeyboard(r.matingId, r.status);
      sendMessageWithKeyboard(chatId, message, keyboard, { parse_mode: "Markdown" });
    } else {
      // หลายรายการ — แสดงรายการล่าสุดก่อน
      const sorted = records.sort((a, b) => b.matingId.localeCompare(a.matingId));
      const message = formatMatingList(sorted, `ผลค้นหา "${searchTerm.trim()}"`);
      sendMessage(chatId, message, { parse_mode: "Markdown" });
    }
  } catch (error) {
    Logger.log("handleFindCommand error: " + error.toString());
    sendMessage(chatId, "❌ เกิดข้อผิดพลาดในการค้นหา กรุณาลองใหม่อีกครั้งครับ");
  }
}

// ============================================
// /mysows — รายการที่คุณบันทึก
// ============================================

function handleMySowsCommand(chatId, userId) {
  try {
    const records = getRecordsByUser(userId);

    if (records.length === 0) {
      sendMessage(chatId, "📭 คุณยังไม่มีรายการที่บันทึกไว้ครับ\nใช้ /newmating เพื่อเพิ่มรายการแรกได้เลย!");
      return;
    }

    // จัดกลุ่มตามสถานะ
    const grouped = {};
    records.forEach(r => {
      if (!grouped[r.status]) grouped[r.status] = [];
      grouped[r.status].push(r);
    });

    let message = `🐷 *รายการของคุณ (ทั้งหมด ${records.length} รายการ)*\n\n`;
    Object.keys(grouped).forEach(status => {
      message += `*${status}* (${grouped[status].length}):\n`;
      grouped[status].forEach(r => {
        message += `  • ${r.sowId} — ผสม ${r.matingDate} (\`${r.matingId}\`)\n`;
      });
      message += "\n";
    });

    message += "💡 ใช้ /find [เบอร์หู] เพื่อดูและอัปเดตรายการครับ";
    sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    Logger.log("handleMySowsCommand error: " + error.toString());
    sendMessage(chatId, "❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งครับ");
  }
}

// ============================================
// /today — นัดหมายวันนี้ (พร้อมปุ่มกดอัปเดตได้เลย)
// ============================================

function handleTodayCommand(chatId) {
  try {
    const today = Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy");
    const appts = getTodayAppointments();
    const total = appts.checks.length + appts.confirms.length + appts.farrowings.length;

    if (total === 0) {
      sendMessage(chatId, `📅 *นัดหมายวันนี้ (${today})*\n\n✅ ไม่มีนัดหมายสำคัญวันนี้ครับ`, { parse_mode: "Markdown" });
      return;
    }

    sendMessage(chatId, `📅 *นัดหมายวันนี้ (${today})* — รวม ${total} รายการ`, { parse_mode: "Markdown" });

    // ส่งแต่ละรายการพร้อมปุ่มกดได้เลย
    if (appts.checks.length > 0) {
      appts.checks.forEach(r => {
        const msg = `🔍 *ตรวจท้อง*\n*${r.sowId}* (\`${r.matingId}\`) — ผสม ${r.matingDate}`;
        const keyboard = [
          [
            { text: "✅ ตั้งท้อง",              callback_data: `check_${r.matingId}_ตั้งท้อง` },
            { text: "🔄 ไม่ตั้ง (ผสมซ้ำ)",      callback_data: `status_${r.matingId}_${STATUSES.REMATE}` },
          ]
        ];
        sendMessageWithKeyboard(chatId, msg, keyboard, { parse_mode: "Markdown" });
      });
    }

    if (appts.confirms.length > 0) {
      appts.confirms.forEach(r => {
        const msg = `✅ *ตรวจยืนยันการตั้งท้อง*\n*${r.sowId}* (\`${r.matingId}\`) — ผสม ${r.matingDate} | สถานะ: ${r.status}`;
        const keyboard = [
          [
            { text: "🤰 ยืนยันตั้งท้อง",         callback_data: `status_${r.matingId}_${STATUSES.PREGNANT}` },
            { text: "🔄 ผสมซ้ำ",                callback_data: `status_${r.matingId}_${STATUSES.REMATE}` },
          ]
        ];
        sendMessageWithKeyboard(chatId, msg, keyboard, { parse_mode: "Markdown" });
      });
    }

    if (appts.farrowings.length > 0) {
      appts.farrowings.forEach(r => {
        const msg = `🍼 *กำหนดคลอด*\n*${r.sowId}* (\`${r.matingId}\`) — ผสม ${r.matingDate}`;
        const keyboard = [
          [
            { text: "🍼 คลอดแล้ว",              callback_data: `status_${r.matingId}_${STATUSES.FARROWED}` },
            { text: "⏳ เลื่อนออกไป",            callback_data: `note_${r.matingId}` },
          ]
        ];
        sendMessageWithKeyboard(chatId, msg, keyboard, { parse_mode: "Markdown" });
      });
    }

  } catch (error) {
    Logger.log("handleTodayCommand error: " + error.toString());
    sendMessage(chatId, "❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งครับ");
  }
}

// ============================================
// /status [สถานะ]
// ============================================

function handleStatusCommand(chatId, status) {
  if (!status || !status.trim()) {
    const statusList = Object.values(STATUSES).join(", ");
    sendMessage(chatId, `❌ กรุณาระบุสถานะด้วยครับ\n\nสถานะที่ใช้ได้: ${statusList}\n\nวิธีใช้: /status [สถานะ]`);
    return;
  }

  try {
    const records = getRecordsByStatus(status.trim());

    if (records.length === 0) {
      sendMessage(chatId, `📭 ไม่พบรายการที่มีสถานะ "${status.trim()}" ครับ`);
      return;
    }

    const message = formatMatingList(records, `รายการสถานะ "${status.trim()}"`);
    sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    Logger.log("handleStatusCommand error: " + error.toString());
    sendMessage(chatId, "❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งครับ");
  }
}

// ============================================
// Callback Query Handler
// ============================================

function handleCallbackQuery(callbackQuery) {
  const chatId    = callbackQuery.message.chat.id;
  const userId    = callbackQuery.from.id;
  const messageId = callbackQuery.message.message_id;
  const data      = callbackQuery.data;

  Logger.log("Callback: " + data);

  try {
    // เลือกวิธีผสมระหว่าง Conversation
    if (data.startsWith("method_")) {
      const parts  = data.split("_");
      const convUserId = parts[1];
      const method = parts[2];

      const state = getUserConversationState(convUserId);
      if (state && state.type === "new_mating" && state.step === "mating_method") {
        state.data.matingMethod = method === "AI" ? MATING_METHODS.AI : MATING_METHODS.NATURAL;
        answerCallbackQuery(callbackQuery.id, `เลือก ${state.data.matingMethod} แล้วครับ`);
        askSemenBoarId(convUserId, chatId, state);
      } else {
        answerCallbackQuery(callbackQuery.id, "");
      }
      return;
    }

    // อัปเดตสถานะ
    if (data.startsWith("status_")) {
      const parts     = data.split("_");
      const matingId  = parts[1];
      const newStatus = parts.slice(2).join("_");

      const success = updateRecordStatus(matingId, newStatus);
      if (success) {
        answerCallbackQuery(callbackQuery.id, `อัปเดตสถานะเป็น "${newStatus}" แล้วครับ!`);
        const record = getRecordById(matingId);
        if (record) {
          const updatedMessage = formatMatingMessage(record) + `\n\n✅ อัปเดตสถานะเป็น *${newStatus}* แล้วครับ`;
          const keyboard = createMatingActionKeyboard(matingId, newStatus);
          editMessage(chatId, messageId, updatedMessage, { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
        }
      } else {
        answerCallbackQuery(callbackQuery.id, "เกิดข้อผิดพลาดในการอัปเดต", true);
      }
      return;
    }

    // ผลตรวจท้อง
    if (data.startsWith("check_")) {
      const parts    = data.split("_");
      const matingId = parts[1];
      const result   = parts.slice(2).join("_");

      const success = updateCheckResult(matingId, result);
      if (success) {
        answerCallbackQuery(callbackQuery.id, `บันทึกผลตรวจ: ${result}`);
        const record = getRecordById(matingId);
        if (record) {
          const updatedMessage = formatMatingMessage(record) + `\n\n🔍 ผลตรวจท้อง: *${result}*`;
          const keyboard = createMatingActionKeyboard(matingId, record.status);
          editMessage(chatId, messageId, updatedMessage, { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
        }
      } else {
        answerCallbackQuery(callbackQuery.id, "เกิดข้อผิดพลาด", true);
      }
      return;
    }

    // เพิ่มหมายเหตุ
    if (data.startsWith("note_")) {
      const matingId = data.substring(5);
      answerCallbackQuery(callbackQuery.id, "กรุณาพิมพ์หมายเหตุ");
      setUserConversationState(userId, { type: "add_note", chatId, data: { matingId } });
      sendMessage(chatId, "📝 กรุณาพิมพ์หมายเหตุที่ต้องการเพิ่มสำหรับรายการนี้ครับ:");
      return;
    }

    answerCallbackQuery(callbackQuery.id, "");
  } catch (error) {
    Logger.log("handleCallbackQuery error: " + error.toString());
    answerCallbackQuery(callbackQuery.id, "เกิดข้อผิดพลาดในการประมวลผล", true);
  }
}

// ============================================
// Smart Search — พิมพ์เบอร์หูได้เลย ไม่ต้อง /find
// ============================================

function handleSmartSearch(chatId, text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  // ตรวจสอบรูปแบบที่น่าจะเป็นเบอร์หูแม่พันธุ์:
  // - ตัวอักษร + ตัวเลข เช่น S001, S-001, SOW001
  // - ตัวเลขล้วน เช่น 001, 1234
  // - ความยาวไม่เกิน 20 ตัว
  const looksLikeSowId = /^[a-zA-Z0-9\-_]{1,20}$/.test(trimmed);

  if (!looksLikeSowId) {
    sendMessage(chatId, "❓ ไม่เข้าใจคำสั่งนี้ครับ\n\nถ้าต้องการค้นหาแม่พันธุ์ พิมพ์เบอร์หูได้เลย เช่น *S001*\nหรือพิมพ์ /help เพื่อดูคำสั่งทั้งหมดครับ", { parse_mode: "Markdown" });
    return;
  }

  try {
    const records = findRecordsBySowId(trimmed);

    if (records.length === 0) {
      // ไม่พบ — แจ้งให้รู้ชัดๆ ว่าค้นหาอะไรอยู่
      sendMessage(chatId, `🔍 ค้นหา "${trimmed.toUpperCase()}" แล้วไม่พบข้อมูลในระบบครับ\n\nตรวจสอบเบอร์หูอีกครั้ง หรือใช้ /newmating เพื่อบันทึกการผสมใหม่`);
      return;
    }

    if (records.length === 1) {
      // พบ 1 รายการ — แสดงรายละเอียดพร้อมปุ่มได้เลย
      const r = records[0];
      const message = formatMatingMessage(r);
      const keyboard = createMatingActionKeyboard(r.matingId, r.status);
      sendMessageWithKeyboard(chatId, message, keyboard, { parse_mode: "Markdown" });
    } else {
      // พบหลายรายการ (ผสมหลายครั้ง) — แสดงรายการล่าสุดก่อน พร้อมปุ่มแต่ละรายการ
      const sorted = records.sort((a, b) => b.matingId.localeCompare(a.matingId));

      sendMessage(chatId, `🐷 *${trimmed.toUpperCase()}* — พบ ${sorted.length} รายการ (ล่าสุดก่อน)`, { parse_mode: "Markdown" });

      // แสดงแค่ 3 รายการล่าสุดเพื่อไม่ให้ยาวเกินไป
      sorted.slice(0, 3).forEach(r => {
        const msg = formatMatingMessage(r);
        const keyboard = createMatingActionKeyboard(r.matingId, r.status);
        sendMessageWithKeyboard(chatId, msg, keyboard, { parse_mode: "Markdown" });
      });

      if (sorted.length > 3) {
        sendMessage(chatId, `_...และอีก ${sorted.length - 3} รายการ ใช้ /find ${trimmed} เพื่อดูทั้งหมด_`, { parse_mode: "Markdown" });
      }
    }
  } catch (error) {
    Logger.log("handleSmartSearch error: " + error.toString());
    sendMessage(chatId, "❌ เกิดข้อผิดพลาดในการค้นหา กรุณาลองใหม่อีกครั้งครับ");
  }
}

// ============================================
// /upcoming — นัดหมาย 7 วันข้างหน้า
// ============================================

function handleUpcomingCommand(chatId, daysArg) {
  const days = Math.min(Math.max(parseInt(daysArg) || 7, 1), 14);
  try {
    const groups = getUpcomingAppointments(days);

    if (groups.length === 0) {
      sendMessage(chatId,
        `📅 *นัดหมาย ${days} วันข้างหน้า*\n\n✅ ไม่มีนัดหมายในช่วงนี้ครับ`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    const typeLabel = {
      check:   "🔍 ตรวจท้อง",
      confirm: "✅ ตรวจยืนยัน",
      farrow:  "🍼 กำหนดคลอด",
    };

    let msg = `📅 *นัดหมาย ${days} วันข้างหน้า* (${groups.reduce((s,g)=>s+g.items.length,0)} รายการ)\n\n`;

    groups.forEach(g => {
      const dayLabel = g.daysFromNow === 1 ? "พรุ่งนี้" : `อีก ${g.daysFromNow} วัน`;
      msg += `📆 *${g.date}* — ${dayLabel}\n`;
      g.items.forEach(r => {
        msg += `  • ${typeLabel[r.apptType]} *${r.sowId}* (\`${r.matingId}\`)\n`;
      });
      msg += "\n";
    });

    msg += "💡 ใช้ /find [เบอร์หู] เพื่ออัปเดตสถานะครับ";
    sendMessage(chatId, msg, { parse_mode: "Markdown" });
  } catch (err) {
    Logger.log("handleUpcomingCommand error: " + err.toString());
    sendMessage(chatId, "❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งครับ");
  }
}

// ============================================
// /report — รายงานสรุปรายเดือน
// ============================================

function handleReportCommand(chatId) {
  try {
    const r = getMonthlyReport();

    // แปลง MM/yyyy เป็นชื่อเดือนภาษาไทย
    const monthNames = ["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
                        "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
    const [mm, yyyy] = r.month.split("/");
    const monthTH = `${monthNames[parseInt(mm)]} ${parseInt(yyyy)+543}`;

    let msg = `📊 *รายงานประจำเดือน ${monthTH}*\n\n`;

    msg += `*ภาพรวม:*\n`;
    msg += `┣ ผสมในเดือนนี้: *${r.totalMated} ตัว*\n`;
    msg += `┣ ตั้งท้องอยู่: *${r.pregnant} ตัว*\n`;
    msg += `┣ คลอดในเดือนนี้: *${r.farrowed} ตัว*\n`;
    msg += `┣ ผสมซ้ำ: *${r.remate} ตัว*\n`;
    msg += `┣ รอตรวจท้อง: *${r.waitingCheck} ตัว*\n`;
    msg += `┗ อัตราตั้งท้อง: *${r.pregnancyRate}%*\n\n`;

    if (r.upcomingFarrow.length > 0) {
      msg += `🍼 *กำหนดคลอดในเดือนนี้ (${r.upcomingFarrow.length} ตัว):*\n`;
      r.upcomingFarrow.forEach(rec => {
        msg += `  • *${rec.sowId}* — ${rec.dueDate} (\`${rec.matingId}\`)\n`;
      });
      msg += "\n";
    }

    // เกณฑ์ประเมิน
    const rateColor = r.pregnancyRate >= 85 ? "🟢" : r.pregnancyRate >= 70 ? "🟡" : "🔴";
    msg += `${rateColor} อัตราตั้งท้อง ${r.pregnancyRate}% `;
    msg += r.pregnancyRate >= 85 ? "(ดีมากครับ 👍)"
         : r.pregnancyRate >= 70 ? "(พอใช้ได้ครับ)"
         : "(ต่ำกว่าเกณฑ์ ควรตรวจสอบครับ)";

    sendMessage(chatId, msg, { parse_mode: "Markdown" });
  } catch (err) {
    Logger.log("handleReportCommand error: " + err.toString());
    sendMessage(chatId, "❌ เกิดข้อผิดพลาดในการสร้างรายงาน กรุณาลองใหม่อีกครั้งครับ");
  }
}
