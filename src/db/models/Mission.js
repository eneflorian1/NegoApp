/**
 * Mission Repository — MongoDB-backed with in-memory cache, per-user isolation
 */
import mongoose from 'mongoose';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', '..', 'data');
const MISSIONS_FILE = join(DATA_DIR, 'missions.json');

// ─── Mongoose Schema ────────────────────────────────────────────────────────
const missionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, index: true },
  mode: String,
  platform: String,
  url: String,
  query: String,
  useProxy: Boolean,
  status: { type: String, index: true },
  domain: String,
  strategy: String,
  results: [mongoose.Schema.Types.Mixed],
  leadsFound: { type: Number, default: 0 },
  leadsContacted: { type: Number, default: 0 },
  progress: { type: Number, default: 0 },
  summary: mongoose.Schema.Types.Mixed,
  createdAt: String,
  updatedAt: String,
}, { strict: false, timestamps: false });

const MissionModel = mongoose.model('Mission', missionSchema);

// ─── In-memory cache (Map) ──────────────────────────────────────────────────
let missions = new Map();

const MissionRepo = {
  async init() {
    try {
      const docs = await MissionModel.find({}).lean();
      if (docs.length > 0) {
        missions = new Map(docs.map(d => {
          const { _id, __v, ...rest } = d;
          return [rest.id, rest];
        }));
      } else if (existsSync(MISSIONS_FILE)) {
        try {
          const fileData = JSON.parse(readFileSync(MISSIONS_FILE, 'utf-8'));
          if (Array.isArray(fileData) && fileData.length > 0) {
            missions = new Map(fileData.map(m => [m.id, m]));
            console.log(`[MissionRepo] Seeding ${missions.size} missions from missions.json`);
            await MissionModel.insertMany(fileData, { ordered: false }).catch(() => {});
          }
        } catch { missions = new Map(); }
      }
    } catch (err) {
      console.error('[MissionRepo] init failed:', err.message);
      if (existsSync(MISSIONS_FILE)) {
        try {
          const data = JSON.parse(readFileSync(MISSIONS_FILE, 'utf-8'));
          missions = new Map(data.map(m => [m.id, m]));
        } catch { missions = new Map(); }
      }
    }

    // ── Reset orphaned "running" missions after a server restart ──────────
    // The orchestrator runs in-memory; after a restart it has no knowledge of
    // previously running missions. Mark them as "interrupted" so the UI does
    // not display a ghost "searching" state while nothing is actually running.
    const ACTIVE_STATUSES = ['running', 'scraping', 'revealing', 'discovering', 'initializing'];
    const orphaned = Array.from(missions.values()).filter(m => ACTIVE_STATUSES.includes(m.status));
    if (orphaned.length > 0) {
      const now = new Date().toISOString();
      for (const m of orphaned) {
        m.status = 'interrupted';
        m.updatedAt = now;
      }
      // Persist the reset to DB in one bulk operation
      const ops = orphaned.map(m => ({
        updateOne: {
          filter: { id: m.id },
          update: { $set: { status: 'interrupted', updatedAt: m.updatedAt } },
        },
      }));
      MissionModel.bulkWrite(ops).catch(err =>
        console.error('[MissionRepo] Failed to reset orphaned missions:', err.message)
      );
      console.log(`[MissionRepo] Reset ${orphaned.length} orphaned mission(s) to "interrupted" (server restarted)`);
    }

    return missions;
  },

  save() {
    const ops = Array.from(missions.values()).map(m => ({
      updateOne: {
        filter: { id: m.id },
        update: { $set: m },
        upsert: true,
      }
    }));
    if (ops.length === 0) return;
    MissionModel.bulkWrite(ops).catch(err => console.error('[MissionRepo] save failed:', err.message));
  },

  /** Get all missions for a user */
  getAll(userId) {
    const all = Array.from(missions.values())
      .sort((a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0));
    if (!userId) return all;
    return all.filter(m => m.userId === userId);
  },

  getMap() { return missions; },

  get(id) { return missions.get(id); },

  set(id, mission) {
    missions.set(id, mission);
    MissionModel.updateOne({ id }, { $set: mission }, { upsert: true })
      .catch(err => console.error('[MissionRepo] set failed:', err.message));
  },

  delete(id) {
    const deleted = missions.delete(id);
    if (deleted) {
      MissionModel.deleteOne({ id }).catch(err => console.error('[MissionRepo] delete failed:', err.message));
    }
    return deleted;
  },

  create(data) {
    const id = `mission-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const mission = {
      id,
      results: [],
      leadsFound: 0,
      leadsContacted: 0,
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    missions.set(id, mission);
    MissionModel.create(mission).catch(err => console.error('[MissionRepo] create failed:', err.message));
    return mission;
  },

  get size() { return missions.size; },
};

export default MissionRepo;
