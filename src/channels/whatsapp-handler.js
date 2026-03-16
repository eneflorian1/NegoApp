/**
 * WhatsApp Message Handler — extracted from server.js
 * Handles incoming WhatsApp messages: lead creation, bot negotiation, auto-reply.
 */
import LeadRepo from '../db/models/Lead.js';
import MessageRepo from '../db/models/Message.js';
import ConfigRepo from '../db/models/Config.js';
import { stripWhatsAppId, normalizePhone, formatPhoneDisplay, findLeadByPhone } from '../utils/phone.js';
import { isBotSuspicion, analyzeConversation, updatePriceFromAnalysis, generateReply } from '../core/negotiation-service.js';

/**
 * Wire up WhatsApp event handlers.
 * @param {WhatsAppClient} whatsapp
 * @param {GeminiClient} gemini
 */
export function setupWhatsAppHandler(whatsapp, gemini) {
  whatsapp.on('ready', (info) => {
    const displayName = info.name && info.name !== '.' ? info.name : 'Account';
    console.log(`[WhatsApp] Connected as ${displayName} (${info.phone})`);
    setTimeout(() => processUnansweredMessages(whatsapp, gemini), 3000);
  });

  whatsapp.on('disconnected', (reason) => {
    console.log(`[WhatsApp] Disconnected: ${reason}`);
  });

  whatsapp.on('message', async (msg) => {
    await handleIncomingMessage(msg, whatsapp, gemini);
  });
}

/** Handle a single incoming WhatsApp message */
async function handleIncomingMessage(msg, whatsapp, gemini) {
  // EARLY EXIT: Ignore empty messages
  if (!msg.body || msg.body.trim().length === 0) {
    console.log(`[WhatsApp] Ignoring empty message from ${msg.from} (type: ${msg.type})`);
    return;
  }

  const isLid = msg.from.endsWith('@lid');
  const realPhone = msg.contactNumber ? msg.contactNumber.replace(/[^0-9]/g, '') : null;
  const cleanPhone = realPhone || stripWhatsAppId(msg.from);
  const displayName = msg.contactName
    || (realPhone ? formatPhoneDisplay(realPhone) : null)
    || (isLid ? `Contact ${cleanPhone.slice(-4)}` : cleanPhone);

  // Find or create lead
  let lead = findLeadByPhone(msg.from);
  if (!lead && realPhone) {
    lead = LeadRepo.find(l => normalizePhone(l.phoneNumber) === normalizePhone(realPhone));
  }

  if (!lead) {
    lead = LeadRepo.create({
      url: '',
      title: 'WhatsApp Conversation',
      initialPrice: '',
      price: '',
      sellerName: displayName,
      phoneNumber: realPhone || cleanPhone,
      whatsappId: msg.from,
      isSaved: false,
      status: 'new',
      platform: 'olx',
      isBotActive: true,
      channel: 'whatsapp',
    });
    console.log(`[WhatsApp] New lead created for ${displayName} (${cleanPhone})`);
  } else {
    let needsSave = false;
    // Ensure whatsappId is stored
    if (!lead.whatsappId) { lead.whatsappId = msg.from; needsSave = true; }
    // Update sellerName if better name available
    const currentNameIsRawId = /^\d{10,}$/.test(lead.sellerName);
    if (msg.contactName && (lead.sellerName === lead.phoneNumber || currentNameIsRawId)) {
      lead.sellerName = msg.contactName; needsSave = true;
    } else if (currentNameIsRawId && realPhone) {
      lead.sellerName = formatPhoneDisplay(realPhone); needsSave = true;
    }
    // Update phoneNumber if real phone available
    if (realPhone && /^\d{12,}$/.test(lead.phoneNumber) && lead.phoneNumber !== realPhone) {
      lead.phoneNumber = realPhone; needsSave = true;
    }
    if (needsSave) LeadRepo.save();
  }

  // Store incoming message
  MessageRepo.create({
    leadId: lead.id,
    sender: 'seller',
    text: msg.body,
    timestamp: new Date((msg.timestamp || Date.now() / 1000) * 1000).toISOString(),
    channel: 'whatsapp',
    from: msg.from,
  });

  lead.lastMessage = msg.body;
  LeadRepo.save();

  console.log(`[WhatsApp] Incoming message from ${displayName}: "${msg.body.substring(0, 50)}"`);

  // Bot suspicion detection
  if (isBotSuspicion(msg.body)) {
    console.log(`[WhatsApp] ⚠️ BOT SUSPICION detected from ${displayName}: "${msg.body}"`);
    lead.isBotActive = false;
    lead.lastMessage = `⚠️ ALERTĂ: Vânzătorul suspectează bot! Mesaj: "${msg.body}"`;
    LeadRepo.save();
    return;
  }

  console.log(`[WhatsApp] Auto-reply check: botActive=${lead.isBotActive}, geminiAvailable=${gemini.isAvailable}, whatsappId=${lead.whatsappId}`);

  // Auto-reply if bot is active
  if (lead.isBotActive && gemini.isAvailable) {
    try {
      const cfg = ConfigRepo.load();
      const leadMessages = MessageRepo.getByLeadId(lead.id);

      // Analyze conversation
      const analysis = await analyzeConversation(gemini, leadMessages, lead);
      if (analysis) console.log(`[WhatsApp] Pre-reply analysis for ${lead.id}:`, analysis);

      // Update price
      if (updatePriceFromAnalysis(lead, analysis)) {
        console.log(`[WhatsApp] Price updated for ${lead.id}: ${lead.price}`);
      }

      // Update status
      if (analysis?.status === 'negotiating' && (lead.status === 'contacted' || lead.status === 'new')) {
        lead.status = 'negotiating';
        LeadRepo.save();
      }

      // If consensus reached, stop bot
      if (analysis?.status === 'accepted') {
        lead.status = 'accepted';
        lead.isBotActive = false;
        if (analysis.currentPrice) lead.finalPrice = `${Number(analysis.currentPrice)} lei`;
        console.log(`[WhatsApp] CONSENSUS REACHED for ${lead.id} at ${lead.price} — bot deactivated`);

        if (cfg.autosendAddress && cfg.meetingAddress) {
          const addressMsg = `Mulțumesc pentru înțelegere! Ne putem întâlni la: ${cfg.meetingAddress}. Vă convine?`;
          await whatsapp.sendMessage(lead.whatsappId || msg.from, addressMsg);
          MessageRepo.create({ leadId: lead.id, sender: 'me', text: addressMsg, channel: 'whatsapp', to: msg.from });
          lead.status = 'autosend';
          lead.lastMessage = addressMsg;
          console.log(`[WhatsApp] Auto-sent address to ${msg.from}: ${cfg.meetingAddress}`);
        }
        LeadRepo.save();
        return;
      }

      // Generate and send reply
      const replyText = await generateReply(gemini, {
        systemPrompt: cfg.whatsappSystemPrompt,
        lead,
        messages: leadMessages,
        channel: 'whatsapp',
      });

      if (replyText) {
        await whatsapp.sendMessage(lead.whatsappId || msg.from, replyText);
        MessageRepo.create({ leadId: lead.id, sender: 'me', text: replyText, channel: 'whatsapp', to: msg.from });
        lead.lastMessage = replyText;
        lead.lastContacted = new Date().toISOString();
        if (lead.status === 'new') lead.status = 'contacted';
        LeadRepo.save();
        console.log(`[WhatsApp] Auto-reply sent to ${msg.from}: "${replyText.substring(0, 50)}..."`);
      }
    } catch (err) {
      console.error(`[WhatsApp] Auto-reply failed for ${msg.from}:`, err.message);
    }
  }
}

/** Process unanswered messages after WhatsApp restart */
async function processUnansweredMessages(whatsapp, gemini) {
  if (!whatsapp.isConnected || !gemini.isAvailable) return;

  const allMessages = MessageRepo.getAll();
  const leadIds = [...new Set(allMessages.filter(m => m.leadId).map(m => m.leadId))];
  const unanswered = [];

  for (const leadId of leadIds) {
    const leadMsgs = allMessages.filter(m => m.leadId === leadId);
    const lastMsg = leadMsgs[leadMsgs.length - 1];
    if (lastMsg && lastMsg.sender === 'seller' && lastMsg.text && lastMsg.text.trim()) {
      const lead = LeadRepo.findById(leadId);
      if (lead && lead.isBotActive) {
        unanswered.push({ lead, lastMsg });
      }
    }
  }

  if (unanswered.length === 0) {
    console.log('[WhatsApp] No unanswered messages to process after restart.');
    return;
  }

  console.log(`[WhatsApp] Found ${unanswered.length} unanswered message(s) after restart. Processing...`);

  for (const { lead, lastMsg } of unanswered) {
    try {
      if (isBotSuspicion(lastMsg.text)) {
        lead.isBotActive = false;
        lead.lastMessage = `⚠️ ALERTĂ: Vânzătorul suspectează bot! Mesaj: "${lastMsg.text}"`;
        LeadRepo.save();
        console.log(`[WhatsApp] ⚠️ BOT SUSPICION in unanswered for ${lead.sellerName}, skipping`);
        continue;
      }

      if (lead.status === 'accepted' || lead.status === 'autosend') {
        console.log(`[WhatsApp] Skipping unanswered for ${lead.sellerName} — already ${lead.status}`);
        continue;
      }

      const cfg = ConfigRepo.load();
      const leadMessages = MessageRepo.getByLeadId(lead.id);

      // Analyze
      const analysis = await analyzeConversation(gemini, leadMessages, lead);
      updatePriceFromAnalysis(lead, analysis);

      // If accepted
      if (analysis?.status === 'accepted') {
        lead.status = 'accepted';
        lead.isBotActive = false;
        if (analysis.currentPrice) lead.finalPrice = `${Number(analysis.currentPrice)} lei`;
        if (cfg.autosendAddress && cfg.meetingAddress) {
          const addressMsg = `Mulțumesc pentru înțelegere! Ne putem întâlni la: ${cfg.meetingAddress}. Vă convine?`;
          await whatsapp.sendMessage(lead.whatsappId || lastMsg.from, addressMsg);
          MessageRepo.create({ leadId: lead.id, sender: 'me', text: addressMsg, channel: 'whatsapp', to: lead.whatsappId || lastMsg.from });
          lead.status = 'autosend';
          lead.lastMessage = addressMsg;
        }
        LeadRepo.save();
        continue;
      }

      if (analysis?.status === 'negotiating' && (lead.status === 'contacted' || lead.status === 'new')) {
        lead.status = 'negotiating';
      }

      // Generate reply
      const replyText = await generateReply(gemini, {
        systemPrompt: cfg.whatsappSystemPrompt,
        lead,
        messages: leadMessages,
        channel: 'whatsapp',
      });

      if (replyText) {
        await whatsapp.sendMessage(lead.whatsappId || lastMsg.from, replyText);
        MessageRepo.create({ leadId: lead.id, sender: 'me', text: replyText, channel: 'whatsapp', to: lead.whatsappId || lastMsg.from });
        lead.lastMessage = replyText;
        if (lead.status === 'new') lead.status = 'contacted';
        lead.lastContacted = new Date().toISOString();
        LeadRepo.save();
        console.log(`[WhatsApp] Retry auto-reply sent to ${lead.sellerName}: "${replyText.substring(0, 50)}..."`);
      }
    } catch (err) {
      console.error(`[WhatsApp] Retry auto-reply failed for ${lead.sellerName}:`, err.message);
    }
  }
}
