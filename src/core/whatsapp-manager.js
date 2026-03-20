/**
 * WhatsApp Manager — manages per-user WhatsApp client instances
 */
import WhatsAppClient, { hasAuthenticatedSession } from '../channels/whatsapp-client.js';
import { setupWhatsAppHandler } from '../channels/whatsapp-handler.js';

class WhatsAppManager {
  constructor(gemini) {
    this.gemini = gemini;
    this.clients = new Map(); // Map<userId, WhatsAppClient>
  }

  hasSession(userId) {
    return hasAuthenticatedSession(userId);
  }

  getClient(userId) {
    return this.clients.get(userId) || null;
  }

  /** Get existing or create new WhatsAppClient for a user */
  getOrCreate(userId) {
    if (!this.clients.has(userId)) {
      const client = new WhatsAppClient(userId);
      setupWhatsAppHandler(client, this.gemini, userId);
      this.clients.set(userId, client);
    }
    return this.clients.get(userId);
  }

  async connect(userId) {
    const client = this.getOrCreate(userId);
    return client.connect();
  }

  async disconnect(userId) {
    const client = this.clients.get(userId);
    if (!client) return;
    await client.disconnect();
    this.clients.delete(userId);
  }

  getStatus(userId) {
    const client = this.clients.get(userId);
    if (!client) {
      return { connected: false, initializing: false, phone: null, name: null, hasQR: false, error: null, clientExists: false, timestamp: Date.now() };
    }
    return client.getStatus();
  }

  getQR(userId) {
    return this.clients.get(userId)?.getQR() || null;
  }

  sendMessage(userId, chatId, message) {
    const client = this.clients.get(userId);
    if (!client) throw new Error('WhatsApp not connected for this user');
    return client.sendMessage(chatId, message);
  }

  isConnected(userId) {
    return this.clients.get(userId)?.isConnected || false;
  }

  /** Destroy all client instances (for graceful shutdown) */
  async destroyAll() {
    for (const [userId, client] of this.clients) {
      try {
        if (client.client) {
          await Promise.race([
            client.client.destroy(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
          ]);
        }
      } catch (err) {
        console.warn(`[WhatsAppManager] Destroy failed for ${userId}: ${err.message}`);
      }
    }
    this.clients.clear();
  }

  /** Auto-connect users that have saved sessions */
  async autoConnectAll(userIds) {
    for (const userId of userIds) {
      if (this.hasSession(userId)) {
        console.log(`[WhatsAppManager] Auto-connecting user ${userId}...`);
        try {
          await this.connect(userId);
        } catch (err) {
          console.log(`[WhatsAppManager] Auto-connect failed for ${userId}:`, err.message);
        }
      }
    }
  }
}

export default WhatsAppManager;
