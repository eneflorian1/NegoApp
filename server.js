/**
 * API Server v3 — Express backend for NegoApp
 * 
 * Thin entry point: initializes core services, wires up routes & channel handlers.
 * All business logic lives in src/ modules.
 */
import express from 'express';
import cors from 'cors';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// ─── Core services ──────────────────────────────────────────────────────────
import ProxyManager from './src/scraper/proxy-manager.js';
import DomainStrategy from './src/scraper/domain-strategy.js';
import CategoryScraper from './src/scraper/category-scraper.js';
import SiteIntelligence from './src/scraper/site-intelligence.js';
import GeminiClient from './src/core/gemini-client.js';
import AgentOrchestrator from './src/core/agent-orchestrator.js';

// ─── Channels ───────────────────────────────────────────────────────────────
import WhatsAppClient from './src/channels/whatsapp-client.js';
import MailClient from './src/channels/mail-client.js';
import { setupWhatsAppHandler } from './src/channels/whatsapp-handler.js';
import { setupEmailHandler } from './src/channels/email-handler.js';

// ─── DB Repositories ────────────────────────────────────────────────────────
import ConfigRepo from './src/db/models/Config.js';
import LeadRepo from './src/db/models/Lead.js';
import MessageRepo from './src/db/models/Message.js';
import MissionRepo from './src/db/models/Mission.js';

// ─── Utils ──────────────────────────────────────────────────────────────────
import { sanitizeLeadPrices } from './src/utils/price.js';

// ─── Routes ─────────────────────────────────────────────────────────────────
import createRevealRoutes from './src/routes/reveal.routes.js';
import createMissionRoutes from './src/routes/mission.routes.js';
import createBatchRoutes from './src/routes/batch.routes.js';
import createChatRoutes from './src/routes/chat.routes.js';
import createLeadsRoutes from './src/routes/leads.routes.js';
import createMessagesRoutes from './src/routes/messages.routes.js';
import createConfigRoutes from './src/routes/config.routes.js';

// ═════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═════════════════════════════════════════════════════════════════════════════

const __dirname = dirname(fileURLToPath(import.meta.url));

// Core service instances
const VPS_HOST = '206.189.10.234';
const proxyManager = ProxyManager.fromVPS(VPS_HOST, 10001, 16);
const domainStrategy = new DomainStrategy();
const gemini = new GeminiClient();
gemini.setConfigKeyProvider(() => {
  const cfg = ConfigRepo.load();
  return cfg.geminiApiKey || null;
});

const siteIntelligence = new SiteIntelligence({ geminiClient: gemini, domainStrategy, proxyManager });
const categoryScraper = new CategoryScraper({ domainStrategy, siteIntelligence, proxyManager });
const orchestrator = new AgentOrchestrator({ proxyManager, geminiClient: gemini });

// Channel instances
const whatsapp = new WhatsAppClient();
const agentmail = new MailClient();

// Wire channel event handlers
setupWhatsAppHandler(whatsapp, gemini);
setupEmailHandler(agentmail, gemini);

// Initialize data from disk
const leads = LeadRepo.init();
const messages = MessageRepo.init();
const missions = MissionRepo.init();
const savedConfig = ConfigRepo.load();

// Sanitize corrupt prices
let leadsFixed = 0;
for (const lead of leads) { leadsFixed += sanitizeLeadPrices(lead); }
if (leadsFixed > 0) { LeadRepo.save(); console.log(`[Server] Fixed ${leadsFixed} corrupt price fields in leads`); }

console.log(`[Server] Loaded ${MissionRepo.size} missions from disk`);
console.log(`[Server] Loaded ${MessageRepo.count} messages from disk`);
console.log(`[Server] Loaded ${LeadRepo.count} leads from disk`);
console.log(`[Server] Config loaded: ${Object.keys(savedConfig).length} keys`);

// Auto-connect channels
(async () => {
  try {
    const authDir = join(__dirname, 'data', '.wwebjs_auth');
    if (existsSync(authDir)) {
      console.log('[Server] Found WhatsApp session, auto-connecting...');
      await whatsapp.connect();
      await new Promise(resolve => setTimeout(resolve, 15000));
      if (!whatsapp.isConnected && !whatsapp.isInitializing) {
        console.log('[Server] WhatsApp auto-connect failed, will require manual reconnect');
      }
    }
  } catch (err) { console.log('[Server] WhatsApp auto-connect skipped:', err.message); }

  try {
    const cfg = ConfigRepo.load();
    if (cfg.agentMailApiKey && cfg.agentMailApiKey.length > 5) {
      console.log('[Server] AgentMail API key found, connecting...');
      await agentmail.connect(cfg.agentMailApiKey);
    }
  } catch (err) { console.log('[Server] AgentMail auto-connect skipped:', err.message); }
})();

// ═════════════════════════════════════════════════════════════════════════════
// EXPRESS APP
// ═════════════════════════════════════════════════════════════════════════════

const app = express();
app.use(cors());
app.use(express.json());

// Create and mount routes
const deps = { proxyManager, domainStrategy, gemini, orchestrator, siteIntelligence, categoryScraper, whatsapp, agentmail };
const revealRouter = createRevealRoutes(deps);
const batchRouter = createBatchRoutes(deps);

app.use('/api', revealRouter);
app.use('/api', createMissionRoutes(deps));
app.use('/api', batchRouter);
app.use('/api', createChatRoutes(deps));
app.use('/api', createLeadsRoutes(deps));
app.use('/api', createMessagesRoutes(deps));
app.use('/api', createConfigRoutes({ ...deps, revealRouter, batchRouter }));

// ─── Serve frontend (production) ────────────────────────────────────────────
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*splat}', (req, res) => { res.sendFile(join(distPath, 'index.html')); });
  console.log(`[Server] Serving frontend from ${distPath}`);
}

// ─── Global error handler ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[Server] Error on ${req.method} ${req.path}:`, err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ═════════════════════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  const strategies = domainStrategy.listAll();
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  NegoApp API Server v3 — port ${PORT}            ║`);
  console.log(`║  ${proxyManager.totalCount} IPv6 proxies loaded                   ║`);
  console.log(`║  ${strategies.length} domain strategies cached              ║`);
  console.log(`║  Gemini: ${gemini.isAvailable ? 'ACTIVE ✓' : 'DISABLED ✗'}                         ║`);
  console.log(`║  WhatsApp: ${whatsapp.isConnected ? 'CONNECTED ✓' : 'DISCONNECTED ✗'}                    ║`);
  console.log(`║                                              ║`);
  console.log(`║  Services: /api/services/status               ║`);
  console.log(`║  WhatsApp: /api/whatsapp/connect|qr|disconnect║`);
  console.log(`║  Config:   /api/config (GET|POST)             ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
});
