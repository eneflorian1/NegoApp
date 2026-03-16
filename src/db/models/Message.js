/**
 * Message Repository — JSON-based message persistence
 * Wraps an in-memory array backed by data/messages.json.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', '..', 'data');
const MESSAGES_FILE = join(DATA_DIR, 'messages.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

/** Internal array */
let messages = [];

const MessageRepo = {
  /** Load messages from disk. Call once at startup. */
  init() {
    if (!existsSync(MESSAGES_FILE)) { messages = []; return messages; }
    try {
      messages = JSON.parse(readFileSync(MESSAGES_FILE, 'utf-8'));
    } catch { messages = []; }
    return messages;
  },

  /** Persist to disk */
  save() {
    writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
  },

  /** Get all messages */
  getAll() {
    return messages;
  },

  /** Filter messages by leadId */
  getByLeadId(leadId) {
    return messages.filter(m => m.leadId === leadId);
  },

  /** Filter by channel */
  getByChannel(channel) {
    return messages.filter(m => m.channel === channel);
  },

  /** Create and push a new message */
  create(data) {
    const message = {
      id: `${data.channel || 'msg'}-${data.sender === 'me' ? 'out' : 'in'}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...data,
    };
    messages.push(message);
    this.save();
    return message;
  },

  /** Push without saving (for batch operations) */
  push(message) {
    messages.push(message);
  },

  /** Delete all messages for a leadId */
  deleteByLeadId(leadId) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].leadId === leadId) {
        messages.splice(i, 1);
      }
    }
    this.save();
  },

  /** Number of messages */
  get count() {
    return messages.length;
  },
};

export default MessageRepo;
