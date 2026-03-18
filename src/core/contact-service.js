/**
 * Contact Service — auto-contact seller after phone reveal (per-user)
 */
import LeadRepo from '../db/models/Lead.js';
import MessageRepo from '../db/models/Message.js';
import ConfigRepo from '../db/models/Config.js';
import { normalizePhone, phoneToWhatsAppId } from '../utils/phone.js';
import { sanitizePrice } from '../utils/price.js';
import { generateFirstMessage } from './negotiation-service.js';

/**
 * Auto-contact a seller after a successful phone reveal.
 * @param {object} result - reveal result with { phone, listing, url }
 * @param {object} deps - { gemini, whatsapp, userId }
 */
export async function autoContactSeller(result, { gemini, whatsapp, userId }) {
  if (!result.phone || !userId) return null;

  const cfg = ConfigRepo.load(userId);
  if (!cfg.autoPilotEnabled) {
    console.log(`[AutoContact:${userId}] AutoPilot disabled, skipping`);
    return null;
  }

  const phone = result.phone;
  const listing = result.listing || {};
  const title = listing.title || 'Anunt';
  const price = sanitizePrice(listing.price || '');
  const sellerName = listing.sellerName || phone;
  const url = result.url || '';

  // Check if lead already exists for this user + phone
  const userLeads = LeadRepo.getAll(userId);
  let lead = userLeads.find(l => normalizePhone(l.phoneNumber) === normalizePhone(phone));
  if (lead) {
    console.log(`[AutoContact:${userId}] Lead already exists for ${phone}`);
    return lead;
  }

  lead = LeadRepo.create({
    userId,
    url,
    title,
    initialPrice: price,
    price,
    sellerName,
    phoneNumber: phone,
    isSaved: false,
    status: 'new',
    platform: 'olx',
    isBotActive: true,
    channel: 'whatsapp',
    // Freeze the system prompt at conversation start time
    systemPrompt: cfg.whatsappSystemPrompt || '',
  });
  console.log(`[AutoContact:${userId}] Lead created: ${lead.id} — ${sellerName} (${phone})`);

  // Use user-scoped gemini key
  const userGemini = gemini.forKey(cfg.geminiApiKey);
  if (!userGemini.isAvailable) {
    console.log(`[AutoContact:${userId}] Gemini not available, lead created but no message sent`);
    return lead;
  }

  try {
    const replyText = await generateFirstMessage(userGemini, {
      systemPrompt: cfg.whatsappSystemPrompt,
      lead: { ...lead },
    });

    if (!replyText) {
      console.log(`[AutoContact:${userId}] Gemini returned empty response`);
      return lead;
    }

    const waConnected = typeof whatsapp.isConnected === 'function'
      ? whatsapp.isConnected(userId)
      : whatsapp.isConnected;

    if (!waConnected) {
      console.log(`[AutoContact:${userId}] WhatsApp not connected`);
      return lead;
    }

    const waId = phoneToWhatsAppId(phone);
    if (typeof whatsapp.sendMessage === 'function' && whatsapp.clients) {
      // WhatsAppManager
      await whatsapp.sendMessage(userId, waId, replyText);
    } else {
      // Direct WhatsAppClient
      await whatsapp.sendMessage(waId, replyText);
    }

    MessageRepo.create({
      userId,
      leadId: lead.id,
      sender: 'me',
      text: replyText,
      channel: 'whatsapp',
      to: waId,
    });

    lead.status = 'contacted';
    lead.lastContacted = new Date().toISOString();
    lead.lastMessage = replyText;
    lead.whatsappId = waId;
    LeadRepo.save();

    console.log(`[AutoContact:${userId}] First message sent to ${phone}: "${replyText.substring(0, 60)}..."`);
    return lead;
  } catch (err) {
    console.error(`[AutoContact:${userId}] Failed to send first message to ${phone}:`, err.message);
    return lead;
  }
}
