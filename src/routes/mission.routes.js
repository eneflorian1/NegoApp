/**
 * Mission Routes — /api/missions, /api/mission/:id, etc.
 */
import { Router } from 'express';
import MissionRepo from '../db/models/Mission.js';
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
    const { url, maxPages = 2, maxListings = 50, maxReveals = 5, useProxy = false } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    let domain;
    try { domain = new URL(url).hostname.replace('www.', ''); }
    catch { return res.status(400).json({ error: 'Invalid URL' }); }

    const mission = MissionRepo.create({
      userId,
      mode: 'category',
      platform: domain.includes('olx') ? 'olx' : domain,
      url, useProxy, status: 'running', domain, strategy: domain,
    });

    const waClient = whatsapp.getClient ? whatsapp.getClient(userId) : whatsapp;

    (async () => {
      try {
        const fullMission = await orchestrator.executeMission({
          url, domain, useProxy, maxPages, maxListings, maxReveals,
          onPhoneRevealed: async (result) => {
            mission.leadsContacted = (mission.leadsContacted || 0) + 1;
            if (!mission.results) mission.results = [];
            mission.results.push(result);
            mission.updatedAt = new Date().toISOString();
            MissionRepo.save();
            if (result.phone) await autoContactSeller(result, { gemini, whatsapp: waClient, userId });
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

    res.json({ missionId: mission.id, status: 'started' });
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
