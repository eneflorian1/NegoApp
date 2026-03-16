/**
 * Messages Routes — /api/messages, /api/conversations, etc.
 */
import { Router } from 'express';
import LeadRepo from '../db/models/Lead.js';
import MessageRepo from '../db/models/Message.js';

export default function createMessagesRoutes({ whatsapp, agentmail }) {
  const router = Router();

  router.get('/messages', (req, res) => {
    let result = MessageRepo.getAll();
    if (req.query.channel) {
      result = result.filter(m => m.channel === req.query.channel);
    }
    res.json(result);
  });

  router.get('/messages/:leadId', (req, res) => {
    res.json(MessageRepo.getByLeadId(req.params.leadId));
  });

  router.delete('/conversations/:leadId', (req, res) => {
    const { leadId } = req.params;
    const deleteLead = req.query.deleteLead === 'true';

    MessageRepo.deleteByLeadId(leadId);

    if (deleteLead) {
      LeadRepo.delete(leadId);
    }

    res.json({ success: true });
  });

  router.post('/messages/send', async (req, res) => {
    const { leadId, text, channel, to } = req.body;
    if (!text || !channel) return res.status(400).json({ error: 'text and channel are required' });

    try {
      let result = {};
      if (channel === 'whatsapp') {
        if (!whatsapp.isConnected) return res.status(400).json({ error: 'WhatsApp not connected' });
        const lead = leadId ? LeadRepo.findById(leadId) : null;
        const waRecipient = (lead && lead.whatsappId) || to;
        result = await whatsapp.sendMessage(waRecipient, text);
      } else if (channel === 'email') {
        if (!agentmail.isConnected) return res.status(400).json({ error: 'AgentMail not connected' });
        result = await agentmail.sendEmail({ to, subject: req.body.subject || 'NegoApp', text });
      }

      const message = MessageRepo.create({ leadId: leadId || null, sender: 'me', text, channel, to });
      res.json(message);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
