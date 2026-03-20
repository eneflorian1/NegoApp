/**
 * API Server v4 — Multi-user architecture
 */
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// ─── Database ───────────────────────────────────────────────────────────────
import { connectDB } from './src/db/mongo.js';

// ─── Core services ──────────────────────────────────────────────────────────
import ProxyManager from './src/scraper/proxy-manager.js';
import DomainStrategy from './src/scraper/domain-strategy.js';
import CategoryScraper from './src/scraper/category-scraper.js';
import SiteIntelligence from './src/scraper/site-intelligence.js';
import GeminiClient from './src/core/gemini-client.js';
import AgentOrchestrator from './src/core/agent-orchestrator.js';
import WhatsAppManager from './src/core/whatsapp-manager.js';

// ─── Channels ───────────────────────────────────────────────────────────────
import MailClient from './src/channels/mail-client.js';
import { setupEmailHandler } from './src/channels/email-handler.js';

// ─── DB Repositories ────────────────────────────────────────────────────────
import ConfigRepo from './src/db/models/Config.js';
import LeadRepo from './src/db/models/Lead.js';
import MessageRepo from './src/db/models/Message.js';
import MissionRepo from './src/db/models/Mission.js';
import UserModel from './src/db/models/User.js';

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
import createAuthRoutes from './src/routes/auth.routes.js';
import createSessionRoutes from './src/routes/session.routes.js';

// ═════════════════════════════════════════════════════════════════════════════
const __dirname = dirname(fileURLToPath(import.meta.url));

// Core service instances
const VPS_HOST = '206.189.10.234';
const proxyManager = ProxyManager.fromVPS(VPS_HOST, 10001, 16);
const domainStrategy = new DomainStrategy();
const gemini = new GeminiClient();

const siteIntelligence = new SiteIntelligence({ geminiClient: gemini, domainStrategy, proxyManager });
const categoryScraper = new CategoryScraper({ domainStrategy, siteIntelligence, proxyManager });
const orchestrator = new AgentOrchestrator({ proxyManager, geminiClient: gemini });

// Per-user WhatsApp manager
const whatsappManager = new WhatsAppManager(gemini);

// Shared AgentMail instance
const agentmail = new MailClient();
setupEmailHandler(agentmail, gemini);

// ═════════════════════════════════════════════════════════════════════════════
// ASYNC BOOT
// ═════════════════════════════════════════════════════════════════════════════

(async () => {
  await connectDB();

  const [leads] = await Promise.all([
    LeadRepo.init(),
    MessageRepo.init(),
    MissionRepo.init(),
    ConfigRepo.init(),
  ]);

  let leadsFixed = 0;
  for (const lead of leads) { leadsFixed += sanitizeLeadPrices(lead); }
  if (leadsFixed > 0) { LeadRepo.save(); console.log(`[Server] Fixed ${leadsFixed} corrupt price fields`); }

  console.log(`[Server] Loaded ${MissionRepo.size} missions, ${MessageRepo.count} messages, ${LeadRepo.count} leads`);

  // Auto-connect WhatsApp for all existing users
  (async () => {
    try {
      const users = await UserModel.find({}).lean();
      const userIds = users.map(u => u._id.toString());
      if (userIds.length > 0) {
        await whatsappManager.autoConnectAll(userIds);
      }
    } catch (err) {
      console.log('[Server] WhatsApp auto-connect skipped:', err.message);
    }

    // Auto-connect AgentMail using first user's key found
    try {
      const users = await UserModel.find({}).lean();
      for (const user of users) {
        const cfg = ConfigRepo.load(user._id.toString());
        if (cfg.agentMailApiKey && cfg.agentMailApiKey.length > 5) {
          await agentmail.connect(cfg.agentMailApiKey);
          break;
        }
      }
    } catch (err) {
      console.log('[Server] AgentMail auto-connect skipped:', err.message);
    }
  })();

  // ═════════════════════════════════════════════════════════════════════════════
  const app = express();
  app.use(cors({ credentials: true, origin: true }));
  app.use(cookieParser());
  app.use(express.json());

  // Public auth routes
  app.use('/api', createAuthRoutes());

  // Protected routes — whatsapp is the per-user manager
  const deps = {
    proxyManager, domainStrategy, gemini, orchestrator,
    siteIntelligence, categoryScraper,
    whatsapp: whatsappManager,
    agentmail,
  };
  const revealRouter = createRevealRoutes(deps);
  const batchRouter = createBatchRoutes(deps);

  app.use('/api', revealRouter);
  app.use('/api', createMissionRoutes(deps));
  app.use('/api', batchRouter);
  app.use('/api', createChatRoutes(deps));
  app.use('/api', createLeadsRoutes(deps));
  app.use('/api', createMessagesRoutes(deps));
  app.use('/api', createConfigRoutes({ ...deps, revealRouter, batchRouter }));
  app.use('/api', createSessionRoutes());

  // Serve frontend
  const distPath = join(__dirname, 'dist');
  if (existsSync(distPath)) {
    app.use(express.static(distPath, { etag: false, lastModified: false, setHeaders: (res) => { res.set('Cache-Control', 'no-store'); } }));
    app.get('/{*splat}', (req, res) => { res.sendFile(join(distPath, 'index.html')); });
    console.log(`[Server] Serving frontend from ${distPath}`);
  }

  app.use((err, req, res, next) => {
    console.error(`[Server] Error on ${req.method} ${req.path}:`, err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    const strategies = domainStrategy.listAll();
    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║  NegoApp API Server v4 — port ${PORT}            ║`);
    console.log(`║  Multi-user architecture ✓                   ║`);
    console.log(`║  ${proxyManager.totalCount} IPv6 proxies loaded                   ║`);
    console.log(`║  ${strategies.length} domain strategies cached              ║`);
    console.log(`║  MongoDB: CONNECTED ✓                        ║`);
    console.log(`║                                              ║`);
    console.log(`║  Auth: POST /api/auth/register|login         ║`);
    console.log(`╚══════════════════════════════════════════════╝\n`);
  });
})();
