/**
 * Messages Routes — /api/messages, /api/conversations, etc.
 */
import { Router } from 'express';
import LeadRepo from '../db/models/Lead.js';
import MessageRepo from '../db/models/Message.js';
import { requireAuth } from '../middleware/auth.js';

export default function createMessagesRoutes({ whatsapp, agentmail }) {
  const router = Router();

  router.use(requireAuth);

  router.get('/messages', (req, res) => {
    let result = MessageRepo.getAll(req.user.id);
    if (req.query.channel) {
      result = result.filter(m => m.channel === req.query.channel);
    }
    res.json(result);
  });

  router.get('/messages/:leadId', (req, res) => {
    // Verify lead belongs to user
    const lead = LeadRepo.findById(req.params.leadId);
    if (!lead || lead.userId !== req.user.id) return res.status(404).json({ error: 'Lead not found' });
    res.json(MessageRepo.getByLeadId(req.params.leadId));
  });

  router.delete('/conversations/:leadId', (req, res) => {
    const { leadId } = req.params;
    const deleteLead = req.query.deleteLead === 'true';

    const lead = LeadRepo.findById(leadId);
    if (!lead || lead.userId !== req.user.id) return res.status(404).json({ error: 'Lead not found' });

    MessageRepo.deleteByLeadId(leadId);
    if (deleteLead) LeadRepo.delete(leadId);

    res.json({ success: true });
  });

  router.post('/messages/send', async (req, res) => {
    const { leadId, text, channel, to } = req.body;
    if (!text || !channel) return res.status(400).json({ error: 'text and channel are required' });

    try {
      let result = {};
      if (channel === 'whatsapp') {
        const waClient = whatsapp.getClient ? whatsapp.getClient(req.user.id) : whatsapp;
        if (!waClient?.isConnected) return res.status(400).json({ error: 'WhatsApp not connected' });
        const lead = leadId ? LeadRepo.findById(leadId) : null;
        const waRecipient = (lead && lead.whatsappId) || to;
        result = await waClient.sendMessage(waRecipient, text);
      } else if (channel === 'email') {
        if (!agentmail.isConnected) return res.status(400).json({ error: 'AgentMail not connected' });
        result = await agentmail.sendEmail({ to, subject: req.body.subject || 'NegoApp', text });
      }

      const message = MessageRepo.create({ userId: req.user.id, leadId: leadId || null, sender: 'me', text, channel, to });
      res.json(message);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
