/**
 * Mission Routes — /api/missions, /api/mission/:id, etc.
 */
import { Router } from 'express';
import MissionRepo from '../db/models/Mission.js';

export default function createMissionRoutes({ orchestrator }) {
  const router = Router();

  router.get('/missions', (req, res) => {
    try {
      const serverMissions = MissionRepo.getAll();
      res.json(serverMissions);
    } catch (err) {
      console.error('[API] GET /api/missions error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/mission/:id', (req, res) => {
    const mission = orchestrator.getMission(req.params.id) || MissionRepo.get(req.params.id);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });
    res.json(mission);
  });

  router.delete('/mission/:id', (req, res) => {
    const missionId = req.params.id;
    const stopped = orchestrator.deleteMission(missionId);
    const deleted = MissionRepo.delete(missionId);
    if (!stopped && !deleted) return res.status(404).json({ error: 'Mission not found' });
    res.json({ success: true });
  });

  router.post('/mission/:id/stop', (req, res) => {
    const missionId = req.params.id;
    const mission = orchestrator.getMission(missionId) || MissionRepo.get(missionId);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });
    const stopped = orchestrator.stopMission(missionId);
    if (!stopped && mission.status === 'running') {
      mission.status = 'aborted';
      mission.updatedAt = new Date().toISOString();
    }
    MissionRepo.save();
    res.json({ success: true, stopped });
  });

  router.get('/missions/stats', (req, res) => {
    try {
      const orchStats = orchestrator.getStats();
      const serverAll = MissionRepo.getAll();
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

  return router;
}
