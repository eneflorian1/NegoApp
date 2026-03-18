/**
 * Email (AgentMail) Message Handler — extracted from server.js
 * Handles incoming emails: lead creation, AI analysis, auto-reply.
 */
import LeadRepo from '../db/models/Lead.js';
import MessageRepo from '../db/models/Message.js';
import ConfigRepo from '../db/models/Config.js';
import { analyzeConversation, updatePriceFromAnalysis, generateReply } from '../core/negotiation-service.js';

/**
 * Wire up AgentMail event handlers.
 * @param {MailClient} agentmail
 * @param {GeminiClient} gemini
 */
export function setupEmailHandler(agentmail, gemini) {
  agentmail.on('message', async (msg) => {
    await handleIncomingEmail(msg, agentmail, gemini);
  });
}

/** Handle a single incoming email */
async function handleIncomingEmail(msg, agentmail, gemini) {
  const senderEmail = msg.from.replace(/.*</, '').replace(/>.*/, '').trim();
  const senderName = msg.from.includes('<') ? msg.from.replace(/<.*/, '').trim() : senderEmail;

  // Find or create lead
  const leads = LeadRepo.getAll();
  let lead = leads.find(l => l.phoneNumber === senderEmail || l.sellerName === senderEmail);

  if (!lead) {
    lead = LeadRepo.create({
      url: '',
      title: msg.subject || 'Email Conversation',
      initialPrice: '',
      price: '',
      sellerName: senderName || senderEmail,
      phoneNumber: senderEmail,
      isSaved: false,
      status: 'new',
      platform: 'olx',
      isBotActive: true,
      channel: 'email',
    });
    console.log(`[AgentMail] New lead created for ${senderEmail}`);
  }

  // Store incoming message
  MessageRepo.create({
    leadId: lead.id,
    sender: 'seller',
    text: msg.text,
    timestamp: msg.timestamp || new Date().toISOString(),
    channel: 'email',
    from: msg.from,
    subject: msg.subject,
    emailMessageId: msg.messageId,
  });

  lead.lastMessage = msg.text.substring(0, 100);
  LeadRepo.save();

  console.log(`[AgentMail] Incoming email from ${senderEmail}: "${msg.subject}", text="${msg.text.substring(0, 80)}"`);
  console.log(`[AgentMail] Auto-reply check: botActive=${lead.isBotActive}, geminiAvailable=${gemini.isAvailable}`);

  // Auto-reply
  if (lead.isBotActive && gemini.isAvailable) {
    try {
      const cfg = ConfigRepo.load();
      const leadMessages = MessageRepo.getByLeadId(lead.id);

      // Analyze conversation
      const analysis = await analyzeConversation(gemini, leadMessages, lead);
      if (analysis) console.log(`[AgentMail] Pre-reply analysis for ${lead.id}:`, analysis);

      // Update price
      updatePriceFromAnalysis(lead, analysis);

      if (analysis?.status === 'negotiating' && (lead.status === 'contacted' || lead.status === 'new')) {
        lead.status = 'negotiating';
      }

      // If consensus, stop
      if (analysis?.status === 'accepted') {
        lead.status = 'accepted';
        lead.isBotActive = false;
        if (analysis.currentPrice) lead.finalPrice = lead.price;
        console.log(`[AgentMail] CONSENSUS REACHED for ${lead.id} at ${lead.price} — bot deactivated`);
        LeadRepo.save();
        return;
      }

      // Generate and send reply
      const replyText = await generateReply(gemini, {
        systemPrompt: cfg.emailSystemPrompt,
        lead,
        messages: leadMessages,
        channel: 'email',
      });

      if (replyText) {
        await agentmail.replyToMessage(msg.messageId, { text: replyText });
        MessageRepo.create({ leadId: lead.id, sender: 'me', text: replyText, channel: 'email', to: senderEmail });
        lead.lastMessage = replyText.substring(0, 100);
        if (lead.status === 'new') lead.status = 'contacted';
        lead.lastContacted = new Date().toISOString();
        LeadRepo.save();
        console.log(`[AgentMail] Auto-reply sent to ${senderEmail}`);
      }
    } catch (err) {
      console.error(`[AgentMail] Auto-reply failed for ${senderEmail}:`, err.message);
    }
  }
}
