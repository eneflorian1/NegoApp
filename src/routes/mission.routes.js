/**
 * Mission Routes — /api/missions, /api/mission/:id, etc.
 */
import { Router } from 'express';
import MissionRepo from '../db/models/Mission.js';
import ConfigRepo from '../db/models/Config.js';
import { autoContactSeller } from '../core/contact-service.js';
import { requireAuth } from '../middleware/auth.js';

export default function createMissionRoutes({ orchestrator, gemini, whatsapp }) {
  const router = Router();

  router.use(requireAuth);

  router.get('/missions', (req, res) => {
    try {
      res.json(MissionRepo.getAll(req.user.id));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/mission/:id', (req, res) => {
    const mission = orchestrator.getMission(req.params.id) || MissionRepo.get(req.params.id);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });
    if (mission.userId && mission.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    res.json(mission);
  });

  router.delete('/mission/:id', (req, res) => {
    const mission = MissionRepo.get(req.params.id);
    if (mission && mission.userId && mission.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const stopped = orchestrator.deleteMission(req.params.id);
    const deleted = MissionRepo.delete(req.params.id);
    if (!stopped && !deleted) return res.status(404).json({ error: 'Mission not found' });
    res.json({ success: true });
  });

  router.delete('/missions', (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'Array of ids required' });
    
    let deletedCount = 0;
    for (const id of ids) {
      const mission = MissionRepo.get(id);
      if (mission && mission.userId && mission.userId === req.user.id) {
        orchestrator.deleteMission(id);
        if (MissionRepo.delete(id)) deletedCount++;
      }
    }
    res.json({ success: true, deletedCount });
  });

  router.post('/mission/:id/stop', (req, res) => {
    const missionId = req.params.id;
    const mission = orchestrator.getMission(missionId) || MissionRepo.get(missionId);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });
    if (mission.userId && mission.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const stopped = orchestrator.stopMission(missionId);
    if (!stopped && mission.status === 'running') {
      mission.status = 'aborted';
      mission.updatedAt = new Date().toISOString();
    }
    MissionRepo.save();
    res.json({ success: true, stopped });
  });

  router.post('/orchestrate/full', async (req, res) => {
    const userId = req.user.id;
    const { url, urls: inputUrls, maxPages = 2, maxListings = 50, maxReveals = 5, useProxy = false } = req.body;

    // Support both single `url` and array `urls`
    const urls = inputUrls && Array.isArray(inputUrls) && inputUrls.length > 0
      ? inputUrls
      : (url ? [url] : []);

    if (urls.length === 0) return res.status(400).json({ error: 'URL is required (pass url or urls[])' });

    // Validate all URLs
    for (const u of urls) {
      try { new URL(u); } catch { return res.status(400).json({ error: `Invalid URL: ${u}` }); }
    }

    const cfg = ConfigRepo.load(userId);
    const userGemini = gemini.forKey(cfg.geminiApiKey);
    const waClient = whatsapp.getClient ? whatsapp.getClient(userId) : whatsapp;

    const missionIds = [];

    for (const missionUrl of urls) {
      const domain = new URL(missionUrl).hostname.replace('www.', '');
      const mission = MissionRepo.create({
        userId,
        mode: 'category',
        platform: domain.includes('olx') ? 'olx' : domain,
        url: missionUrl, useProxy, status: 'running', domain, strategy: domain,
      });
      missionIds.push(mission.id);

      (async () => {
        try {
          const fullMission = await orchestrator.executeMission({
            url: missionUrl, domain, useProxy, maxPages, maxListings, maxReveals,
            geminiClient: userGemini,
            onPhoneRevealed: async (result) => {
              mission.leadsContacted = (mission.leadsContacted || 0) + 1;
              if (!mission.results) mission.results = [];
              mission.results.push(result);
              mission.updatedAt = new Date().toISOString();
              MissionRepo.save();
              if (result.phone) await autoContactSeller(result, { gemini: userGemini, whatsapp: waClient, userId });
            },
          });
          mission.results = fullMission.reveals || [];
          mission.leadsFound = fullMission.listings?.length || 0;
          mission.leadsContacted = fullMission.phones?.length || 0;
          mission.progress = 100;
          mission.status = 'completed';
          mission.summary = fullMission.summary;
          mission.updatedAt = new Date().toISOString();
          MissionRepo.save();
        } catch (err) {
          mission.status = 'error';
          mission.results = [{ success: false, error: err.message }];
          mission.updatedAt = new Date().toISOString();
          MissionRepo.save();
        }
      })();
    }

    res.json({ missionIds, missionId: missionIds[0], status: 'started', count: missionIds.length });
  });

  router.get('/missions/stats', (req, res) => {
    try {
      const userId = req.user.id;
      const orchStats = orchestrator.getStats();
      const serverAll = MissionRepo.getAll(userId);
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
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
