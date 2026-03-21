// ============================================
// Sheet Menu
// ============================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🐷 Pig Farm Bot")
    .addItem("ใส่ Bot Token 🔑",        "menuEnterBotToken")
    .addItem("ใส่ Webhook URL 🌐",      "menuEnterWebhookUrl")
    .addItem("ใส่ Spreadsheet ID 📊",   "menuEnterSpreadsheetId")
    .addItem("ใส่ Report Chat ID 📣",   "menuEnterReportChatId")
    .addItem("ใส่ Mini App URL 📱",     "menuEnterMiniAppUrl")
    .addSeparator()
    .addItem("ตั้งค่า Webhook ⚙️",      "menuSetupIntegration")
    .addItem("ตั้งค่า Daily Trigger 🔔", "menuSetupDailyTrigger")
    .addSeparator()
    .addItem("ตรวจสอบสถานะ Webhook 🔍", "menuCheckWebhookStatus")
    .addItem("ลบ Webhook 🗑️",           "deleteWebhookAndClearPendingUpdates")
    .addToUi();
}

function handlePromptInput(title, message, setterFunction, successMessage, emptyMessage) {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(title, message, ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return false;
  const input = (response.getResponseText() || "").trim();
  if (!input) { ui.alert(emptyMessage); return false; }
  setterFunction(input);
  ui.alert(successMessage);
  return true;
}

function menuEnterBotToken() {
  handlePromptInput("🔑 ใส่ Telegram Bot Token", "วางโทเค่นจาก BotFather", setBotToken, "✅ บันทึก Bot Token แล้ว", "Token ว่างเปล่า ไม่มีการเปลี่ยนแปลง");
}
function menuEnterWebhookUrl() {
  handlePromptInput("🌐 ใส่ Webhook URL", "วาง URL ของ Web App (ลงท้ายด้วย /exec)", setWebhookUrl, "✅ บันทึก Webhook URL แล้ว", "URL ว่างเปล่า ไม่มีการเปลี่ยนแปลง");
}
function menuEnterSpreadsheetId() {
  handlePromptInput("📊 ใส่ Spreadsheet ID", "วาง ID จาก URL ของ Spreadsheet", setSpreadsheetId, "✅ บันทึก Spreadsheet ID แล้ว", "ID ว่างเปล่า ไม่มีการเปลี่ยนแปลง");
}
function menuEnterReportChatId() {
  handlePromptInput("📣 ใส่ Report Chat ID", "วาง Chat ID ที่ต้องการรับการแจ้งเตือนรายวัน", setReportChatId, "✅ บันทึก Report Chat ID แล้ว", "Chat ID ว่างเปล่า ไม่มีการเปลี่ยนแปลง");
}
function menuEnterMiniAppUrl() {
  handlePromptInput("📱 ใส่ Mini App URL", "วาง URL ของ GitHub Pages เช่น https://aod3826.github.io/botfarm/", setMiniAppUrl, "✅ บันทึก Mini App URL แล้ว", "URL ว่างเปล่า ไม่มีการเปลี่ยนแปลง");
}

function menuSetupIntegration() {
  const ui = SpreadsheetApp.getUi();
  try {
    validateConfig();
    const resultMessage = setWebhook();
    ui.alert("🎯 ตั้งค่าสำเร็จ", resultMessage, ui.ButtonSet.OK);
  } catch (err) {
    ui.alert("⚠️ ตั้งค่าไม่สำเร็จ", String(err && err.message ? err.message : err), ui.ButtonSet.OK);
  }
}

function menuSetupDailyTrigger() {
  const ui = SpreadsheetApp.getUi();
  try {
    ScriptApp.getProjectTriggers().forEach(t => {
      if (t.getHandlerFunction() === "sendDailyReminders") ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger("sendDailyReminders")
      .timeBased().everyDays(1).atHour(7).create();
    ui.alert("✅ ตั้งค่า Daily Trigger สำเร็จ", "บอทจะส่งการแจ้งเตือนทุกวัน เวลา 07:00 น. ครับ", ui.ButtonSet.OK);
  } catch (err) {
    ui.alert("⚠️ ไม่สำเร็จ", String(err && err.message ? err.message : err), ui.ButtonSet.OK);
  }
}

function menuCheckWebhookStatus() {
  const ui = SpreadsheetApp.getUi();
  try {
    validateConfig();
    const webhookInfo = getWebhookInfo();
    const triggers = ScriptApp.getProjectTriggers();
    let message = "🔍 สถานะ Webhook\n\n";
    if (webhookInfo.ok) {
      message += `✅ สถานะ: ใช้งานได้\n`;
      message += `📍 URL: ${webhookInfo.result.url || "ยังไม่ได้ตั้ง"}\n`;
      message += `📊 Pending Updates: ${webhookInfo.result.pending_update_count || 0}\n`;
      message += `❌ Error ล่าสุด: ${webhookInfo.result.last_error_message || "ไม่มี"}\n\n`;
    } else {
      message += `❌ สถานะ: Error\n${webhookInfo.description}\n\n`;
    }
    message += `🔔 Triggers: ${triggers.length} รายการ`;
    ui.alert("สถานะ Webhook", message, ui.ButtonSet.OK);
  } catch (err) {
    ui.alert("⚠️ ตรวจสอบไม่ได้", String(err && err.message ? err.message : err), ui.ButtonSet.OK);
  }
}

// ============================================
// Message Handler
// ============================================

function handleMessage(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text   = (message.text || "").trim();

  // ── คำสั่ง "/" ทำงานได้เสมอ แม้อยู่ระหว่าง conversation ──
  if (text.startsWith("/")) {
    const command = text.split(" ")[0].toLowerCase().split("@")[0];

    // /cancel ล้าง state ทันที ไม่ว่าจะอยู่ขั้นตอนไหน
    if (command === "/cancel") {
      clearUserConversationState(userId);
      sendMessage(chatId, "❌ ยกเลิกการดำเนินการแล้วครับ");
      return;
    }

    // commands อื่น — ถ้ามี state ค้างอยู่ ล้างก่อนแล้วทำงานต่อ
    const stateBeforeCommand = getUserConversationState(userId);
    if (stateBeforeCommand) {
      clearUserConversationState(userId);
    }

    handleCommand(chatId, userId, text);
    return;
  }

  // ── ไม่ใช่ command ตรวจ conversation state ──
  const conversationState = getUserConversationState(userId);
  if (conversationState) {
    handleConversation(userId, chatId, text, conversationState);
    return;
  }

  // ── ข้อความทั่วไป ลองค้นหาเบอร์หูอัตโนมัติ ──
  handleSmartSearch(chatId, text);
}

function handleCommand(chatId, userId, text) {
  const parts   = text.split(" ");
  const command = parts[0].toLowerCase().split("@")[0];
  const args    = parts.slice(1);

  switch (command) {
    case "/start":
      PropertiesService.getScriptProperties().setProperty("chat_" + userId, chatId.toString());
      sendWelcomeMessage(chatId);
      break;
    case "/help":
      sendHelpMessage(chatId);
      break;
    case "/newmating":
      startNewMatingConversation(userId, chatId);
      break;
    case "/find":
      handleFindCommand(chatId, args.join(" "));
      break;
    case "/mysows":
      handleMySowsCommand(chatId, userId);
      break;
    case "/today":
      handleTodayCommand(chatId);
      break;
    case "/upcoming":
      handleUpcomingCommand(chatId, args[0]);
      break;
    case "/report":
      handleReportCommand(chatId);
      break;
    case "/status":
      handleStatusCommand(chatId, args.join(" "));
      break;
    case "/cancel":
      // handled before reaching here (in handleMessage)
      clearUserConversationState(userId);
      sendMessage(chatId, "❌ ยกเลิกการดำเนินการแล้วครับ");
      break;
    case "/reset":
      clearUserConversationState(userId);
      sendMessage(chatId, "🔄 ล้าง state ทั้งหมดแล้วครับ ลองพิมพ์ /help ใหม่ได้เลย");
      break;
    default:
      sendMessage(chatId, "❓ ไม่รู้จักคำสั่งนี้ครับ พิมพ์ /help เพื่อดูคำสั่งทั้งหมดนะครับ");
  }
}

function sendWelcomeMessage(chatId) {
  const message = `🐷 *ยินดีต้อนรับสู่ Pig Farm Mating Bot ครับ!*

ผมช่วยติดตามการผสมพันธุ์และวงจรการผลิตในฟาร์มของคุณได้เลยครับ:

📝 บันทึกการผสมพันธุ์ใหม่
🔍 ค้นหาข้อมูลแม่พันธุ์
📅 ดูนัดหมายสำคัญประจำวัน
🔔 แจ้งเตือนวันตรวจท้อง / กำหนดคลอด
✅ อัปเดตสถานะแม่พันธุ์

พิมพ์ /help เพื่อดูคำสั่งทั้งหมด หรือเปิดหน้าจัดการได้เลยครับ 👇`;

  const miniAppUrl = getMiniAppUrl();
  const options = { parse_mode: "Markdown" };

  if (miniAppUrl) {
    options.reply_markup = {
      inline_keyboard: [[
        { text: "📱 เปิดหน้าจัดการ", web_app: { url: miniAppUrl } }
      ]]
    };
  }

  sendMessage(chatId, message, options);
}

function sendHelpMessage(chatId) {
  const message = `🐷 *คำสั่งที่ใช้ได้ทั้งหมด:*

*บันทึกและค้นหา:*
/newmating — บันทึกการผสมพันธุ์ใหม่
/find [เบอร์หูแม่พันธุ์] — ค้นหาแม่พันธุ์
/mysows — ดูแม่พันธุ์ทั้งหมดที่คุณบันทึกไว้

*รายงาน:*
/today — ดูนัดหมายสำคัญวันนี้
/upcoming [จำนวนวัน] — ดูนัดล่วงหน้า (ค่าเริ่มต้น 7 วัน)
/report — รายงานสรุปรายเดือน
/status [สถานะ] — ดูตามสถานะ

*สถานะที่ใช้ได้:*
• รอตรวจท้อง
• ตั้งท้อง
• ผสมซ้ำ
• คลอดแล้ว

*ทั่วไป:*
/help — แสดงคำสั่งทั้งหมด
/cancel — ยกเลิกการดำเนินการปัจจุบัน`;
  sendMessage(chatId, message, { parse_mode: "Markdown" });
}

// ============================================
// Mini App URL Helpers
// ============================================

function getMiniAppUrl() {
  // ใส่ค่าเริ่มต้นไว้เลย — เปลี่ยนได้ภายหลังผ่านเมนู
  const stored = getScriptProperties().getProperty("MINI_APP_URL");
  return stored || "https://aod3826.github.io/botfarm/";
}

function setMiniAppUrl(url) {
  if (!url) throw new Error("Mini App URL ว่างเปล่า");
  getScriptProperties().setProperty("MINI_APP_URL", url);
}

// ============================================
// Webhook Helpers
// ============================================

function setWebhook() {
  validateConfig();
  const webAppUrl = getWebhookUrl();
  if (!webAppUrl) throw new Error("ยังไม่ได้ตั้ง Webhook URL ครับ");
  const url = `${getTelegramUrl()}/setWebhook?url=${encodeURIComponent(webAppUrl)}`;
  const response = UrlFetchApp.fetch(url);
  const result = JSON.parse(response.getContentText());
  if (result.ok) {
    return "ตั้ง Webhook สำเร็จ: " + webAppUrl;
  } else {
    throw new Error("ตั้ง Webhook ไม่สำเร็จ: " + result.description);
  }
}

function getWebhookInfo() {
  const url = `${getTelegramUrl()}/getWebhookInfo`;
  const response = UrlFetchApp.fetch(url);
  return JSON.parse(response.getContentText());
}

function deleteWebhookAndClearPendingUpdates() {
  try {
    ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
    const scriptProperties = PropertiesService.getScriptProperties();
    const allProperties = scriptProperties.getProperties();
    Object.keys(allProperties).filter(k => k.startsWith("conv_")).forEach(k => scriptProperties.deleteProperty(k));
    const url = `${getTelegramUrl()}/deleteWebhook?drop_pending_updates=true`;
    const response = UrlFetchApp.fetch(url);
    const result = JSON.parse(response.getContentText());
    if (result.ok) {
      SpreadsheetApp.getUi().alert("✅ ลบ Webhook สำเร็จ และล้างข้อมูล pending แล้วครับ");
    } else {
      SpreadsheetApp.getUi().alert("❌ Error: " + result.description);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert("❌ Error: " + error.toString());
  }
}
