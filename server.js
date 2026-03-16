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
import MailClient from './src/channels/mail-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const MISSIONS_FILE = join(DATA_DIR, 'missions.json');
const CONFIG_FILE = join(DATA_DIR, 'config.json');
const MESSAGES_FILE = join(DATA_DIR, 'messages.json');
const LEADS_FILE = join(DATA_DIR, 'leads.json');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Core services ────────────────────────────────────────────────────────────
const VPS_HOST = '206.189.10.234';
const proxyManager = ProxyManager.fromVPS(VPS_HOST, 10001, 16);
const domainStrategy = new DomainStrategy();
const gemini = new GeminiClient();
// Gemini reads API key dynamically from saved config (Settings UI)
gemini.setConfigKeyProvider(() => {
  const cfg = loadConfig();
  return cfg.geminiApiKey || null;
});

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
whatsapp.on('message', async (msg) => {
  const cleanPhone = stripWhatsAppId(msg.from);
  const displayName = msg.contactName || cleanPhone;

  // Find or create lead for this sender
  let lead = findLeadByPhone(msg.from);
  if (!lead) {
    lead = {
      id: `lead-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      url: '',
      title: 'WhatsApp Conversation',
      initialPrice: '',
      price: '',
      sellerName: displayName,
      phoneNumber: cleanPhone,
      whatsappId: msg.from,  // original WA id for replies (e.g. 123@lid)
      isSaved: false,
      status: 'new',
      platform: 'olx',
      createdAt: new Date().toISOString(),
      isBotActive: true,
      channel: 'whatsapp',
    };
    leads.push(lead);
    saveLeads();
    console.log(`[WhatsApp] New lead created for ${displayName} (${cleanPhone})`);
  } else {
    // Ensure whatsappId is stored (fix for old leads)
    if (!lead.whatsappId) {
      lead.whatsappId = msg.from;
      saveLeads();
    }
    if (msg.contactName && lead.sellerName === lead.phoneNumber) {
      lead.sellerName = msg.contactName;
      saveLeads();
    }
  }

  // Store the incoming message
  const message = {
    id: `wa-in-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    leadId: lead.id,
    sender: 'seller',
    text: msg.body,
    timestamp: new Date((msg.timestamp || Date.now() / 1000) * 1000).toISOString(),
    channel: 'whatsapp',
    from: msg.from,
  };
  messages.push(message);
  saveMessages();

  // Update lead's last message
  lead.lastMessage = msg.body;
  saveLeads();

  console.log(`[WhatsApp] Incoming message from ${displayName}: "${msg.body.substring(0, 50)}"`);
  console.log(`[WhatsApp] Auto-reply check: botActive=${lead.isBotActive}, geminiAvailable=${gemini.isAvailable}, whatsappId=${lead.whatsappId}`);

  // Auto-reply if bot is active and Gemini is available
  if (lead.isBotActive && gemini.isAvailable) {
    try {
      const cfg = loadConfig();
      const systemPrompt = cfg.whatsappSystemPrompt || 'Esti un asistent de negociere. Raspunde scurt si prietenos in limba romana.';

      // Build conversation history for context
      const history = messages
        .filter(m => m.leadId === lead.id)
        .slice(-10)
        .map(m => `${m.sender === 'me' ? 'Tu' : 'Vanzator'}: ${m.text}`)
        .join('\n');

      const prompt = `${systemPrompt}\n\nConversatia pana acum:\n${history}\n\nRaspunde la ultimul mesaj al vanzatorului. Raspunde DOAR cu textul mesajului, fara prefixe.`;

      const reply = await gemini.generate(prompt, { temperature: 0.7, maxTokens: 256 });
      const replyText = reply.trim();

      if (replyText) {
        // Send via WhatsApp — use original WA id (e.g. @lid, @c.us)
        await whatsapp.sendMessage(lead.whatsappId || msg.from, replyText);

        // Store outgoing message
        const outMsg = {
          id: `wa-out-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          leadId: lead.id,
          sender: 'me',
          text: replyText,
          timestamp: new Date().toISOString(),
          channel: 'whatsapp',
          to: msg.from,
        };
        messages.push(outMsg);
        saveMessages();

        // Update lead status and last message
        lead.lastMessage = replyText;
        if (lead.status === 'new') {
          lead.status = 'contacted';
        }
        lead.lastContacted = new Date().toISOString();
        saveLeads();

        console.log(`[WhatsApp] Auto-reply sent to ${msg.from}: "${replyText.substring(0, 50)}..."`);
      }
    } catch (err) {
      console.error(`[WhatsApp] Auto-reply failed for ${msg.from}:`, err.message);
    }
  }
});

// ─── AgentMail client ────────────────────────────────────────────────────────
const agentmail = new MailClient();

agentmail.on('message', async (msg) => {
  // Extract sender email address
  const senderEmail = msg.from.replace(/.*</, '').replace(/>.*/, '').trim();
  const senderName = msg.from.includes('<') ? msg.from.replace(/<.*/, '').trim() : senderEmail;

  // Find or create lead for this sender
  let lead = leads.find(l => l.phoneNumber === senderEmail || l.sellerName === senderEmail);
  if (!lead) {
    lead = {
      id: `lead-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      url: '',
      title: msg.subject || 'Email Conversation',
      initialPrice: '',
      price: '',
      sellerName: senderName || senderEmail,
      phoneNumber: senderEmail,
      isSaved: false,
      status: 'new',
      platform: 'olx',
      createdAt: new Date().toISOString(),
      isBotActive: true,
      channel: 'email',
    };
    leads.push(lead);
    saveLeads();
    console.log(`[AgentMail] New lead created for ${senderEmail}`);
  }

  // Store the incoming message
  const message = {
    id: `mail-in-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    leadId: lead.id,
    sender: 'seller',
    text: msg.text,
    timestamp: msg.timestamp || new Date().toISOString(),
    channel: 'email',
    from: msg.from,
    subject: msg.subject,
    emailMessageId: msg.messageId,
  };
  messages.push(message);
  saveMessages();

  lead.lastMessage = msg.text.substring(0, 100);
  saveLeads();

  console.log(`[AgentMail] Incoming email from ${senderEmail}: "${msg.subject}", text="${msg.text.substring(0, 80)}"`);
  console.log(`[AgentMail] Auto-reply check: botActive=${lead.isBotActive}, geminiAvailable=${gemini.isAvailable}`);

  // Auto-reply if bot is active and Gemini is available
  if (lead.isBotActive && gemini.isAvailable) {
    try {
      const cfg = loadConfig();
      const systemPrompt = cfg.emailSystemPrompt || 'Esti un asistent de negociere pe email. Raspunde profesional si scurt in limba romana.';

      const history = messages
        .filter(m => m.leadId === lead.id)
        .slice(-10)
        .map(m => `${m.sender === 'me' ? 'Tu' : 'Vanzator'}: ${m.text}`)
        .join('\n');

      const prompt = `${systemPrompt}\n\nConversatia pana acum:\n${history}\n\nRaspunde la ultimul email al vanzatorului. Raspunde DOAR cu textul mesajului, fara prefixe sau subiect.`;

      const reply = await gemini.generate(prompt, { temperature: 0.7, maxTokens: 512 });
      const replyText = reply.trim();

      if (replyText) {
        // Reply via AgentMail
        await agentmail.replyToMessage(msg.messageId, { text: replyText });

        // Store outgoing message
        const outMsg = {
          id: `mail-out-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          leadId: lead.id,
          sender: 'me',
          text: replyText,
          timestamp: new Date().toISOString(),
          channel: 'email',
          to: senderEmail,
        };
        messages.push(outMsg);
        saveMessages();

        lead.lastMessage = replyText.substring(0, 100);
        if (lead.status === 'new') {
          lead.status = 'contacted';
        }
        lead.lastContacted = new Date().toISOString();
        saveLeads();

        console.log(`[AgentMail] Auto-reply sent to ${senderEmail}`);
      }
    } catch (err) {
      console.error(`[AgentMail] Auto-reply failed for ${senderEmail}:`, err.message);
    }
  }
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

function loadMessages() {
  if (!existsSync(MESSAGES_FILE)) return [];
  try {
    return JSON.parse(readFileSync(MESSAGES_FILE, 'utf-8'));
  } catch { return []; }
}

function saveMessages() {
  writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

function loadLeads() {
  if (!existsSync(LEADS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(LEADS_FILE, 'utf-8'));
  } catch { return []; }
}

function saveLeads() {
  writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

/** Strip WhatsApp suffixes and extract clean phone number */
function stripWhatsAppId(waId) {
  if (!waId) return '';
  // Remove any @suffix (@c.us, @s.whatsapp.net, @lid, @g.us, etc.)
  return waId.replace(/@.*$/, '');
}

/** Normalize phone to digits-only for matching */
function normalizePhone(phone) {
  if (!phone) return '';
  const digits = stripWhatsAppId(phone).replace(/[^0-9]/g, '');
  // Normalize Romanian prefix: 40xxx -> 0xxx
  return digits.replace(/^40(\d{9})$/, '0$1');
}

/** Find lead by WhatsApp sender ID */
function findLeadByPhone(waFrom) {
  const normalized = normalizePhone(waFrom);
  if (!normalized) return null;
  return leads.find(l => normalizePhone(l.phoneNumber) === normalized);
}

const missions = loadMissions();
const savedConfig = loadConfig();
const messages = loadMessages();
const leads = loadLeads();
console.log(`[Server] Loaded ${missions.size} missions from disk`);
console.log(`[Server] Loaded ${messages.length} messages from disk`);
console.log(`[Server] Loaded ${leads.length} leads from disk`);
console.log(`[Server] Config loaded: ${Object.keys(savedConfig).length} keys`);

// Auto-connect WhatsApp if session exists
(async () => {
  try {
    const authDir = join(DATA_DIR, '.wwebjs_auth');
    if (existsSync(authDir)) {
      console.log('[Server] Found WhatsApp session, auto-connecting...');
      await whatsapp.connect();
      // Wait for initialization to complete or fail
      await new Promise(resolve => setTimeout(resolve, 15000));
      if (!whatsapp.isConnected && !whatsapp.isInitializing) {
        console.log('[Server] WhatsApp auto-connect failed, will require manual reconnect');
      }
    }
  } catch (err) {
    console.log('[Server] WhatsApp auto-connect skipped:', err.message);
  }

  // Auto-connect AgentMail if API key is configured
  try {
    const cfg = loadConfig();
    if (cfg.agentMailApiKey && cfg.agentMailApiKey.length > 5) {
      console.log('[Server] AgentMail API key found, connecting...');
      await agentmail.connect(cfg.agentMailApiKey);
    }
  } catch (err) {
    console.log('[Server] AgentMail auto-connect skipped:', err.message);
  }
})();

// ─── Auto-contact seller after successful reveal ─────────────────────────────
async function autoContactSeller(result, { personality = 'diplomat' } = {}) {
  if (!result.success || !result.phone) return null;

  const cfg = loadConfig();
  if (!cfg.autoPilotEnabled) {
    console.log('[AutoContact] AutoPilot disabled, skipping auto-contact');
    return null;
  }

  const phone = result.phone;
  const listing = result.listing || {};
  const title = listing.title || 'Anunt';
  const price = listing.price || '';
  const sellerName = listing.sellerName || phone;
  const url = result.url || '';

  // Check if lead already exists for this phone
  let lead = leads.find(l => normalizePhone(l.phoneNumber) === normalizePhone(phone));
  if (lead) {
    console.log(`[AutoContact] Lead already exists for ${phone}, skipping`);
    return lead;
  }

  // Create lead
  lead = {
    id: `lead-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    url,
    title,
    initialPrice: price,
    price,
    sellerName,
    phoneNumber: phone,
    isSaved: false,
    status: 'new',
    platform: 'olx',
    createdAt: new Date().toISOString(),
    isBotActive: true,
    channel: 'whatsapp',
  };
  leads.push(lead);
  saveLeads();
  console.log(`[AutoContact] Lead created: ${lead.id} — ${sellerName} (${phone})`);

  // Generate first message using Gemini
  if (!gemini.isAvailable) {
    console.log('[AutoContact] Gemini not available, lead created but no message sent');
    return lead;
  }

  try {
    const systemPrompt = cfg.whatsappSystemPrompt || 'Esti un asistent de negociere. Raspunde scurt si prietenos in limba romana.';
    const prompt = `${systemPrompt}\n\nTrebuie sa contactezi un vanzator pentru prima data.\nDetalii anunt:\n- Titlu: ${title}\n- Pret: ${price}\n- Vanzator: ${sellerName}\n- URL: ${url}\n\nScrie un prim mesaj scurt si prietenos prin care sa arati interes pentru produs si sa incepi negocierea. Raspunde DOAR cu textul mesajului, fara prefixe.`;

    const reply = await gemini.generate(prompt, { temperature: 0.7, maxTokens: 256 });
    const replyText = reply.trim();

    if (!replyText) {
      console.log('[AutoContact] Gemini returned empty response');
      return lead;
    }

    // Send via WhatsApp
    if (!whatsapp.isConnected) {
      console.log('[AutoContact] WhatsApp not connected, lead created but message not sent');
      return lead;
    }

    // Format phone for WhatsApp: ensure country code, add @c.us
    let waId = phone.replace(/[^0-9]/g, '');
    if (waId.startsWith('0')) waId = '40' + waId.substring(1); // Romanian prefix
    waId = waId + '@c.us';

    await whatsapp.sendMessage(waId, replyText);

    // Store outgoing message
    const outMsg = {
      id: `wa-out-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      leadId: lead.id,
      sender: 'me',
      text: replyText,
      timestamp: new Date().toISOString(),
      channel: 'whatsapp',
      to: waId,
    };
    messages.push(outMsg);
    saveMessages();

    // Update lead
    lead.status = 'contacted';
    lead.lastContacted = new Date().toISOString();
    lead.lastMessage = replyText;
    lead.whatsappId = waId;
    saveLeads();

    console.log(`[AutoContact] First message sent to ${phone}: "${replyText.substring(0, 60)}..."`);
    return lead;
  } catch (err) {
    console.error(`[AutoContact] Failed to send first message to ${phone}:`, err.message);
    return lead;
  }
}

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
  try {
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
  } catch (err) {
    console.error('[API] GET /api/missions error:', err);
    res.status(500).json({ error: err.message });
  }
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
  try {
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
  } catch (err) {
    console.error('[API] GET /api/missions/stats error:', err);
    res.status(500).json({ error: err.message });
  }
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
            result.url = url;
            mission.results = [result];
            mission.leadsFound = 1;
            mission.leadsContacted = result.success ? 1 : 0;
            mission.progress = 100;
            mission.status = result.success ? 'completed' : 'error';
            mission.updatedAt = new Date().toISOString();
            saveMissions();
            console.log(`[Chat] Mission ${missionId} completed: ${result.success ? result.phone : 'failed'}`);

            // Auto-contact seller after successful extraction
            if (result.success) {
              await autoContactSeller(result, { personality });
            }
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

            // Auto-contact all successfully revealed sellers
            const reveals = fullMission.reveals || [];
            for (const result of reveals) {
              if (result.success && result.phone) {
                await autoContactSeller(result, { personality });
              }
            }
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
  }).then(async (mission) => {
    console.log(`[API] Full mission completed: ${mission.id}`);
    // Auto-contact all successfully revealed sellers
    const reveals = mission.reveals || [];
    for (const result of reveals) {
      if (result.success && result.phone) {
        await autoContactSeller(result, { personality });
      }
    }
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
        result.url = url;
        mission.results = [result];
        mission.leadsFound = 1;
        mission.leadsContacted = result.success ? 1 : 0;
        mission.progress = 100;
        mission.status = result.success ? 'completed' : 'error';
        mission.updatedAt = new Date().toISOString();
        saveMissions();

        if (result.success) {
          await autoContactSeller(result, { personality });
        }
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
          personality,
        });
        mission.results = fullMission.reveals || [];
        mission.leadsFound = fullMission.listings?.length || 0;
        mission.leadsContacted = fullMission.phones?.length || 0;
        mission.progress = 100;
        mission.status = 'completed';
        mission.summary = fullMission.summary;
        mission.updatedAt = new Date().toISOString();
        saveMissions();

        // Auto-contact all successfully revealed sellers
        const reveals = fullMission.reveals || [];
        for (const result of reveals) {
          if (result.success && result.phone) {
            await autoContactSeller(result, { personality });
          }
        }
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
  try {
    res.json(loadConfig());
  } catch (err) {
    console.error('[API] GET /api/config error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const cfg = req.body;
    saveConfig(cfg);

    // Auto-connect AgentMail when API key is saved
    if (cfg.agentMailApiKey && cfg.agentMailApiKey.length > 5 && !agentmail.isConnected) {
      agentmail.connect(cfg.agentMailApiKey).catch(err => {
        console.error('[Server] AgentMail connect after config save failed:', err.message);
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/services/status', async (req, res) => {
  const waStatus = whatsapp.getStatus();
  const mailStatus = agentmail.getStatus();

  res.json({
    whatsapp: waStatus,
    agentmail: mailStatus,
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

// ─── Leads endpoints ─────────────────────────────────────────────────────────
app.get('/api/leads', (req, res) => {
  res.json(leads);
});

app.post('/api/leads', (req, res) => {
  const lead = {
    id: `lead-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    ...req.body,
    createdAt: new Date().toISOString(),
  };
  leads.push(lead);
  saveLeads();
  res.json(lead);
});

app.put('/api/leads/:id', (req, res) => {
  const idx = leads.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Lead not found' });
  leads[idx] = { ...leads[idx], ...req.body };
  saveLeads();
  res.json(leads[idx]);
});

app.delete('/api/leads/:id', (req, res) => {
  const idx = leads.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Lead not found' });
  leads.splice(idx, 1);
  saveLeads();
  // Also remove associated messages
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].leadId === req.params.id) {
      messages.splice(i, 1);
    }
  }
  saveMessages();
  res.json({ success: true });
});

// ─── Messages endpoints ──────────────────────────────────────────────────────
app.get('/api/messages', (req, res) => {
  let result = messages;
  if (req.query.channel) {
    result = result.filter(m => m.channel === req.query.channel);
  }
  res.json(result);
});

app.get('/api/messages/:leadId', (req, res) => {
  const leadMessages = messages.filter(m => m.leadId === req.params.leadId);
  res.json(leadMessages);
});

app.delete('/api/conversations/:leadId', (req, res) => {
  const { leadId } = req.params;
  const deleteLead = req.query.deleteLead === 'true';

  // Remove all messages for this lead
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].leadId === leadId) {
      messages.splice(i, 1);
    }
  }
  saveMessages();

  // Optionally remove the lead itself
  if (deleteLead) {
    const idx = leads.findIndex(l => l.id === leadId);
    if (idx !== -1) {
      leads.splice(idx, 1);
      saveLeads();
    }
  }

  res.json({ success: true });
});

app.post('/api/messages/send', async (req, res) => {
  const { leadId, text, channel, to } = req.body;
  if (!text || !channel) {
    return res.status(400).json({ error: 'text and channel are required' });
  }

  try {
    let result = {};
    if (channel === 'whatsapp') {
      if (!whatsapp.isConnected) {
        return res.status(400).json({ error: 'WhatsApp not connected' });
      }
      // Use whatsappId from lead if available (for @lid addresses)
      const lead = leadId ? leads.find(l => l.id === leadId) : null;
      const waRecipient = (lead && lead.whatsappId) || to;
      result = await whatsapp.sendMessage(waRecipient, text);
    } else if (channel === 'email') {
      if (!agentmail.isConnected) {
        return res.status(400).json({ error: 'AgentMail not connected' });
      }
      result = await agentmail.sendEmail({ to, subject: req.body.subject || 'NegoApp', text });
    }

    const message = {
      id: `${channel}-out-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      leadId: leadId || null,
      sender: 'me',
      text,
      timestamp: new Date().toISOString(),
      channel,
      to,
    };
    messages.push(message);
    saveMessages();
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// ─── Serve frontend (production) ─────────────────────────────────────────────
// In production, serve the Vite-built files from dist/
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA catch-all: any non-API route serves index.html (Express 5 syntax)
  app.get('/{*splat}', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
  console.log(`[Server] Serving frontend from ${distPath}`);
}

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[Server] Error on ${req.method} ${req.path}:`, err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ═══════════════════════════════════════════════════════════════════════════════
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
