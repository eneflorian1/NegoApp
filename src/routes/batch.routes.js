/**
 * Batch Processing Routes — /api/batch/*
 */
import { Router } from 'express';
import BatchProcessor from '../scraper/batch-processor.js';

export default function createBatchRoutes({ proxyManager, domainStrategy }) {
  const router = Router();
  const activeBatch = { processor: null, running: false };

  router.post('/batch/start', async (req, res) => {
    const {
      listings, domain, useProxy = false,
      maxRevealsPerProxy = 3, delayMin = 45000, delayMax = 90000,
    } = req.body;

    if (!listings || !Array.isArray(listings) || listings.length === 0) {
      return res.status(400).json({ error: 'listings array is required' });
    }
    if (!domain) return res.status(400).json({ error: 'domain is required' });
    if (activeBatch.running) {
      return res.status(429).json({ error: 'A batch is already running. Stop it first or wait.' });
    }

    const processor = new BatchProcessor(
      useProxy ? proxyManager : null, domainStrategy,
      { useProxy, maxRevealsPerProxy, delayBetweenRevealsMs: [delayMin, delayMax], retryFailedOnce: true }
    );

    activeBatch.processor = processor;
    activeBatch.running = true;

    processor.process(listings, domain).then(result => {
      activeBatch.running = false;
      console.log(`[API] Batch completed: ${result.success}/${result.total}`);
    }).catch(err => {
      activeBatch.running = false;
      console.error(`[API] Batch error: ${err.message}`);
    });

    res.json({ status: 'started', total: listings.length, domain, message: 'Batch processing started. Poll /api/batch/status for progress.' });
  });

  router.get('/batch/status', (req, res) => {
    if (!activeBatch.processor) return res.json({ running: false, message: 'No batch has been started.' });
    res.json(activeBatch.processor.getProgress());
  });

  router.get('/batch/results', (req, res) => {
    if (!activeBatch.processor) return res.json({ results: [] });
    res.json({ results: activeBatch.processor.getResults() });
  });

  router.post('/batch/stop', (req, res) => {
    if (!activeBatch.processor || !activeBatch.running) return res.json({ message: 'No active batch to stop.' });
    activeBatch.processor.stop();
    res.json({ message: 'Stop requested. Batch will finish current reveal and stop.' });
  });

  router.post('/batch/pause', (req, res) => {
    if (!activeBatch.processor || !activeBatch.running) return res.json({ message: 'No active batch to pause.' });
    activeBatch.processor.pause();
    res.json({ message: 'Batch paused.' });
  });

  router.post('/batch/resume', (req, res) => {
    if (!activeBatch.processor) return res.json({ message: 'No batch to resume.' });
    activeBatch.processor.resume();
    res.json({ message: 'Batch resumed.' });
  });

  // Expose state for status endpoint
  router._activeBatch = activeBatch;
  return router;
}
