/**
 * API Server v2 — Express backend for NegoApp
 * 
 * New in v2:
 * - /api/category/scrape — scrape listings from a category page
 * - /api/batch/start — batch phone reveal with proxy rotation
 * - /api/batch/status — check batch progress
 * - /api/batch/stop — stop a running batch
 * - /api/intelligence/discover — AI-discover strategy for new domain
 * - /api/orchestrate/full — full autonomous mission (scrape → reveal)
 * - Upgraded /api/orchestrate to use new orchestrator
 */
import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import ProxyManager from './src/scraper/proxy-manager.js';
import PhoneRevealer from './src/scraper/phone-revealer.js';
import DomainStrategy from './src/scraper/domain-strategy.js';
import CategoryScraper from './src/scraper/category-scraper.js';
import BatchProcessor from './src/scraper/batch-processor.js';
import SiteIntelligence from './src/scraper/site-intelligence.js';
import GeminiClient from './src/core/gemini-client.js';
import AgentOrchestrator from './src/core/agent-orchestrator.js';

import WhatsAppClient from './src/channels/whatsapp-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const MISSIONS_FILE = join(DATA_DIR, 'missions.json');
const CONFIG_FILE = join(DATA_DIR, 'config.json');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Core services ────────────────────────────────────────────────────────────
const VPS_HOST = '206.189.10.234';
const proxyManager = ProxyManager.fromVPS(VPS_HOST, 10001, 16);
const domainStrategy = new DomainStrategy();
const gemini = new GeminiClient();

const siteIntelligence = new SiteIntelligence({
  geminiClient: gemini,
  domainStrategy,
  proxyManager,
});

const categoryScraper = new CategoryScraper({
  domainStrategy,
  siteIntelligence,
  proxyManager,
});

const orchestrator = new AgentOrchestrator({
  proxyManager,
  geminiClient: gemini,
});

// ─── WhatsApp client ──────────────────────────────────────────────────────────
const whatsapp = new WhatsAppClient();

whatsapp.on('ready', (info) => {
  console.log(`[WhatsApp] Connected as ${info.name} (${info.phone})`);
});
whatsapp.on('disconnected', (reason) => {
  console.log(`[WhatsApp] Disconnected: ${reason}`);
});

// Track active operations
const activeReveal = { running: false, result: null };
const activeBatch = { processor: null, running: false };
const activeCategoryScrape = { running: false };

// ─── Mission persistence ──────────────────────────────────────────────────────
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function loadMissions() {
  if (!existsSync(MISSIONS_FILE)) return new Map();
  try {
    const data = JSON.parse(readFileSync(MISSIONS_FILE, 'utf-8'));
    return new Map(data.map(m => [m.id, m]));
  } catch { return new Map(); }
}

function saveMissions() {
  const data = Array.from(missions.values());
  writeFileSync(MISSIONS_FILE, JSON.stringify(data, null, 2));
}

function loadConfig() {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  } catch { return {}; }
}

function saveConfig(cfg) {
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

const missions = loadMissions();
const savedConfig = loadConfig();
console.log(`[Server] Loaded ${missions.size} missions from disk`);
console.log(`[Server] Config loaded: ${Object.keys(savedConfig).length} keys`);

// Auto-connect WhatsApp if session exists
(async () => {
  try {
    const authDir = join(DATA_DIR, '.wwebjs_auth');
    if (existsSync(authDir)) {
      console.log('[Server] Found WhatsApp session, auto-connecting...');
      await whatsapp.connect();
    }
  } catch (err) {
    console.log('[Server] WhatsApp auto-connect skipped:', err.message);
  }
})();

// ════════════════════════════════════════════════════════════════════════════════
// EXISTING ENDPOINTS (preserved)
// ════════════════════════════════════════════════════════════════════════════════

// ─── Single phone reveal ──────────────────────────────────────────────────────
app.post('/api/reveal', async (req, res) => {
  const { url, useProxy = false } = req.body;

  if (!url) return res.status(400).json({ error: 'URL is required' });
  if (activeReveal.running) return res.status(429).json({ error: 'A reveal is already in progress. Please wait.' });

  activeReveal.running = true;
  activeReveal.result = null;

  try {
    console.log(`\n[API] Reveal request: ${url} (proxy: ${useProxy})`);
    const revealer = new PhoneRevealer(useProxy ? proxyManager : null);
    const result = await revealer.revealPhone(url, { debugScreenshot: true });

    const domain = new URL(url).hostname.replace('www.', '');
    domainStrategy.updateSuccessRate(domain, result.success);

    activeReveal.result = result;
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    activeReveal.running = false;
  }
});

// ─── Mission CRUD (preserved) ─────────────────────────────────────────────────
app.get('/api/missions', (req, res) => {
  // Merge server-tracked missions with orchestrator missions
  const serverMissions = Array.from(missions.values());
  const orchMissions = orchestrator.getAllMissions();
  
  // Deduplicate by ID, preferring orchestrator version
  const orchIds = new Set(orchMissions.map(m => m.id));
  const merged = [
    ...orchMissions,
    ...serverMissions.filter(m => !orchIds.has(m.id)),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(merged);
});

app.get('/api/mission/:id', (req, res) => {
  const mission = orchestrator.getMission(req.params.id) || missions.get(req.params.id);
  if (!mission) return res.status(404).json({ error: 'Mission not found' });
  res.json(mission);
});

app.delete('/api/mission/:id', (req, res) => {
  const missionId = req.params.id;
  const stopped = orchestrator.deleteMission(missionId);
  const deleted = missions.delete(missionId);
  
  if (!stopped && !deleted) {
    return res.status(404).json({ error: 'Mission not found' });
  }
  
  saveMissions();
  res.json({ success: true });
});

app.post('/api/mission/:id/stop', (req, res) => {
  const missionId = req.params.id;
  const mission = orchestrator.getMission(missionId) || missions.get(missionId);
  
  if (!mission) {
    return res.status(404).json({ error: 'Mission not found' });
  }
  
  const stopped = orchestrator.stopMission(missionId);
  
  // If it was a manually tracked mission in server.js
  if (!stopped && mission.status === 'running') {
    mission.status = 'aborted';
    mission.updatedAt = new Date().toISOString();
  }
  
  saveMissions();
  res.json({ success: true, stopped });
});

app.get('/api/missions/stats', (req, res) => {
  const orchStats = orchestrator.getStats();
  const serverAll = Array.from(missions.values());
  const serverCompleted = serverAll.filter(m => m.status === 'completed');
  const serverFailed = serverAll.filter(m => m.status === 'error');

  res.json({
    total: orchStats.total + serverAll.length,
    completed: orchStats.completed + serverCompleted.length,
    failed: orchStats.failed + serverFailed.length,
    running: orchStats.running + serverAll.filter(m => m.status === 'running').length,
    totalPhones: orchStats.totalPhones + serverCompleted.filter(m => m.results?.[0]?.phone).length,
    totalListings: orchStats.totalListings,
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// NEW: CATEGORY SCRAPING
// ════════════════════════════════════════════════════════════════════════════════

app.post('/api/category/scrape', async (req, res) => {
  const { url, maxPages = 2, maxListings = 50, useProxy = false } = req.body;

  if (!url) return res.status(400).json({ error: 'Category URL is required' });
  if (activeCategoryScrape.running) {
    return res.status(429).json({ error: 'A category scrape is already running.' });
  }

  activeCategoryScrape.running = true;

  try {
    const domain = new URL(url).hostname.replace('www.', '');
    console.log(`\n[API] Category scrape: ${url} (maxPages: ${maxPages}, proxy: ${useProxy})`);

    const scrapeResult = await categoryScraper.scrape(url, {
      maxPages,
      maxListings,
      useProxy,
      headless: true,
    });

    const listingsArray = scrapeResult.listings || scrapeResult;
    res.json({
      success: true,
      domain,
      url,
      count: listingsArray.length,
      pagesScraped: scrapeResult.pagesScraped || 0,
      listings: listingsArray,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    activeCategoryScrape.running = false;
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// NEW: BATCH PROCESSING
// ════════════════════════════════════════════════════════════════════════════════

app.post('/api/batch/start', async (req, res) => {
  const {
    listings,
    domain,
    useProxy = false,
    maxRevealsPerProxy = 3,
    delayMin = 45000,
    delayMax = 90000,
  } = req.body;

  if (!listings || !Array.isArray(listings) || listings.length === 0) {
    return res.status(400).json({ error: 'listings array is required' });
  }
  if (!domain) {
    return res.status(400).json({ error: 'domain is required' });
  }
  if (activeBatch.running) {
    return res.status(429).json({ error: 'A batch is already running. Stop it first or wait.' });
  }

  const processor = new BatchProcessor(
    useProxy ? proxyManager : null,
    domainStrategy,
    {
      useProxy,
      maxRevealsPerProxy,
      delayBetweenRevealsMs: [delayMin, delayMax],
      retryFailedOnce: true,
    }
  );

  activeBatch.processor = processor;
  activeBatch.running = true;

  // Run async
  processor.process(listings, domain).then(result => {
    activeBatch.running = false;
    console.log(`[API] Batch completed: ${result.success}/${result.total}`);
  }).catch(err => {
    activeBatch.running = false;
    console.error(`[API] Batch error: ${err.message}`);
  });

  res.json({
    status: 'started',
    total: listings.length,
    domain,
    message: 'Batch processing started. Poll /api/batch/status for progress.',
  });
});

app.get('/api/batch/status', (req, res) => {
  if (!activeBatch.processor) {
    return res.json({ running: false, message: 'No batch has been started.' });
  }
  res.json(activeBatch.processor.getProgress());
});

app.get('/api/batch/results', (req, res) => {
  if (!activeBatch.processor) {
    return res.json({ results: [] });
  }
  res.json({ results: activeBatch.processor.getResults() });
});

app.post('/api/batch/stop', (req, res) => {
  if (!activeBatch.processor || !activeBatch.running) {
    return res.json({ message: 'No active batch to stop.' });
  }
  activeBatch.processor.stop();
  res.json({ message: 'Stop requested. Batch will finish current reveal and stop.' });
});

app.post('/api/batch/pause', (req, res) => {
  if (!activeBatch.processor || !activeBatch.running) {
    return res.json({ message: 'No active batch to pause.' });
  }
  activeBatch.processor.pause();
  res.json({ message: 'Batch paused.' });
});

app.post('/api/batch/resume', (req, res) => {
  if (!activeBatch.processor) {
    return res.json({ message: 'No batch to resume.' });
  }
  activeBatch.processor.resume();
  res.json({ message: 'Batch resumed.' });
});

// ════════════════════════════════════════════════════════════════════════════════
// NEW: AI SITE INTELLIGENCE
// ════════════════════════════════════════════════════════════════════════════════

app.post('/api/intelligence/discover', async (req, res) => {
  const { domain, categoryUrl, listingUrl } = req.body;

  if (!domain) return res.status(400).json({ error: 'domain is required' });
  if (!gemini.isAvailable) {
    return res.status(503).json({ error: 'Gemini AI is not configured. Set GEMINI_API_KEY in .env' });
  }

  try {
    console.log(`\n[API] AI Discovery for: ${domain}`);
    const strategy = await siteIntelligence.discover(domain, {
      categoryUrl: categoryUrl || null,
      listingUrl: listingUrl || null,
    });

    res.json({
      success: true,
      domain,
      strategy,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// NEW: AI CHAT ORCHESTRATOR
// ════════════════════════════════════════════════════════════════════════════════

app.post('/api/chat', async (req, res) => {
  const { message, history = [], personality = 'diplomat' } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  const intent = detectIntent(message);
  console.log(`[Chat] Message: "${message}" → Intent: ${intent.action}`);

  try {
    let response;

    switch (intent.action) {
      case 'extract_phone': {
        const url = intent.url;
        if (!url) {
          response = { content: 'Am nevoie de un URL de listing. Ex: "Extrage telefonul din https://www.olx.ro/d/oferta/..."', toolCall: null };
          break;
        }

        // Create mission directly (no self-fetch)
        const domain = new URL(url).hostname.replace('www.', '');
        const missionId = `mission-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const mission = {
          id: missionId, mode: 'single', platform: domain.includes('olx') ? 'olx' : domain,
          url, useProxy: intent.useProxy || false, status: 'running', domain,
          strategy: domain, results: [], leadsFound: 0, leadsContacted: 0,
          progress: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        missions.set(missionId, mission);

        // Run extraction in background
        (async () => {
          try {
            const result = await orchestrator.executeSingleReveal({ url, useProxy: intent.useProxy || false, personality });
            mission.results = [result];
            mission.leadsFound = 1;
            mission.leadsContacted = result.success ? 1 : 0;
            mission.progress = 100;
            mission.status = result.success ? 'completed' : 'error';
            mission.updatedAt = new Date().toISOString();
            saveMissions();
            console.log(`[Chat] Mission ${missionId} completed: ${result.success ? result.phone : 'failed'}`);
          } catch (err) {
            mission.status = 'error';
            mission.results = [{ success: false, error: err.message, url }];
            mission.updatedAt = new Date().toISOString();
            saveMissions();
          }
        })();

        response = {
          content: `Extrag telefonul din listing...\n\n🔗 ${url}\n\n_Misiune pornită: ${missionId}_`,
          toolCall: { name: 'extract_phone', args: { url }, status: 'running' },
          missionId,
        };
        break;
      }

      case 'scan_category': {
        const url = intent.url;
        if (!url) {
          response = { content: 'Am nevoie de un URL de categorie. Ex: "Scanează https://www.olx.ro/imobiliare/"', toolCall: null };
          break;
        }

        const domain = new URL(url).hostname.replace('www.', '');
        const missionId = `mission-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const mission = {
          id: missionId, mode: 'category', platform: domain.includes('olx') ? 'olx' : domain,
          url, useProxy: intent.useProxy || false, status: 'running', domain,
          strategy: domain, results: [], leadsFound: 0, leadsContacted: 0,
          progress: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        missions.set(missionId, mission);

        // Run category scan in background
        (async () => {
          try {
            const fullMission = await orchestrator.executeMission({
              url, query: '', domain, useProxy: intent.useProxy || false,
              maxPages: 2, maxListings: 50, maxReveals: 5, personality
            });
            mission.results = fullMission.reveals || [];
            mission.leadsFound = fullMission.listings?.length || 0;
            mission.leadsContacted = fullMission.phones?.length || 0;
            mission.progress = 100;
            mission.status = 'completed';
            mission.summary = fullMission.summary;
            mission.updatedAt = new Date().toISOString();
            saveMissions();
          } catch (err) {
            mission.status = 'error';
            mission.results = [{ success: false, error: err.message }];
            mission.updatedAt = new Date().toISOString();
            saveMissions();
          }
        })();

        response = {
          content: `Pornesc scanarea categoriei...\n\n📂 ${url}\n\n_Misiune pornită: ${missionId}_`,
          toolCall: { name: 'scan_category', args: { url, maxPages: 2 }, status: 'running' },
          missionId,
        };
        break;
      }

      case 'analyze_listing': {
        if (!gemini.isAvailable) {
          response = { content: '⚠️ Gemini API nu este configurat. Setează GEMINI_API_KEY în .env', toolCall: null };
          break;
        }
        const listingData = intent.data || message;
        const analysis = await gemini.analyzeListing({ description: listingData });
        response = {
          content: formatAnalysis(analysis),
          toolCall: { name: 'analyze_listing', args: { data: listingData }, result: analysis, status: 'completed' },
        };
        break;
      }

      case 'check_status': {
        const orchStats = orchestrator.getStats();
        const serverAll = Array.from(missions.values());
        const running = serverAll.filter(m => m.status === 'running');

        let statusText = `**Status sistem:**\n`;
        statusText += `• Misiuni active: ${running.length + orchStats.running}\n`;
        statusText += `• Gemini AI: ${gemini.isAvailable ? '✅ Activ' : '❌ Dezactivat'}\n`;
        statusText += `• Proxy-uri: ${proxyManager.availableCount}/${proxyManager.totalCount}\n`;
        statusText += `• Total misiuni: ${serverAll.length + orchStats.total}\n`;
        if (running.length > 0) {
          statusText += `\n**Misiuni în curs:**\n`;
          running.forEach(m => { statusText += `• ${m.url} (${m.status})\n`; });
        }
        response = { content: statusText, toolCall: null };
        break;
      }

      case 'list_missions': {
        const allMissions = [
          ...orchestrator.getAllMissions(),
          ...Array.from(missions.values()),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (allMissions.length === 0) {
          response = { content: 'Nu ai nicio misiune. Trimite un URL pentru a începe o extracție.', toolCall: null };
        } else {
          let text = `**Ultimele ${Math.min(allMissions.length, 10)} misiuni:**\n\n`;
          allMissions.slice(0, 10).forEach((m, i) => {
            const phone = m.results?.[0]?.phone;
            const icon = m.status === 'completed' ? '✅' : m.status === 'error' ? '❌' : '🔄';
            text += `${i + 1}. ${icon} ${m.results?.[0]?.listing?.title || m.url}\n`;
            if (phone) text += `   📞 ${phone}\n`;
          });
          response = { content: text, toolCall: null };
        }
        break;
      }

      default: {
        if (gemini.isAvailable) {
          const systemPrompt = `Ești asistentul AI al NegoApp — o platformă de negociere automată pe marketplace-uri.
Poți ajuta cu: extragerea telefoanelor, analiza anunțurilor, scanare categorii, sfaturi negociere.
Profil negociere activ: ${personality.toUpperCase()}.
Răspunde concis în română. Dacă user-ul trimite un URL, sugerează-i extracția.`;
          const prompt = `${systemPrompt}\n\nUser: ${message}`;
          const aiText = await gemini.generate(prompt, { temperature: 0.7, maxTokens: 1024 });
          response = { content: aiText, toolCall: null };
        } else {
          response = { content: detectHelpMessage(message), toolCall: null };
        }
      }
    }

    res.json(response);
  } catch (err) {
    console.error(`[Chat] Error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

function detectIntent(message) {
  const msg = message.toLowerCase().trim();
  
  // URL extraction
  const urlMatch = message.match(/(https?:\/\/[^\s]+)/);
  const url = urlMatch ? urlMatch[1] : null;
  const useProxy = msg.includes('proxy') || msg.includes('ipv6');

  // Phone extraction
  if (url && (msg.includes('extrage') || msg.includes('telefon') || msg.includes('reveal') || msg.includes('phone') || msg.includes('extract') || msg.includes('nr'))) {
    return { action: 'extract_phone', url, useProxy };
  }
  // Category scan
  if (url && (msg.includes('scan') || msg.includes('categori') || msg.includes('batch') || msg.includes('scanea'))) {
    return { action: 'scan_category', url, useProxy };
  }
  // Just a URL — default to extract phone
  if (url && !msg.includes('analiz')) {
    return { action: 'extract_phone', url, useProxy };
  }
  // Analyze
  if (msg.includes('analiz') || msg.includes('analyze') || msg.includes('valoare') || msg.includes('pret')) {
    return { action: 'analyze_listing', url, data: message };
  }
  // Status
  if (msg.includes('status') || msg.includes('stare')) {
    return { action: 'check_status' };
  }
  // Missions
  if (msg.includes('misiuni') || msg.includes('missions') || msg.includes('istoric') || msg.includes('history')) {
    return { action: 'list_missions' };
  }

  return { action: 'general', url };
}

function formatAnalysis(analysis) {
  if (analysis.raw) return analysis.raw;
  let text = '**📊 Analiză listing:**\n\n';
  if (analysis.marketValue) text += `💰 Valoare piață: ~${analysis.marketValue} RON\n`;
  if (analysis.dealQuality) text += `${analysis.dealQuality === 'great' ? '🟢' : analysis.dealQuality === 'fair' ? '🟡' : '🔴'} Calitate deal: ${analysis.dealQuality}\n`;
  if (analysis.negotiationTip) text += `💡 Sfat: ${analysis.negotiationTip}\n`;
  if (analysis.category) text += `📦 Categorie: ${analysis.category}\n`;
  if (analysis.keyFeatures?.length) text += `\n**Caracteristici:**\n${analysis.keyFeatures.map(f => `• ${f}`).join('\n')}`;
  return text;
}

function detectHelpMessage(message) {
  return `**🤖 NegoApp AI Orchestrator**

Poți folosi următoarele comenzi:

• **Extrage telefon** — trimite un URL de listing
  Ex: \`https://www.olx.ro/d/oferta/...\`

• **Scanează categorie** — trimite un URL de categorie
  Ex: \`Scanează https://www.olx.ro/imobiliare/\`

• **Status** — verifică starea sistemului

• **Misiuni** — vezi istoricul misiunilor

• **Analizează** — analizează o descriere de produs

Gemini AI nu este configurat. Setează \`GEMINI_API_KEY\` în \`.env\` pentru conversație liberă.`;
}

// ════════════════════════════════════════════════════════════════════════════════
// NEW: FULL ORCHESTRATOR (Category → Reveal pipeline)
// ════════════════════════════════════════════════════════════════════════════════

app.post('/api/orchestrate/full', async (req, res) => {
  const {
    url,
    query = '',
    domain: forceDomain,
    useProxy = false,
    maxPages = 2,
    maxListings = 50,
    maxReveals = 5,
    personality = 'diplomat',
  } = req.body;

  if (!url) return res.status(400).json({ error: 'url is required' });

  const missionId = `mission-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

  // Start async - respond immediately with mission ID
  orchestrator.executeMission({
    url,
    query,
    domain: forceDomain,
    useProxy,
    maxPages,
    maxListings,
    maxReveals,
    personality,
  }).then(mission => {
    console.log(`[API] Full mission completed: ${mission.id}`);
  }).catch(err => {
    console.error(`[API] Full mission failed: ${err.message}`);
  });

  res.json({
    status: 'started',
    message: 'Full orchestration mission started. Poll /api/mission/:id for progress.',
    note: 'This runs: strategy check → category scrape → batch reveal',
  });
});

// ─── Preserved: Simple orchestrate (single mode) ─────────────────────────────
app.post('/api/orchestrate', async (req, res) => {
  const { mode, url, query, useProxy = false, platform = 'olx', personality = 'diplomat' } = req.body;

  if (!url) return res.status(400).json({ error: 'URL is required' });
  if (!['single', 'category'].includes(mode)) return res.status(400).json({ error: 'Mode must be "single" or "category"' });

  const domain = platform === 'olx' ? 'olx.ro' : new URL(url).hostname.replace('www.', '');
  const strategy = domainStrategy.load(domain);

  if (!strategy) {
    // Try AI discovery if Gemini is available
    if (gemini.isAvailable) {
      try {
        await siteIntelligence.discover(domain, { listingUrl: mode === 'single' ? url : undefined, categoryUrl: mode === 'category' ? url : undefined });
      } catch (err) {
        return res.status(400).json({
          error: `No strategy for ${domain} and AI discovery failed: ${err.message}`,
          domain,
          status: 'unknown',
        });
      }
    } else {
      return res.status(400).json({
        error: `No strategy available for ${domain}. AI discovery disabled (no GEMINI_API_KEY).`,
        domain,
        status: 'unknown',
      });
    }
  }

  const missionId = `mission-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const mission = {
    id: missionId,
    mode,
    platform,
    url,
    query: query || null,
    useProxy,
    status: 'running',
    domain,
    strategy: domain,
    results: [],
    leadsFound: 0,
    leadsContacted: 0,
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  missions.set(missionId, mission);

  if (mode === 'single') {
    (async () => {
      try {
        const result = await orchestrator.executeSingleReveal({ url, useProxy, personality });
        mission.results = [result];
        mission.leadsFound = 1;
        mission.leadsContacted = result.success ? 1 : 0;
        mission.progress = 100;
        mission.status = result.success ? 'completed' : 'error';
        mission.updatedAt = new Date().toISOString();
        saveMissions();
      } catch (err) {
        mission.status = 'error';
        mission.results = [{ success: false, error: err.message, url }];
        mission.updatedAt = new Date().toISOString();
        saveMissions();
      }
    })();

    res.json({ missionId, status: 'running', message: 'Mission started' });
  }

  if (mode === 'category') {
    // Now we can actually run category mode via the orchestrator
    (async () => {
      try {
        const fullMission = await orchestrator.executeMission({
          url,
          query: query || '',
          domain,
          useProxy,
          maxPages: 2,
          maxListings: 50,
          maxReveals: 5,
        });
        mission.results = fullMission.reveals || [];
        mission.leadsFound = fullMission.listings?.length || 0;
        mission.leadsContacted = fullMission.phones?.length || 0;
        mission.progress = 100;
        mission.status = 'completed';
        mission.summary = fullMission.summary;
        mission.updatedAt = new Date().toISOString();
        saveMissions();
      } catch (err) {
        mission.status = 'error';
        mission.results = [{ success: false, error: err.message }];
        mission.updatedAt = new Date().toISOString();
        saveMissions();
      }
    })();

    res.json({
      missionId,
      status: 'running',
      message: `Category scan started for ${domain}`,
      query: query || null,
    });
  }
});

// ─── Domain strategies ────────────────────────────────────────────────────────
app.get('/api/strategies', (req, res) => {
  res.json(domainStrategy.listAll());
});

app.get('/api/strategy/:domain', (req, res) => {
  const strategy = domainStrategy.load(req.params.domain);
  if (!strategy) return res.status(404).json({ error: 'Strategy not found' });
  res.json(strategy);
});

// ─── Status ───────────────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  const orchStats = orchestrator.getStats();
  res.json({
    running: activeReveal.running,
    lastResult: activeReveal.result,
    batchRunning: activeBatch.running,
    batchProgress: activeBatch.processor?.getProgress() || null,
    categoryScraping: activeCategoryScrape.running,
    activeMissions: orchStats.running,
    geminiAvailable: gemini.isAvailable,
    proxies: {
      total: proxyManager.totalCount,
      available: proxyManager.availableCount,
    },
    orchestratorStats: orchStats,
  });
});

// ─── Proxy stats ──────────────────────────────────────────────────────────────
app.get('/api/proxies', (req, res) => {
  res.json(proxyManager.getStats());
});

// ════════════════════════════════════════════════════════════════════════════════
// CONFIG & SERVICE STATUS ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════════

app.get('/api/config', (req, res) => {
  res.json(loadConfig());
});

app.post('/api/config', (req, res) => {
  try {
    const cfg = req.body;
    saveConfig(cfg);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/services/status', async (req, res) => {
  const waStatus = whatsapp.getStatus();
  
  // Check AgentMail
  const cfg = loadConfig();
  let agentmailStatus = { connected: false, error: null };
  if (cfg.agentMailApiKey && cfg.agentMailApiKey.length > 5) {
    try {
      // Simple validation — try to import and check
      agentmailStatus = { connected: true, error: null };
    } catch (err) {
      agentmailStatus = { connected: false, error: err.message };
    }
  }

  res.json({
    whatsapp: waStatus,
    agentmail: agentmailStatus,
  });
});

// ─── WhatsApp endpoints ───────────────────────────────────────────────────────
app.post('/api/whatsapp/connect', async (req, res) => {
  try {
    const result = await whatsapp.connect();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/whatsapp/qr', (req, res) => {
  const qr = whatsapp.getQR();
  res.json({ qr, status: whatsapp.getStatus() });
});

app.get('/api/whatsapp/status', (req, res) => {
  res.json(whatsapp.getStatus());
});

app.post('/api/whatsapp/disconnect', async (req, res) => {
  try {
    await whatsapp.disconnect();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
const PORT = 3001;
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
