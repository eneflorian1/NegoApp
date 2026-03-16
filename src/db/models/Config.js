/**
 * Config Repository — JSON-based config persistence
 * Ready to swap to MongoDB/Mongoose later.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', '..', 'data');
const CONFIG_FILE = join(DATA_DIR, 'config.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const ConfigRepo = {
  load() {
    if (!existsSync(CONFIG_FILE)) return {};
    try {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    } catch { return {}; }
  },

  save(cfg) {
    writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  },

  get(key) {
    const cfg = this.load();
    return cfg[key];
  },

  set(key, value) {
    const cfg = this.load();
    cfg[key] = value;
    this.save(cfg);
  },
};

export default ConfigRepo;
