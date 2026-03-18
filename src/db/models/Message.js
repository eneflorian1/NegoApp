/**
 * Message Repository — MongoDB-backed with in-memory cache, per-user isolation
 */
import mongoose from 'mongoose';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', '..', 'data');
const MESSAGES_FILE = join(DATA_DIR, 'messages.json');

// ─── Mongoose Schema ────────────────────────────────────────────────────────
const messageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, index: true },
  leadId: { type: String, index: true },
  sender: String,
  text: String,
  timestamp: String,
  channel: { type: String, index: true },
  from: String,
  to: String,
  subject: String,
  emailMessageId: String,
}, { strict: false, timestamps: false });

messageSchema.index({ leadId: 1, timestamp: -1 });

const MessageModel = mongoose.model('Message', messageSchema);

// ─── In-memory cache ────────────────────────────────────────────────────────
let messages = [];

const MessageRepo = {
  async init() {
    try {
      const docs = await MessageModel.find({}).lean();
      if (docs.length > 0) {
        messages = docs.map(d => { const { _id, __v, ...rest } = d; return rest; });
      } else if (existsSync(MESSAGES_FILE)) {
        try {
          const fileData = JSON.parse(readFileSync(MESSAGES_FILE, 'utf-8'));
          if (Array.isArray(fileData) && fileData.length > 0) {
            messages = fileData;
            console.log(`[MessageRepo] Seeding ${messages.length} messages from messages.json`);
            const batchSize = 500;
            for (let i = 0; i < messages.length; i += batchSize) {
              const batch = messages.slice(i, i + batchSize);
              await MessageModel.insertMany(batch, { ordered: false }).catch(() => {});
            }
          }
        } catch { messages = []; }
      }
    } catch (err) {
      console.error('[MessageRepo] init failed:', err.message);
      if (existsSync(MESSAGES_FILE)) {
        try { messages = JSON.parse(readFileSync(MESSAGES_FILE, 'utf-8')); } catch { messages = []; }
      }
    }
    return messages;
  },

  save() {
    const ops = messages.map(m => ({
      updateOne: {
        filter: { id: m.id },
        update: { $set: m },
        upsert: true,
      }
    }));
    if (ops.length === 0) return;
    MessageModel.bulkWrite(ops).catch(err => console.error('[MessageRepo] save failed:', err.message));
  },

  getAll(userId) {
    if (!userId) return messages;
    return messages.filter(m => m.userId === userId);
  },

  getByLeadId(leadId) { return messages.filter(m => m.leadId === leadId); },

  getByChannel(channel) { return messages.filter(m => m.channel === channel); },

  create(data) {
    const message = {
      id: `${data.channel || 'msg'}-${data.sender === 'me' ? 'out' : 'in'}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...data,
    };
    messages.push(message);
    MessageModel.create(message).catch(err => console.error('[MessageRepo] create failed:', err.message));
    return message;
  },

  push(message) { messages.push(message); },

  deleteByLeadId(leadId) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].leadId === leadId) messages.splice(i, 1);
    }
    MessageModel.deleteMany({ leadId }).catch(err => console.error('[MessageRepo] deleteByLeadId failed:', err.message));
  },

  get count() { return messages.length; },

  async getRecentByLeadId(leadId, limit = 20) {
    try {
      const docs = await MessageModel.find({ leadId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
      return docs.reverse().map(d => { const { _id, __v, ...rest } = d; return rest; });
    } catch {
      return this.getByLeadId(leadId).slice(-limit);
    }
  },
};

export default MessageRepo;
