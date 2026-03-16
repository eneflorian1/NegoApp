/**
 * Lead Repository — JSON-based lead persistence
 * Wraps an in-memory array backed by data/leads.json.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', '..', 'data');
const LEADS_FILE = join(DATA_DIR, 'leads.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

/** Internal array — single source of truth */
let leads = [];

const LeadRepo = {
  /** Load leads from disk into memory. Call once at startup. */
  init() {
    if (!existsSync(LEADS_FILE)) { leads = []; return leads; }
    try {
      leads = JSON.parse(readFileSync(LEADS_FILE, 'utf-8'));
    } catch { leads = []; }
    return leads;
  },

  /** Persist current state to disk */
  save() {
    writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
  },

  /** Get all leads (returns live array reference) */
  getAll() {
    return leads;
  },

  /** Find lead by id */
  findById(id) {
    return leads.find(l => l.id === id);
  },

  /** Find lead by predicate */
  find(predicate) {
    return leads.find(predicate);
  },

  /** Find lead index by id */
  findIndex(id) {
    return leads.findIndex(l => l.id === id);
  },

  /** Create a new lead, push to array and save */
  create(data) {
    const lead = {
      id: `lead-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
      ...data,
    };
    leads.push(lead);
    this.save();
    return lead;
  },

  /** Update a lead by id (partial update, merge fields) */
  update(id, data) {
    const idx = leads.findIndex(l => l.id === id);
    if (idx === -1) return null;
    leads[idx] = { ...leads[idx], ...data };
    this.save();
    return leads[idx];
  },

  /** Delete a lead by id */
  delete(id) {
    const idx = leads.findIndex(l => l.id === id);
    if (idx === -1) return false;
    leads.splice(idx, 1);
    this.save();
    return true;
  },

  /** Push to array without saving (for batch operations) */
  push(lead) {
    leads.push(lead);
  },

  /** Number of leads */
  get count() {
    return leads.length;
  },
};

export default LeadRepo;
