/**
 * Leads Routes — /api/leads, /api/leads/:id, etc.
 */
import { Router } from 'express';
import LeadRepo from '../db/models/Lead.js';
import MessageRepo from '../db/models/Message.js';
import ConfigRepo from '../db/models/Config.js';
import { requireAuth } from '../middleware/auth.js';
import { generateFirstMessage } from '../core/negotiation-service.js';

export default function createLeadsRoutes({ whatsapp, gemini }) {
  const router = Router();

  router.use(requireAuth);

  router.get('/leads', (req, res) => {
    res.json(LeadRepo.getAll(req.user.id));
  });

  router.post('/leads', (req, res) => {
    const lead = LeadRepo.create({ ...req.body, userId: req.user.id });
    res.json(lead);
  });

  router.put('/leads/:id', (req, res) => {
    const lead = LeadRepo.findById(req.params.id);
    if (!lead || lead.userId !== req.user.id) return res.status(404).json({ error: 'Lead not found' });
    const updated = LeadRepo.update(req.params.id, req.body);
    res.json(updated);
  });

  router.delete('/leads/:id', (req, res) => {
    const lead = LeadRepo.findById(req.params.id);
    if (!lead || lead.userId !== req.user.id) return res.status(404).json({ error: 'Lead not found' });
    LeadRepo.delete(req.params.id);
    MessageRepo.deleteByLeadId(req.params.id);
    res.json({ success: true });
  });

  router.post('/leads/:id/send-address', async (req, res) => {
    const lead = LeadRepo.findById(req.params.id);
    if (!lead || lead.userId !== req.user.id) return res.status(404).json({ error: 'Lead not found' });

    const cfg = ConfigRepo.load(req.user.id);
    const address = req.body.address || cfg.meetingAddress;
    if (!address) return res.status(400).json({ error: 'No address configured' });

    try {
      const addressMsg = `Mulțumesc pentru înțelegere! Ne putem întâlni la: ${address}. Vă convine?`;
      const chatId = lead.whatsappId || lead.phoneNumber;

      const waClient = whatsapp.getClient ? whatsapp.getClient(req.user.id) : whatsapp;
      if (lead.channel === 'whatsapp' && waClient?.isConnected) {
        await waClient.sendMessage(chatId, addressMsg);
      }

      MessageRepo.create({ userId: req.user.id, leadId: lead.id, sender: 'me', text: addressMsg, channel: lead.channel || 'whatsapp', to: chatId });
      lead.status = 'autosend';
      lead.lastMessage = addressMsg;
      LeadRepo.save();

      res.json({ success: true, message: addressMsg });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/leads/:id/start-conversation', async (req, res) => {
    const lead = LeadRepo.findById(req.params.id);
    if (!lead || lead.userId !== req.user.id) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.phoneNumber) return res.status(400).json({ error: 'Lead has no phone number' });

    const waClient = whatsapp.getClient ? whatsapp.getClient(req.user.id) : whatsapp;
    if (!waClient?.isConnected) return res.status(400).json({ error: 'WhatsApp not connected' });

    const existingMessages = MessageRepo.getByLeadId(lead.id);
    if (existingMessages.length > 0) {
      return res.status(400).json({ error: 'Conversation already started', existingMessages: existingMessages.length });
    }

    try {
      const cfg = ConfigRepo.load(req.user.id);
      const userGemini = gemini.forKey(cfg.geminiApiKey);
      let replyText = req.body.text;

      if (!replyText && userGemini.isAvailable) {
        replyText = await generateFirstMessage(userGemini, {
          systemPrompt: cfg.whatsappSystemPrompt || 'Esti un asistent de negociere. Raspunde scurt si prietenos in limba romana.',
          lead,
        });
      }

      if (!replyText) return res.status(500).json({ error: 'Could not generate message' });

      let waId = lead.whatsappId;
      if (!waId) {
        waId = lead.phoneNumber.replace(/[^0-9]/g, '');
        if (waId.startsWith('0')) waId = '40' + waId.substring(1);
        waId = waId + '@s.whatsapp.net';
      }

      await waClient.sendMessage(waId, replyText);
      const outMsg = MessageRepo.create({ userId: req.user.id, leadId: lead.id, sender: 'me', text: replyText, channel: 'whatsapp', to: waId });

      lead.status = 'contacted';
      lead.lastContacted = new Date().toISOString();
      lead.lastMessage = replyText;
      lead.whatsappId = waId;
      // Freeze system prompt at conversation start if not already set
      if (!lead.systemPrompt) {
        lead.systemPrompt = cfg.whatsappSystemPrompt || '';
      }
      LeadRepo.save();

      res.json({ success: true, message: outMsg, lead });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
