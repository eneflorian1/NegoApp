/**
 * AgentMail Client - Email channel using the AgentMail SDK
 *
 * Handles inbox creation, message polling, sending, and replying.
 */
import { AgentMailClient as SDK } from 'agentmail';
import { EventEmitter } from 'events';

class MailClient extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.isConnected = false;
    this.inboxId = null;
    this.inboxEmail = null;
    this.lastError = null;
    this.knownMessageIds = new Set();
    this.pollInterval = null;
    this._isFirstPoll = true; // Track first poll to silently skip old messages

    this.on('error', (err) => {
      console.error('[AgentMail] Unhandled error:', err.message);
    });
  }

  /**
   * Connect with API key — create or reuse an inbox
   */
  async connect(apiKey) {
    if (!apiKey) {
      this.lastError = 'No API key provided';
      return { status: 'error', error: this.lastError };
    }

    try {
      this.client = new SDK({ apiKey });

      // List existing inboxes, reuse first one or create new
      const { inboxes } = await this.client.inboxes.list();
      let inbox;
      if (inboxes && inboxes.length > 0) {
        inbox = inboxes[0];
      } else {
        inbox = await this.client.inboxes.create({});
      }

      this.inboxId = inbox.inboxId || inbox.inbox_id || inbox.id;
      // Try SDK properties first, then construct from inboxId
      let email = (inbox.email || inbox.address || inbox.emailAddress || '').toLowerCase();
      if (!email && this.inboxId) {
        email = `${this.inboxId}@agentmail.to`;
      }
      this.inboxEmail = email;
      this.isConnected = true;
      this.lastError = null;
      this._isFirstPoll = true;

      console.log(`[AgentMail] Connected — inbox: ${this.inboxEmail}`);

      // Start polling for new messages
      this.startPolling();

      return { status: 'connected', email: this.inboxEmail };
    } catch (err) {
      this.isConnected = false;
      const msg = err.statusCode === 403
        ? 'API key invalid or expired (403 Forbidden). Check your key in Settings.'
        : err.message;
      this.lastError = msg;
      console.error('[AgentMail] Connect error:', msg);
      return { status: 'error', error: msg };
    }
  }

  /**
   * Poll for new messages every 10 seconds
   */
  startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => this.checkNewMessages(), 10000);
    // Initial check
    this.checkNewMessages();
  }

  async checkNewMessages() {
    if (!this.isConnected || !this.client || !this.inboxId) return;

    try {
      const { messages } = await this.client.inboxes.messages.list(this.inboxId);
      if (!messages) return;

      if (this._isFirstPoll) {
        this._isFirstPoll = false;
        if (messages.length > 0) {
          const sample = messages.slice(0, 3).map(m => `"${m.subject || 'fara subiect'}" (${m.createdAt || m.timestamp})`).join(', ');
          console.log(`[AgentMail] Debug - Primele mesaje gasite: ${sample}`);
        }
        for (const msg of messages) {
          const msgId = msg.messageId || msg.id;
          this.knownMessageIds.add(msgId);
        }
        console.log(`[AgentMail] Indexed ${messages.length} existing messages (skipped on startup)`);
        return;
      }

      for (const msg of messages) {
        const msgId = msg.messageId || msg.id;
        if (!this.knownMessageIds.has(msgId)) {
          this.knownMessageIds.add(msgId);
          // Only emit for messages not sent by us (incoming)
          const fromAddr = (msg.from || '').replace(/.*</, '').replace(/>.*/, '').trim().toLowerCase();
          const fromSelf = this.inboxEmail && (
            fromAddr === this.inboxEmail ||
            fromAddr.includes(this.inboxId?.toLowerCase?.() || '___')
          );
          const isExternalAgent = fromAddr.endsWith('@agentmail.to') && !fromSelf;

          if (isExternalAgent) {
            console.log(`[AgentMail] Ignored message from external agent: ${fromAddr}`);
          }

          if (!fromSelf && !isExternalAgent) {
            // List endpoint may not include body — fetch full message
            let text = msg.text || '';
            if (!text && msg.html) {
              text = msg.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            }
            if (!text && this.client && msgId) {
              try {
                const full = await this.client.inboxes.messages.get(this.inboxId, msgId);
                text = full.text || '';
                if (!text && full.html) {
                  text = full.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                }
              } catch {}
            }
            // Fallback to subject if body is still empty
            if (!text && msg.subject) {
              text = msg.subject;
            }

            this.emit('message', {
              messageId: msgId,
              threadId: msg.threadId,
              from: msg.from || '',
              to: Array.isArray(msg.to) ? msg.to.join(', ') : (msg.to || ''),
              subject: msg.subject || '',
              text,
              timestamp: msg.timestamp || msg.createdAt || new Date().toISOString(),
            });
          }
        }
      }
    } catch (err) {
      console.error('[AgentMail] Poll error:', err.message);
    }
  }

  /**
   * Send a new email
   */
  async sendEmail({ to, subject, text }) {
    if (!this.isConnected || !this.client || !this.inboxId) {
      throw new Error('AgentMail not connected');
    }

    const result = await this.client.inboxes.messages.send(this.inboxId, {
      to: [to],
      subject,
      text,
    });

    return result;
  }

  /**
   * Reply to a message
   */
  async replyToMessage(messageId, { text }) {
    if (!this.isConnected || !this.client || !this.inboxId) {
      throw new Error('AgentMail not connected');
    }

    const result = await this.client.inboxes.messages.reply(this.inboxId, messageId, {
      text,
    });

    return result;
  }

  /**
   * Disconnect and stop polling
   */
  disconnect() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isConnected = false;
    this.client = null;
    this.inboxId = null;
    this.inboxEmail = null;
    this._isFirstPoll = true;
  }

  getStatus() {
    return {
      connected: this.isConnected,
      email: this.inboxEmail || null,
      error: this.lastError,
    };
  }
}

export default MailClient;
