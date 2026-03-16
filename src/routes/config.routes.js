/**
 * Config & Service Status Routes — /api/config, /api/services/status, /api/whatsapp/*, /api/status, /api/proxies, /api/strategies, /api/intelligence, /api/orchestrate
 */
import { Router } from 'express';
import ConfigRepo from '../db/models/Config.js';
import MissionRepo from '../db/models/Mission.js';
import { autoContactSeller } from '../core/contact-service.js';

export default function createConfigRoutes({ whatsapp, agentmail, gemini, orchestrator, proxyManager, domainStrategy, siteIntelligence, categoryScraper, revealRouter, batchRouter }) {
  const router = Router();

  // ─── Config ────────────────────────────────────────────────────────────────
  router.get('/config', (req, res) => {
    try { res.json(ConfigRepo.load()); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/config', async (req, res) => {
    try {
      const cfg = req.body;
      ConfigRepo.save(cfg);
      if (cfg.agentMailApiKey && cfg.agentMailApiKey.length > 5 && !agentmail.isConnected) {
        agentmail.connect(cfg.agentMailApiKey).catch(err => {
          console.error('[Server] AgentMail connect after config save failed:', err.message);
        });
      }
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── Service Status ────────────────────────────────────────────────────────
  router.get('/services/status', async (req, res) => {
    res.json({ whatsapp: whatsapp.getStatus(), agentmail: agentmail.getStatus() });
  });

  // ─── WhatsApp ──────────────────────────────────────────────────────────────
  router.post('/whatsapp/connect', async (req, res) => {
    try { res.json(await whatsapp.connect()); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/whatsapp/qr', (req, res) => {
    res.json({ qr: whatsapp.getQR(), status: whatsapp.getStatus() });
  });

  router.get('/whatsapp/status', (req, res) => {
    res.json(whatsapp.getStatus());
  });

  router.post('/whatsapp/disconnect', async (req, res) => {
    try { await whatsapp.disconnect(); res.json({ success: true }); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── Status (global) ──────────────────────────────────────────────────────
  router.get('/status', (req, res) => {
    const orchStats = orchestrator.getStats();
    const activeReveal = revealRouter?._activeReveal || { running: false, result: null };
    const activeBatch = batchRouter?._activeBatch || { running: false, processor: null };
    res.json({
      running: activeReveal.running,
      lastResult: activeReveal.result,
      batchRunning: activeBatch.running,
      batchProgress: activeBatch.processor?.getProgress() || null,
      categoryScraping: false,
      activeMissions: orchStats.running,
      geminiAvailable: gemini.isAvailable,
      proxies: { total: proxyManager.totalCount, available: proxyManager.availableCount },
      orchestratorStats: orchStats,
    });
  });

  // ─── Proxies ───────────────────────────────────────────────────────────────
  router.get('/proxies', (req, res) => { res.json(proxyManager.getStats()); });

  // ─── Strategies ────────────────────────────────────────────────────────────
  router.get('/strategies', (req, res) => { res.json(domainStrategy.listAll()); });
  router.get('/strategy/:domain', (req, res) => {
    const strategy = domainStrategy.load(req.params.domain);
    if (!strategy) return res.status(404).json({ error: 'Strategy not found' });
    res.json(strategy);
  });

  // ─── AI Site Intelligence ──────────────────────────────────────────────────
  router.post('/intelligence/discover', async (req, res) => {
    const { domain, categoryUrl, listingUrl } = req.body;
    if (!domain) return res.status(400).json({ error: 'domain is required' });
    if (!gemini.isAvailable) return res.status(503).json({ error: 'Gemini AI is not configured. Set GEMINI_API_KEY in .env' });
    try {
      const strategy = await siteIntelligence.discover(domain, { categoryUrl: categoryUrl || null, listingUrl: listingUrl || null });
      res.json({ success: true, domain, strategy });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // ─── Category Scrape ───────────────────────────────────────────────────────
  const activeCategoryScrape = { running: false };
  router.post('/category/scrape', async (req, res) => {
    const { url, maxPages = 2, maxListings = 50, useProxy = false } = req.body;
    if (!url) return res.status(400).json({ error: 'Category URL is required' });
    if (activeCategoryScrape.running) return res.status(429).json({ error: 'A category scrape is already running.' });
    activeCategoryScrape.running = true;
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      const scrapeResult = await categoryScraper.scrape(url, { maxPages, maxListings, useProxy, headless: true });
      const listingsArray = scrapeResult.listings || scrapeResult;
      res.json({ success: true, domain, url, count: listingsArray.length, pagesScraped: scrapeResult.pagesScraped || 0, listings: listingsArray });
    } catch (error) { res.status(500).json({ error: error.message }); }
    finally { activeCategoryScrape.running = false; }
  });

  // ─── Full Orchestrator ─────────────────────────────────────────────────────
  router.post('/orchestrate/full', async (req, res) => {
    const { url, query = '', domain: forceDomain, useProxy = false, maxPages = 2, maxListings = 50, maxReveals = 5, personality = 'diplomat' } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    const domain = forceDomain || new URL(url).hostname.replace('www.', '');
    const mission = MissionRepo.create({
      mode: 'category', platform: domain.includes('olx') ? 'olx' : domain,
      url, useProxy, status: 'running', domain, strategy: domain,
    });

    orchestrator.executeMission({
      url, query, domain: forceDomain, useProxy, maxPages, maxListings, maxReveals, personality,
      onPhoneRevealed: async (result) => {
        mission.leadsContacted = (mission.leadsContacted || 0) + 1;
        if (!mission.results) mission.results = [];
        mission.results.push(result);
        mission.updatedAt = new Date().toISOString();
        MissionRepo.save();
        if (result.phone) await autoContactSeller(result, { gemini, whatsapp });
      }
    }).then(async (fullMission) => {
      mission.results = fullMission.reveals || [];
      mission.leadsFound = fullMission.listings?.length || 0;
      mission.leadsContacted = fullMission.phones?.length || 0;
      mission.progress = 100;
      mission.status = 'completed';
      mission.summary = fullMission.summary;
      mission.updatedAt = new Date().toISOString();
      MissionRepo.save();
    }).catch(err => {
      mission.status = 'error';
      mission.results = [{ success: false, error: err.message }];
      mission.updatedAt = new Date().toISOString();
      MissionRepo.save();
    });

    res.json({ status: 'started', missionId: mission.id, maxListings, maxPages, maxReveals, message: `Full orchestration mission started. Poll /api/mission/${mission.id} for progress.` });
  });

  // ─── Simple Orchestrate (single/category mode) ────────────────────────────
  router.post('/orchestrate', async (req, res) => {
    const { mode, url, query, useProxy = false, platform = 'olx', personality = 'diplomat' } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    if (!['single', 'category'].includes(mode)) return res.status(400).json({ error: 'Mode must be "single" or "category"' });

    const domain = platform === 'olx' ? 'olx.ro' : new URL(url).hostname.replace('www.', '');
    const strategy = domainStrategy.load(domain);

    if (!strategy) {
      if (gemini.isAvailable) {
        try { await siteIntelligence.discover(domain, { listingUrl: mode === 'single' ? url : undefined, categoryUrl: mode === 'category' ? url : undefined }); }
        catch (err) { return res.status(400).json({ error: `No strategy for ${domain} and AI discovery failed: ${err.message}`, domain, status: 'unknown' }); }
      } else {
        return res.status(400).json({ error: `No strategy available for ${domain}. AI discovery disabled (no GEMINI_API_KEY).`, domain, status: 'unknown' });
      }
    }

    const mission = MissionRepo.create({
      mode, platform, url, query: query || null, useProxy, status: 'running', domain, strategy: domain,
    });

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
          MissionRepo.save();
          if (result.success) await autoContactSeller(result, { gemini, whatsapp });
        } catch (err) {
          mission.status = 'error';
          mission.results = [{ success: false, error: err.message, url }];
          mission.updatedAt = new Date().toISOString();
          MissionRepo.save();
        }
      })();
      res.json({ missionId: mission.id, status: 'running', message: 'Mission started' });
    }

    if (mode === 'category') {
      (async () => {
        try {
          const fullMission = await orchestrator.executeMission({
            url, query: query || '', domain, useProxy, maxPages: 2, maxListings: 50, maxReveals: 5, personality,
          });
          mission.results = fullMission.reveals || [];
          mission.leadsFound = fullMission.listings?.length || 0;
          mission.leadsContacted = fullMission.phones?.length || 0;
          mission.progress = 100;
          mission.status = 'completed';
          mission.summary = fullMission.summary;
          mission.updatedAt = new Date().toISOString();
          MissionRepo.save();
          const reveals = fullMission.reveals || [];
          for (const result of reveals) {
            if (result.success && result.phone) await autoContactSeller(result, { gemini, whatsapp });
          }
        } catch (err) {
          mission.status = 'error';
          mission.results = [{ success: false, error: err.message }];
          mission.updatedAt = new Date().toISOString();
          MissionRepo.save();
        }
      })();
      res.json({ missionId: mission.id, status: 'running', message: `Category scan started for ${domain}`, query: query || null });
    }
  });

  // ─── Health ────────────────────────────────────────────────────────────────
  router.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

  return router;
}
