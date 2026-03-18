/**
 * WhatsApp Client — uses whatsapp-web.js (Puppeteer/Chrome)
 * Supports per-user auth paths for multi-user isolation.
 */
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import QRCode from 'qrcode';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import { existsSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_BASE = join(__dirname, '..', '..', 'data', '.wwebjs_auth');

/** Check if a saved LocalAuth session exists for a userId */
function hasAuthenticatedSession(userId = 'default') {
  const sessionDir = join(AUTH_BASE, userId, 'session');
  return existsSync(sessionDir);
}

class WhatsAppClient extends EventEmitter {
  constructor(userId = 'default') {
    super();
    this.userId = userId;
    this.authPath = join(AUTH_BASE, userId);
    this.client = null;
    this.isConnected = false;
    this.isInitializing = false;
    this.qrCodeData = null;
    this.sessionInfo = null;
    this.lastError = null;
    this.pairingCode = null;

    this.on('error', (err) => {
      console.error(`[WhatsApp:${userId}] Unhandled error:`, err.message);
    });
  }

  async connect() {
    if (this.isConnected) return { status: 'already_connected' };
    if (this.isInitializing) return { status: 'initializing' };

    if (this.client) {
      try { await this.client.destroy(); } catch {}
      this.client = null;
    }

    this.isInitializing = true;
    this.lastError = null;
    this.qrCodeData = null;

    try {
      this.client = new Client({
        authStrategy: new LocalAuth({ dataPath: this.authPath }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-extensions',
          ],
        },
      });

      this.client.on('qr', async (qr) => {
        console.log(`[WhatsApp:${this.userId}] QR code received`);
        try {
          this.qrCodeData = await QRCode.toDataURL(qr, { width: 512, margin: 2 });
          this.emit('qr', this.qrCodeData);
        } catch (err) {
          console.error(`[WhatsApp:${this.userId}] QR generation error:`, err.message);
        }
      });

      this.client.on('authenticated', () => {
        console.log(`[WhatsApp:${this.userId}] Session authenticated`);
        this.qrCodeData = null;
        this.emit('authenticated');
      });

      this.client.on('ready', () => {
        console.log(`[WhatsApp:${this.userId}] Client ready!`);
        this.isConnected = true;
        this.isInitializing = false;
        this.qrCodeData = null;

        const info = this.client.info;
        this.sessionInfo = {
          phone: info?.wid?.user || null,
          name: info?.pushname || null,
          platform: 'whatsapp-web.js',
        };

        this.emit('authenticated');
        this.emit('ready', this.sessionInfo);
      });

      this.client.on('auth_failure', (msg) => {
        console.error(`[WhatsApp:${this.userId}] Auth failure:`, msg);
        this.isConnected = false;
        this.isInitializing = false;
        this.lastError = `Auth failed: ${msg}. Please reconnect.`;
        this.client = null;
        try { rmSync(this.authPath, { recursive: true, force: true }); } catch {}
        this.emit('auth_failure', msg);
      });

      this.client.on('disconnected', (reason) => {
        console.log(`[WhatsApp:${this.userId}] Disconnected:`, reason);
        this.isConnected = false;
        this.isInitializing = false;
        this.sessionInfo = null;
        this.qrCodeData = null;
        this.lastError = null;
        this.client = null;
        this.emit('disconnected', reason);
      });

      this.client.on('message', async (msg) => {
        if (msg.fromMe) return;
        if (!msg.body && msg.type === 'chat') return;

        let contactName = null;
        let contactNumber = null;
        try {
          const contact = await msg.getContact();
          contactName = contact.pushname || contact.name || null;
          contactNumber = contact.number || null;
        } catch { /* ignore */ }

        this.emit('message', {
          from: msg.from,
          body: msg.body || '',
          timestamp: msg.timestamp,
          type: msg.type,
          contactName,
          contactNumber,
        });
      });

      console.log(`[WhatsApp:${this.userId}] Starting Chrome...`);
      this.client.initialize().catch((err) => {
        console.error(`[WhatsApp:${this.userId}] Initialize error:`, err.message);
        this.isInitializing = false;
        this.lastError = err.message;
        this.client = null;
      });

      return { status: 'initializing' };
    } catch (err) {
      this.isInitializing = false;
      this.lastError = err.message;
      console.error(`[WhatsApp:${this.userId}] Connect error:`, err.message);
      return { status: 'error', error: err.message };
    }
  }

  async requestPairingCode(phoneNumber) {
    return {
      status: 'error',
      error: 'Pairing code is not supported. Please scan the QR code to connect.',
    };
  }

  async sendMessage(chatIdOrPhone, message) {
    if (!this.isConnected || !this.client) {
      throw new Error('WhatsApp not connected. Please authenticate first.');
    }

    let chatId;
    if (chatIdOrPhone.includes('@')) {
      chatId = chatIdOrPhone.replace('@s.whatsapp.net', '@c.us');
    } else {
      chatId = chatIdOrPhone.replace(/[^0-9]/g, '') + '@c.us';
    }

    const result = await this.client.sendMessage(chatId, message);

    return {
      status: 'sent',
      messageId: result?.id?._serialized || `wa-${Date.now()}`,
      to: chatIdOrPhone,
      timestamp: Date.now(),
    };
  }

  async disconnect() {
    if (this.client) {
      try { await this.client.logout(); } catch {}
      try { await this.client.destroy(); } catch {}
    }
    try { rmSync(this.authPath, { recursive: true, force: true }); } catch {}

    this.isConnected = false;
    this.isInitializing = false;
    this.sessionInfo = null;
    this.qrCodeData = null;
    this.pairingCode = null;
    this.client = null;
  }

  getQR() { return this.qrCodeData; }

  getStatus() {
    return {
      connected: this.isConnected,
      initializing: this.isInitializing,
      phone: this.sessionInfo?.phone || null,
      name: this.sessionInfo?.name || null,
      hasQR: !!this.qrCodeData,
      pairingCode: this.pairingCode || null,
      error: this.lastError,
      clientExists: !!this.client,
      timestamp: Date.now(),
    };
  }
}

export default WhatsAppClient;
export { hasAuthenticatedSession };
