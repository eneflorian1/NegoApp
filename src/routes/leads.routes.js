/**
 * Leads Routes — /api/leads, /api/leads/:id, etc.
 */
import { Router } from 'express';
import LeadRepo from '../db/models/Lead.js';
import MessageRepo from '../db/models/Message.js';
import ConfigRepo from '../db/models/Config.js';
import { generateFirstMessage } from '../core/negotiation-service.js';

export default function createLeadsRoutes({ whatsapp, gemini }) {
  const router = Router();

  router.get('/leads', (req, res) => {
    res.json(LeadRepo.getAll());
  });

  router.post('/leads', (req, res) => {
    const lead = LeadRepo.create(req.body);
    res.json(lead);
  });

  router.put('/leads/:id', (req, res) => {
    const lead = LeadRepo.update(req.params.id, req.body);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  });

  router.delete('/leads/:id', (req, res) => {
    const deleted = LeadRepo.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Lead not found' });
    MessageRepo.deleteByLeadId(req.params.id);
    res.json({ success: true });
  });

  // Send Address (manual trigger from UI)
  router.post('/leads/:id/send-address', async (req, res) => {
    const lead = LeadRepo.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const cfg = ConfigRepo.load();
    const address = req.body.address || cfg.meetingAddress;
    if (!address) return res.status(400).json({ error: 'No address configured' });

    try {
      const addressMsg = `Mulțumesc pentru înțelegere! Ne putem întâlni la: ${address}. Vă convine?`;
      const chatId = lead.whatsappId || lead.phoneNumber;

      if (lead.channel === 'whatsapp' && whatsapp.isConnected) {
        await whatsapp.sendMessage(chatId, addressMsg);
      }

      MessageRepo.create({ leadId: lead.id, sender: 'me', text: addressMsg, channel: lead.channel || 'whatsapp', to: chatId });
      lead.status = 'autosend';
      lead.lastMessage = addressMsg;
      LeadRepo.save();

      res.json({ success: true, message: addressMsg });
    } catch (err) {
      console.error(`[SendAddress] Failed for ${lead.id}:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Manual Start Conversation
  router.post('/leads/:id/start-conversation', async (req, res) => {
    const lead = LeadRepo.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.phoneNumber) return res.status(400).json({ error: 'Lead has no phone number' });
    if (!whatsapp.isConnected) return res.status(400).json({ error: 'WhatsApp not connected' });

    const existingMessages = MessageRepo.getByLeadId(lead.id);
    if (existingMessages.length > 0) {
      return res.status(400).json({ error: 'Conversation already started', existingMessages: existingMessages.length });
    }

    try {
      let replyText = req.body.text;

      if (!replyText && gemini.isAvailable) {
        const cfg = ConfigRepo.load();
        replyText = await generateFirstMessage(gemini, {
          systemPrompt: cfg.whatsappSystemPrompt || 'Esti un asistent de negociere. Raspunde scurt si prietenos in limba romana.',
          lead,
        });
      }

      if (!replyText) return res.status(500).json({ error: 'Could not generate message (Gemini unavailable or returned empty)' });

      let waId = lead.whatsappId;
      if (!waId) {
        waId = lead.phoneNumber.replace(/[^0-9]/g, '');
        if (waId.startsWith('0')) waId = '40' + waId.substring(1);
        waId = waId + '@c.us';
      }

      await whatsapp.sendMessage(waId, replyText);

      const outMsg = MessageRepo.create({ leadId: lead.id, sender: 'me', text: replyText, channel: 'whatsapp', to: waId });

      lead.status = 'contacted';
      lead.lastContacted = new Date().toISOString();
      lead.lastMessage = replyText;
      lead.whatsappId = waId;
      LeadRepo.save();

      console.log(`[ManualStart] First message sent to ${lead.sellerName} (${lead.phoneNumber}): "${replyText.substring(0, 60)}..."`);
      res.json({ success: true, message: outMsg, lead });
    } catch (err) {
      console.error(`[ManualStart] Failed:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
