/**
 * Reveal Routes — /api/reveal
 */
import { Router } from 'express';
import PhoneRevealer from '../scraper/phone-revealer.js';

export default function createRevealRoutes({ proxyManager, domainStrategy }) {
  const router = Router();
  const activeReveal = { running: false, result: null };

  router.post('/reveal', async (req, res) => {
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

  // Expose state for status endpoint
  router._activeReveal = activeReveal;
  return router;
}
