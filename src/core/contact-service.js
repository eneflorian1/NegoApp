/**
 * Contact Service — auto-contact seller after phone reveal
 * Extracted from server.js autoContactSeller().
 */
import LeadRepo from '../db/models/Lead.js';
import MessageRepo from '../db/models/Message.js';
import ConfigRepo from '../db/models/Config.js';
import { normalizePhone, phoneToWhatsAppId } from '../utils/phone.js';
import { sanitizePrice } from '../utils/price.js';
import { generateFirstMessage } from './negotiation-service.js';

/**
 * Auto-contact a seller after a successful phone reveal.
 * Creates a lead, generates a first message via Gemini, and sends via WhatsApp.
 * @param {object} result - reveal result with { phone, listing, url }
 * @param {object} deps - { gemini, whatsapp }
 * @returns {object|null} lead
 */
export async function autoContactSeller(result, { gemini, whatsapp }) {
  if (!result.phone) return null;

  const cfg = ConfigRepo.load();
  if (!cfg.autoPilotEnabled) {
    console.log('[AutoContact] AutoPilot disabled, skipping auto-contact');
    return null;
  }

  const phone = result.phone;
  const listing = result.listing || {};
  const title = listing.title || 'Anunt';
  const price = sanitizePrice(listing.price || '');
  const sellerName = listing.sellerName || phone;
  const url = result.url || '';

  // Check if lead already exists for this phone
  const leads = LeadRepo.getAll();
  let lead = leads.find(l => normalizePhone(l.phoneNumber) === normalizePhone(phone));
  if (lead) {
    console.log(`[AutoContact] Lead already exists for ${phone}, skipping`);
    return lead;
  }

  // Create lead
  lead = LeadRepo.create({
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
  });
  console.log(`[AutoContact] Lead created: ${lead.id} — ${sellerName} (${phone})`);

  // Generate first message using Gemini
  if (!gemini.isAvailable) {
    console.log('[AutoContact] Gemini not available, lead created but no message sent');
    return lead;
  }

  try {
    const replyText = await generateFirstMessage(gemini, {
      systemPrompt: cfg.whatsappSystemPrompt,
      lead: { ...lead },
    });

    if (!replyText) {
      console.log('[AutoContact] Gemini returned empty response');
      return lead;
    }

    // Send via WhatsApp
    if (!whatsapp.isConnected) {
      console.log('[AutoContact] WhatsApp not connected, lead created but message not sent');
      return lead;
    }

    const waId = phoneToWhatsAppId(phone);
    await whatsapp.sendMessage(waId, replyText);

    // Store outgoing message
    MessageRepo.create({
      leadId: lead.id,
      sender: 'me',
      text: replyText,
      channel: 'whatsapp',
      to: waId,
    });

    // Update lead
    lead.status = 'contacted';
    lead.lastContacted = new Date().toISOString();
    lead.lastMessage = replyText;
    lead.whatsappId = waId;
    LeadRepo.save();

    console.log(`[AutoContact] First message sent to ${phone}: "${replyText.substring(0, 60)}..."`);
    return lead;
  } catch (err) {
    console.error(`[AutoContact] Failed to send first message to ${phone}:`, err.message);
    return lead;
  }
}
