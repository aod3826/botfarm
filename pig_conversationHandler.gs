// ============================================
// Conversation State Management
// ============================================

function getUserConversationState(userId) {
  const stateJson = PropertiesService.getScriptProperties().getProperty(`conv_${userId}`);
  return stateJson ? JSON.parse(stateJson) : null;
}

function setUserConversationState(userId, state) {
  PropertiesService.getScriptProperties().setProperty(`conv_${userId}`, JSON.stringify(state));
}

function clearUserConversationState(userId) {
  PropertiesService.getScriptProperties().deleteProperty(`conv_${userId}`);
}

// ============================================
// Start New Mating Conversation
// ============================================

function startNewMatingConversation(userId, chatId) {
  const state = {
    type: "new_mating",
    chatId: chatId,
    step: "mating_date",
    data: {},
  };
  setUserConversationState(userId, state);
  sendMessage(chatId, "🐷 มาบันทึกการผสมพันธุ์ใหม่กันครับ!\n\n📅 *วันที่ผสม* คือวันไหนครับ?\nพิมพ์ในรูปแบบ วัน/เดือน/ปี เช่น 20/03/2026\n_(หรือพิมพ์ \"วันนี้\" เพื่อใช้วันที่ปัจจุบัน)_", { parse_mode: "Markdown" });
}

// ============================================
// Route Conversation
// ============================================

function handleConversation(userId, chatId, text, state) {
  if (state.type === "new_mating") {
    handleNewMatingConversation(userId, chatId, text, state);
  } else if (state.type === "add_note") {
    handleAddNoteConversation(userId, chatId, text, state);
  } else if (state.type === "check_result") {
    handleCheckResultConversation(userId, chatId, text, state);
  }
}

// ============================================
// New Mating Conversation Flow
// ============================================

function handleNewMatingConversation(userId, chatId, text, state) {
  const { step, data } = state;

  switch (step) {
    case "mating_date": {
      const dateStr = text.trim() === "วันนี้"
        ? Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy")
        : text.trim();
      const parsed = parseDate(dateStr);
      if (!parsed) {
        sendMessage(chatId, "❌ รูปแบบวันที่ไม่ถูกต้องครับ กรุณาพิมพ์ใหม่ เช่น 20/03/2026");
        return;
      }
      data.matingDate = parsed;
      state.step = "sow_id";
      setUserConversationState(userId, state);
      sendMessage(chatId, "🐷 ได้เลยครับ!\n\n🏷️ *เบอร์หูแม่พันธุ์* (Sow ID) คือเบอร์อะไรครับ?", { parse_mode: "Markdown" });
      break;
    }

    case "sow_id": {
      data.sowId = text.trim().toUpperCase();
      state.step = "mating_method";
      setUserConversationState(userId, state);
      sendMessageWithKeyboard(
        chatId,
        "🔬 *วิธีการผสม* คืออะไรครับ?",
        [[
          { text: "💉 ผสมเทียม", callback_data: `method_${userId}_AI` },
          { text: "🐗 ผสมจริง",  callback_data: `method_${userId}_NATURAL` },
        ]],
        { parse_mode: "Markdown" }
      );
      break;
    }

    case "mating_method": {
      // กรณีพิมพ์มาแทนกดปุ่ม
      if (text.includes("เทียม") || text.toLowerCase() === "ai") {
        data.matingMethod = MATING_METHODS.AI;
      } else if (text.includes("จริง") || text.toLowerCase() === "natural") {
        data.matingMethod = MATING_METHODS.NATURAL;
      } else {
        sendMessage(chatId, "❌ กรุณาเลือกวิธีการผสมโดยกดปุ่มด้านบนครับ");
        return;
      }
      askSemenBoarId(userId, chatId, state);
      break;
    }

    case "semen_boar_id": {
      data.semenBoarId = text.trim().toUpperCase();
      state.step = "notes";
      setUserConversationState(userId, state);
      sendMessage(chatId, '📝 มีหมายเหตุเพิ่มเติมไหมครับ?\n_(พิมพ์ "ข้าม" ถ้าไม่มี)_', { parse_mode: "Markdown" });
      break;
    }

    case "notes": {
      if (text.trim() !== "ข้าม") {
        data.notes = text.trim();
      }
      saveMatingRecord(userId, chatId, state);
      break;
    }
  }
}

function askSemenBoarId(userId, chatId, state) {
  const { data } = state;
  const label = data.matingMethod === MATING_METHODS.AI ? "รหัสน้ำเชื้อ" : "เบอร์พ่อพันธุ์";
  const emoji = data.matingMethod === MATING_METHODS.AI ? "🧪" : "🐗";
  state.step = "semen_boar_id";
  setUserConversationState(userId, state);
  sendMessage(chatId, `${emoji} *${label}* คืออะไรครับ?`, { parse_mode: "Markdown" });
}

function saveMatingRecord(userId, chatId, state) {
  try {
    const record = createMatingRecord(userId, state.data);
    clearUserConversationState(userId);

    const message =
      `✅ *บันทึกการผสมพันธุ์สำเร็จแล้วครับ!*\n\n` +
      `*รหัส:* \`${record.matingId}\`\n` +
      `*เบอร์หูแม่พันธุ์:* ${record.sowId}\n` +
      `*วิธีผสม:* ${record.matingMethod}\n` +
      `*รหัสน้ำเชื้อ/พ่อพันธุ์:* ${record.semenBoarId}\n\n` +
      `📅 *นัดหมายสำคัญ:*\n` +
      `• ตรวจท้อง: ${record.checkDate}\n` +
      `• ตรวจยืนยัน: ${record.confirmDate}\n` +
      `• กำหนดคลอด: ${record.dueDate}`;

    sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    clearUserConversationState(userId);
    sendMessage(chatId, `❌ เกิดข้อผิดพลาด: ${error.message}\n\nกรุณาลองใหม่ด้วยคำสั่ง /newmating ครับ`);
  }
}

// ============================================
// Add Note Conversation
// ============================================

function handleAddNoteConversation(userId, chatId, text, state) {
  const { matingId } = state.data;
  try {
    addNoteToRecord(matingId, text.trim());
    clearUserConversationState(userId);
    sendMessage(chatId, `✅ เพิ่มหมายเหตุในรายการ \`${matingId}\` สำเร็จแล้วครับ!`, { parse_mode: "Markdown" });
  } catch (error) {
    clearUserConversationState(userId);
    sendMessage(chatId, `❌ เกิดข้อผิดพลาด: ${error.message}`);
  }
}

// ============================================
// Check Result Conversation (ผลตรวจท้อง)
// ============================================

function handleCheckResultConversation(userId, chatId, text, state) {
  // handled via inline keyboard — this is fallback
  sendMessage(chatId, "กรุณากดปุ่มเพื่อเลือกผลการตรวจท้องครับ");
}

// ============================================
// Date Parser
// ============================================

function parseDate(text) {
  let match = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    return `${match[1].padStart(2,"0")}/${match[2].padStart(2,"0")}/${match[3]}`;
  }
  match = text.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (match) {
    return `${match[3].padStart(2,"0")}/${match[2].padStart(2,"0")}/${match[1]}`;
  }
  return null;
}
