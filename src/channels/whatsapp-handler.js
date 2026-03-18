/**
 * WhatsApp Message Handler — per-user isolation via userId closure
 */
import LeadRepo from '../db/models/Lead.js';
import MessageRepo from '../db/models/Message.js';
import ConfigRepo from '../db/models/Config.js';
import { stripWhatsAppId, normalizePhone, formatPhoneDisplay, findLeadByPhone } from '../utils/phone.js';
import { isBotSuspicion, analyzeConversation, updatePriceFromAnalysis, generateReply } from '../core/negotiation-service.js';

/**
 * Wire up WhatsApp event handlers for a specific user.
 * @param {WhatsAppClient} whatsapp
 * @param {GeminiClient} gemini
 * @param {string} userId
 */
export function setupWhatsAppHandler(whatsapp, gemini, userId) {
  // Create a user-scoped gemini that uses this user's API key
  const userGemini = gemini.forKey(() => ConfigRepo.get(userId, 'geminiApiKey'));

  whatsapp.on('ready', (info) => {
    const displayName = info.name && info.name !== '.' ? info.name : 'Account';
    console.log(`[WhatsApp:${userId}] Connected as ${displayName} (${info.phone})`);
    setTimeout(() => processUnansweredMessages(userId, whatsapp, userGemini), 3000);
  });

  whatsapp.on('disconnected', (reason) => {
    console.log(`[WhatsApp:${userId}] Disconnected: ${reason}`);
  });

  whatsapp.on('message', async (msg) => {
    await handleIncomingMessage(msg, userId, whatsapp, userGemini);
  });
}

async function handleIncomingMessage(msg, userId, whatsapp, gemini) {
  if (!msg.body || msg.body.trim().length === 0) {
    console.log(`[WhatsApp:${userId}] Ignoring empty message from ${msg.from}`);
    return;
  }

  const isLid = msg.from.endsWith('@lid');
  const realPhone = msg.contactNumber ? msg.contactNumber.replace(/[^0-9]/g, '') : null;
  const cleanPhone = realPhone || stripWhatsAppId(msg.from);
  const displayName = msg.contactName
    || (realPhone ? formatPhoneDisplay(realPhone) : null)
    || (isLid ? `Contact ${cleanPhone.slice(-4)}` : cleanPhone);

  // Find or create lead for this user
  let lead = LeadRepo.getAll(userId).find(l => l.whatsappId === msg.from);
  if (!lead && realPhone) {
    lead = LeadRepo.getAll(userId).find(l => normalizePhone(l.phoneNumber) === normalizePhone(realPhone));
  }

  if (!lead) {
    const cfg0 = ConfigRepo.load(userId);
    lead = LeadRepo.create({
      userId,
      url: '',
      title: 'WhatsApp Conversation',
      initialPrice: '',
      price: '',
      sellerName: displayName,
      phoneNumber: realPhone || cleanPhone,
      whatsappId: msg.from,
      isSaved: false,
      status: 'new',
      platform: 'whatsapp',
      isBotActive: true,
      channel: 'whatsapp',
      // Freeze system prompt at conversation start
      systemPrompt: cfg0.whatsappSystemPrompt || '',
    });
    console.log(`[WhatsApp:${userId}] New lead created for ${displayName} (${cleanPhone})`);
  } else {
    let needsSave = false;
    if (!lead.whatsappId) { lead.whatsappId = msg.from; needsSave = true; }
    const currentNameIsRawId = /^\d{10,}$/.test(lead.sellerName);
    if (msg.contactName && (lead.sellerName === lead.phoneNumber || currentNameIsRawId)) {
      lead.sellerName = msg.contactName; needsSave = true;
    } else if (currentNameIsRawId && realPhone) {
      lead.sellerName = formatPhoneDisplay(realPhone); needsSave = true;
    }
    if (realPhone && /^\d{12,}$/.test(lead.phoneNumber) && lead.phoneNumber !== realPhone) {
      lead.phoneNumber = realPhone; needsSave = true;
    }
    if (needsSave) LeadRepo.save();
  }

  MessageRepo.create({
    userId,
    leadId: lead.id,
    sender: 'seller',
    text: msg.body,
    timestamp: new Date((msg.timestamp || Date.now() / 1000) * 1000).toISOString(),
    channel: 'whatsapp',
    from: msg.from,
  });

  lead.lastMessage = msg.body;
  LeadRepo.save();

  console.log(`[WhatsApp:${userId}] Incoming from ${displayName}: "${msg.body.substring(0, 50)}"`);

  if (isBotSuspicion(msg.body)) {
    console.log(`[WhatsApp:${userId}] BOT SUSPICION from ${displayName}`);
    lead.isBotActive = false;
    lead.lastMessage = `⚠️ ALERTĂ: Vânzătorul suspectează bot! Mesaj: "${msg.body}"`;
    LeadRepo.save();
    return;
  }

  if (lead.isBotActive && gemini.isAvailable) {
    try {
      const cfg = ConfigRepo.load(userId);
      const leadMessages = MessageRepo.getByLeadId(lead.id);

      const analysis = await analyzeConversation(gemini, leadMessages, lead);
      if (analysis) console.log(`[WhatsApp:${userId}] Pre-reply analysis:`, analysis);

      if (updatePriceFromAnalysis(lead, analysis)) {
        console.log(`[WhatsApp:${userId}] Price updated for ${lead.id}: ${lead.price}`);
      }

      if (analysis?.status === 'negotiating' && (lead.status === 'contacted' || lead.status === 'new')) {
        lead.status = 'negotiating';
        LeadRepo.save();
      }

      if (analysis?.status === 'accepted') {
        lead.status = 'accepted';
        lead.isBotActive = false;
        if (analysis.currentPrice) lead.finalPrice = lead.price;
        console.log(`[WhatsApp:${userId}] CONSENSUS REACHED for ${lead.id}`);

        if (cfg.autosendAddress && cfg.meetingAddress) {
          const addressMsg = `Mulțumesc pentru înțelegere! Ne putem întâlni la: ${cfg.meetingAddress}. Vă convine?`;
          await whatsapp.sendMessage(lead.whatsappId || msg.from, addressMsg);
          MessageRepo.create({ userId, leadId: lead.id, sender: 'me', text: addressMsg, channel: 'whatsapp', to: msg.from });
          lead.status = 'autosend';
          lead.lastMessage = addressMsg;
        }
        LeadRepo.save();
        return;
      }

      const replyText = await generateReply(gemini, {
        systemPrompt: lead.systemPrompt || cfg.whatsappSystemPrompt,
        lead,
        messages: leadMessages,
        channel: 'whatsapp',
      });

      if (replyText) {
        await whatsapp.sendMessage(lead.whatsappId || msg.from, replyText);
        MessageRepo.create({ userId, leadId: lead.id, sender: 'me', text: replyText, channel: 'whatsapp', to: msg.from });
        lead.lastMessage = replyText;
        lead.lastContacted = new Date().toISOString();
        if (lead.status === 'new') lead.status = 'contacted';
        LeadRepo.save();
        console.log(`[WhatsApp:${userId}] Auto-reply sent: "${replyText.substring(0, 50)}..."`);
      }
    } catch (err) {
      console.error(`[WhatsApp:${userId}] Auto-reply failed:`, err.message);
    }
  }
}

async function processUnansweredMessages(userId, whatsapp, gemini) {
  if (!whatsapp.isConnected || !gemini.isAvailable) return;

  const allMessages = MessageRepo.getAll(userId);
  const leadIds = [...new Set(allMessages.filter(m => m.leadId).map(m => m.leadId))];
  const unanswered = [];

  for (const leadId of leadIds) {
    const leadMsgs = allMessages.filter(m => m.leadId === leadId);
    const lastMsg = leadMsgs[leadMsgs.length - 1];
    if (lastMsg && lastMsg.sender === 'seller' && lastMsg.text && lastMsg.text.trim()) {
      const lead = LeadRepo.findById(leadId);
      if (lead && lead.isBotActive && lead.userId === userId) {
        unanswered.push({ lead, lastMsg });
      }
    }
  }

  if (unanswered.length === 0) return;

  console.log(`[WhatsApp:${userId}] Found ${unanswered.length} unanswered message(s) after restart.`);

  for (const { lead, lastMsg } of unanswered) {
    try {
      if (isBotSuspicion(lastMsg.text)) {
        lead.isBotActive = false;
        lead.lastMessage = `⚠️ ALERTĂ: Vânzătorul suspectează bot! Mesaj: "${lastMsg.text}"`;
        LeadRepo.save();
        continue;
      }

      if (lead.status === 'accepted' || lead.status === 'autosend') continue;

      const cfg = ConfigRepo.load(userId);
      const leadMessages = MessageRepo.getByLeadId(lead.id);

      const analysis = await analyzeConversation(gemini, leadMessages, lead);
      updatePriceFromAnalysis(lead, analysis);

      if (analysis?.status === 'accepted') {
        lead.status = 'accepted';
        lead.isBotActive = false;
        if (analysis.currentPrice) lead.finalPrice = lead.price;
        if (cfg.autosendAddress && cfg.meetingAddress) {
          const addressMsg = `Mulțumesc pentru înțelegere! Ne putem întâlni la: ${cfg.meetingAddress}. Vă convine?`;
          await whatsapp.sendMessage(lead.whatsappId || lastMsg.from, addressMsg);
          MessageRepo.create({ userId, leadId: lead.id, sender: 'me', text: addressMsg, channel: 'whatsapp', to: lead.whatsappId || lastMsg.from });
          lead.status = 'autosend';
          lead.lastMessage = addressMsg;
        }
        LeadRepo.save();
        continue;
      }

      if (analysis?.status === 'negotiating' && (lead.status === 'contacted' || lead.status === 'new')) {
        lead.status = 'negotiating';
      }

      const replyText = await generateReply(gemini, {
        systemPrompt: lead.systemPrompt || cfg.whatsappSystemPrompt,
        lead,
        messages: leadMessages,
        channel: 'whatsapp',
      });

      if (replyText) {
        await whatsapp.sendMessage(lead.whatsappId || lastMsg.from, replyText);
        MessageRepo.create({ userId, leadId: lead.id, sender: 'me', text: replyText, channel: 'whatsapp', to: lead.whatsappId || lastMsg.from });
        lead.lastMessage = replyText;
        if (lead.status === 'new') lead.status = 'contacted';
        lead.lastContacted = new Date().toISOString();
        LeadRepo.save();
      }
    } catch (err) {
      console.error(`[WhatsApp:${userId}] Retry reply failed:`, err.message);
    }
  }
}
