/**
 * WhatsApp Client — Real implementation using whatsapp-web.js
 * 
 * Handles WhatsApp connectivity via QR code authentication.
 * Session persisted in data/.wwebjs_auth/
 */
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import QRCode from 'qrcode';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_PATH = join(__dirname, '..', '..', 'data', '.wwebjs_auth');

class WhatsAppClient extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.isConnected = false;
    this.isInitializing = false;
    this.qrCodeData = null;   // base64 PNG
    this.sessionInfo = null;
    this.lastError = null;

    // Prevent unhandled 'error' events from crashing the process
    this.on('error', (err) => {
      console.error('[WhatsApp] Unhandled error:', err.message);
    });
  }

  /**
   * Initialize WhatsApp connection — generates QR code for scanning
   */
  async connect() {
    if (this.isConnected) return { status: 'already_connected' };
    if (this.isInitializing) return { status: 'initializing' };

    // Clean up any previous failed client
    if (this.client) {
      try { await this.client.destroy(); } catch {}
      this.client = null;
    }

    this.isInitializing = true;
    this.lastError = null;
    this.qrCodeData = null;

    try {
      this.client = new Client({
        authStrategy: new LocalAuth({ dataPath: AUTH_PATH }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-features=site-per-process',
          ],
        },
      });

      this.client.on('qr', async (qr) => {
        console.log('[WhatsApp] QR code received');
        try {
          this.qrCodeData = await QRCode.toDataURL(qr, { width: 256 });
          this.emit('qr', this.qrCodeData);
        } catch (err) {
          console.error('[WhatsApp] QR generation error:', err.message);
        }
      });

      this.client.on('ready', () => {
        console.log('[WhatsApp] Client ready!');
        this.isConnected = true;
        this.isInitializing = false;
        this.qrCodeData = null;

        const info = this.client.info;
        this.sessionInfo = {
          phone: info?.wid?.user || null,
          name: info?.pushname || null,
          platform: info?.platform || null,
        };
        this.emit('ready', this.sessionInfo);
      });

      this.client.on('authenticated', () => {
        console.log('[WhatsApp] Authenticated');
        this.emit('authenticated');
      });

      this.client.on('auth_failure', (msg) => {
        console.error('[WhatsApp] Auth failure:', msg);
        this.lastError = `Authentication failed: ${msg}`;
        this.isInitializing = false;
        this.emit('auth_failure', msg);
      });

      this.client.on('disconnected', (reason) => {
        console.log('[WhatsApp] Disconnected:', reason);
        this.isConnected = false;
        this.sessionInfo = null;
        this.qrCodeData = null;
        this.emit('disconnected', reason);
      });

      this.client.on('message', async (msg) => {
        // Skip our own outgoing messages (echoes) and non-chat events
        if (msg.fromMe) return;
        if (msg.type !== 'chat' && msg.type !== 'image' && msg.type !== 'video' &&
            msg.type !== 'audio' && msg.type !== 'document' && msg.type !== 'sticker') {
          return; // Skip notifications, receipts, e2e_notification, etc.
        }

        let contactName = null;
        let contactNumber = null;
        try {
          const contact = await msg.getContact();
          contactName = contact.pushname || contact.name || contact.shortName || null;
          // Extract real phone number (works even for @lid contacts)
          contactNumber = contact.number || contact.id?.user || null;
        } catch {}
        this.emit('message', {
          from: msg.from,
          body: msg.body,
          timestamp: msg.timestamp,
          type: msg.type,
          contactName,
          contactNumber,
        });
      });

      // Fire-and-forget: don't block the HTTP response waiting for QR/auth
      this.client.initialize().catch(async (err) => {
        this.isInitializing = false;
        this.lastError = err.message;
        console.error('[WhatsApp] Initialize error:', err.message);
        // Clean up failed client so retry is possible
        try { await this.client.destroy(); } catch {}
        this.client = null;
        this.emit('error', err);
      });

      return { status: 'initializing' };
    } catch (err) {
      this.isInitializing = false;
      this.lastError = err.message;
      console.error('[WhatsApp] Connect error:', err.message);
      return { status: 'error', error: err.message };
    }
  }

  /**
   * Send a message to a phone number or WhatsApp chat ID
   * If chatIdOrPhone contains '@', it's used as-is (e.g. 12345@lid)
   * Otherwise digits are extracted and @c.us is appended
   */
  async sendMessage(chatIdOrPhone, message) {
    if (!this.isConnected || !this.client) {
      throw new Error('WhatsApp not connected. Please scan QR code first.');
    }

    const chatId = chatIdOrPhone.includes('@')
      ? chatIdOrPhone
      : chatIdOrPhone.replace(/[^0-9]/g, '') + '@c.us';
    const result = await this.client.sendMessage(chatId, message);

    return {
      status: 'sent',
      messageId: result.id?.id || `wa-${Date.now()}`,
      to: chatIdOrPhone,
      timestamp: Date.now(),
    };
  }

  /**
   * Disconnect WhatsApp session
   */
  async disconnect() {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (err) {
        console.error('[WhatsApp] Destroy error:', err.message);
      }
    }
    this.isConnected = false;
    this.isInitializing = false;
    this.sessionInfo = null;
    this.qrCodeData = null;
    this.client = null;
  }

  /**
   * Get current QR code as base64 data URL
   */
  getQR() {
    return this.qrCodeData;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      initializing: this.isInitializing,
      phone: this.sessionInfo?.phone || null,
      name: this.sessionInfo?.name || null,
      hasQR: !!this.qrCodeData,
      error: this.lastError,
    };
  }
}

export default WhatsAppClient;
