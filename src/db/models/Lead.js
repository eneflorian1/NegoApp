/**
 * Lead Repository — MongoDB-backed with in-memory cache, per-user isolation
 */
import mongoose from 'mongoose';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', '..', 'data');
const LEADS_FILE = join(DATA_DIR, 'leads.json');

// ─── Mongoose Schema ────────────────────────────────────────────────────────
const leadSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, index: true },
  url: String,
  title: String,
  initialPrice: String,
  price: String,
  sellerName: String,
  phoneNumber: String,
  whatsappId: String,
  isSaved: Boolean,
  status: { type: String, index: true },
  platform: String,
  isBotActive: Boolean,
  channel: String,
  lastMessage: String,
  lastContacted: String,
  finalPrice: String,
  createdAt: String,
}, { strict: false, timestamps: false });

const LeadModel = mongoose.model('Lead', leadSchema);

// ─── In-memory cache ────────────────────────────────────────────────────────
let leads = [];

function persistAll() {
  const ops = leads.map(l => ({
    updateOne: {
      filter: { id: l.id },
      update: { $set: l },
      upsert: true,
    }
  }));
  if (ops.length === 0) return;
  LeadModel.bulkWrite(ops).catch(err => console.error('[LeadRepo] persistAll failed:', err.message));
}

const LeadRepo = {
  async init() {
    try {
      const docs = await LeadModel.find({}).lean();
      if (docs.length > 0) {
        leads = docs.map(d => { const { _id, __v, ...rest } = d; return rest; });
      } else if (existsSync(LEADS_FILE)) {
        try {
          const fileData = JSON.parse(readFileSync(LEADS_FILE, 'utf-8'));
          if (Array.isArray(fileData) && fileData.length > 0) {
            leads = fileData;
            console.log(`[LeadRepo] Seeding ${leads.length} leads from leads.json`);
            await LeadModel.insertMany(leads, { ordered: false }).catch(() => {});
          }
        } catch { leads = []; }
      }
    } catch (err) {
      console.error('[LeadRepo] init failed:', err.message);
      if (existsSync(LEADS_FILE)) {
        try { leads = JSON.parse(readFileSync(LEADS_FILE, 'utf-8')); } catch { leads = []; }
      }
    }
    return leads;
  },

  save() { persistAll(); },

  /** Get all leads for a user */
  getAll(userId) {
    if (!userId) return leads;
    return leads.filter(l => l.userId === userId);
  },

  findById(id) { return leads.find(l => l.id === id); },

  find(predicate) { return leads.find(predicate); },

  findIndex(id) { return leads.findIndex(l => l.id === id); },

  create(data) {
    const lead = {
      id: `lead-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
      ...data,
    };
    leads.push(lead);
    LeadModel.create(lead).catch(err => console.error('[LeadRepo] create failed:', err.message));
    return lead;
  },

  update(id, data) {
    const idx = leads.findIndex(l => l.id === id);
    if (idx === -1) return null;
    leads[idx] = { ...leads[idx], ...data };
    LeadModel.updateOne({ id }, { $set: leads[idx] }, { upsert: true })
      .catch(err => console.error('[LeadRepo] update failed:', err.message));
    return leads[idx];
  },

  delete(id) {
    const idx = leads.findIndex(l => l.id === id);
    if (idx === -1) return false;
    leads.splice(idx, 1);
    LeadModel.deleteOne({ id }).catch(err => console.error('[LeadRepo] delete failed:', err.message));
    return true;
  },

  push(lead) { leads.push(lead); },

  get count() { return leads.length; },
};

export default LeadRepo;
