/**
 * Config Repository — MongoDB-backed, per-user
 * Each user has their own config document keyed by userId.
 */
import mongoose from 'mongoose';

const configSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

const ConfigModel = mongoose.model('Config', configSchema);

// ─── In-memory cache per user ────────────────────────────────────────────────
const caches = new Map(); // Map<userId, configObject>

const DEFAULT_CONFIG = {
  geminiApiKey: '',
  agentMailApiKey: '',
  whatsappConnected: false,
  autoPilotEnabled: false,
  requestLocationConfirmation: true,
  meetingAddress: '',
  autosendAddress: false,
  defaultPersonality: 'diplomat',
  whatsappSystemPrompt: "Ești o persoană reală care vorbește pe WhatsApp cu o cunoștință.\n\nREGULI:\n- Răspunde cât mai natural, scurt și la obiect\n- Folosește un ton relaxat, prietenos\n- Nu menționa sub nicio formă că ești o inteligență artificială\n- Răspunde în limba în care ești abordat\n- Negociază prețuri cu diplomație și răbdare",
  emailSystemPrompt: "Ești un agent AI expert în negociere și cumpărare de produse/servicii.\n\nOBIECTIVE:\n- Negociază prețuri mai mici cu diplomație\n- Fii politicos dar ferm în negociere\n- Propune contra-oferte rezonabile (10-25% reducere)\n- Răspunde în limba în care ești abordat\n- Menține un ton profesional dar prietenos",
  whatsappScenario: 'universal',
  emailScenario: 'universal',
  customScenarios: [],
  yoloDefaults: {
    autoNegThreshold: 10,
    modaExcludedBrands: 'Zara, H&M',
    electroniceMinWarrantyMonths: 12,
  },
};

const ConfigRepo = {
  /**
   * Called once at startup — loads all existing user configs into cache.
   */
  async init() {
    try {
      const docs = await ConfigModel.find({ userId: { $ne: undefined } }).lean();
      for (const doc of docs) {
        if (doc.userId) caches.set(doc.userId, doc.data || {});
      }
      console.log(`[ConfigRepo] Loaded ${caches.size} user configs`);
    } catch (err) {
      console.error('[ConfigRepo] init failed:', err.message);
    }
    return caches;
  },

  /**
   * Ensure a user's config exists (called on login/register).
   */
  async initUser(userId) {
    if (caches.has(userId)) return caches.get(userId);
    try {
      let doc = await ConfigModel.findOne({ userId });
      if (!doc) {
        doc = await ConfigModel.create({ userId, data: { ...DEFAULT_CONFIG } });
        console.log(`[ConfigRepo] Created default config for user ${userId}`);
      }
      caches.set(userId, doc.data || { ...DEFAULT_CONFIG });
    } catch (err) {
      console.error(`[ConfigRepo] initUser failed for ${userId}:`, err.message);
      caches.set(userId, { ...DEFAULT_CONFIG });
    }
    return caches.get(userId);
  },

  /** Sync read from cache */
  load(userId) {
    return { ...(caches.get(userId) || DEFAULT_CONFIG) };
  },

  /** Write full config for a user */
  save(userId, cfg) {
    caches.set(userId, { ...cfg });
    ConfigModel.updateOne(
      { userId },
      { $set: { data: cfg } },
      { upsert: true }
    ).catch(err => console.error('[ConfigRepo] save failed:', err.message));
  },

  get(userId, key) {
    return (caches.get(userId) || {})[key];
  },

  set(userId, key, value) {
    const cfg = { ...(caches.get(userId) || DEFAULT_CONFIG) };
    cfg[key] = value;
    caches.set(userId, cfg);
    this.save(userId, cfg);
  },
};

export default ConfigRepo;
