/**
 * Mission Repository — JSON-based mission persistence
 * Wraps an in-memory Map backed by data/missions.json.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', '..', 'data');
const MISSIONS_FILE = join(DATA_DIR, 'missions.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

/** Internal Map */
let missions = new Map();

const MissionRepo = {
  /** Load missions from disk. Call once at startup. */
  init() {
    if (!existsSync(MISSIONS_FILE)) { missions = new Map(); return missions; }
    try {
      const data = JSON.parse(readFileSync(MISSIONS_FILE, 'utf-8'));
      missions = new Map(data.map(m => [m.id, m]));
    } catch { missions = new Map(); }
    return missions;
  },

  /** Persist to disk */
  save() {
    const data = Array.from(missions.values());
    writeFileSync(MISSIONS_FILE, JSON.stringify(data, null, 2));
  },

  /** Get all missions as array (sorted newest first) */
  getAll() {
    return Array.from(missions.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /** Get raw Map reference */
  getMap() {
    return missions;
  },

  /** Get mission by id */
  get(id) {
    return missions.get(id);
  },

  /** Set / upsert a mission */
  set(id, mission) {
    missions.set(id, mission);
    this.save();
  },

  /** Delete a mission by id */
  delete(id) {
    const deleted = missions.delete(id);
    if (deleted) this.save();
    return deleted;
  },

  /** Create a new mission with generated id */
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
    this.save();
    return mission;
  },

  /** Number of missions */
  get size() {
    return missions.size;
  },
};

export default MissionRepo;
