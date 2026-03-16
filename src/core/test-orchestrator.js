/**
 * Test: Full Orchestrator Pipeline
 * 
 * Usage:
 *   node src/core/test-orchestrator.js --url=<category-url> [--domain=olx.ro] [--max-listings=5] [--no-proxy]
 * 
 * Example:
 *   node src/core/test-orchestrator.js --url=https://www.olx.ro/imobiliare/apartamente-garsoniere-de-vanzare/ --domain=olx.ro --max-listings=5 --no-proxy
 */

import AgentOrchestrator from './agent-orchestrator.js';
import ProxyManager from '../scraper/proxy-manager.js';
import GeminiClient from './gemini-client.js';

const args = process.argv.slice(2);
const url = args.find(a => a.startsWith('--url='))?.split('=').slice(1).join('=');
const domain = args.find(a => a.startsWith('--domain='))?.split('=')[1];
const maxListings = parseInt(args.find(a => a.startsWith('--max-listings='))?.split('=')[1] || '5');
const maxReveals = parseInt(args.find(a => a.startsWith('--max-reveals='))?.split('=')[1] || '3');
const noProxy = args.includes('--no-proxy');

if (!url) {
  console.error('Usage: node test-orchestrator.js --url=<category-url> [--domain=olx.ro] [--max-listings=5] [--no-proxy]');
  process.exit(1);
}

const proxyManager = noProxy ? null : ProxyManager.fromVPS('206.189.10.234', 10001, 16);
const gemini = new GeminiClient();

const orchestrator = new AgentOrchestrator({
  proxyManager,
  geminiClient: gemini,
});

// Listen to mission events
orchestrator.on('mission:step', ({ missionId, step }) => {
  console.log(`  [${step.phase}] ${step.message}`);
});

orchestrator.on('mission:completed', (mission) => {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Mission completed: ${mission.id}`);
  console.log(`Listings found: ${mission.listings?.length || 0}`);
  console.log(`Phones revealed: ${mission.phones?.length || 0}`);
  console.log();
  
  if (mission.phones?.length > 0) {
    console.log('Phones:');
    for (const p of mission.phones) {
      console.log(`  📞 ${p.phone} — ${p.title} (${p.price})`);
    }
  }

  if (mission.summary) {
    console.log(`\nSummary:`, JSON.stringify(mission.summary, null, 2));
  }
});

orchestrator.on('mission:error', (mission) => {
  console.error(`\nMission failed: ${mission.error}`);
});

console.log(`\nTest: Full Orchestrator Pipeline`);
console.log(`URL: ${url}`);
console.log(`Domain: ${domain || 'auto-detect'}`);
console.log(`Max listings: ${maxListings}`);
console.log(`Max reveals: ${maxReveals}`);
console.log(`Proxy: ${noProxy ? 'disabled' : 'enabled'}`);
console.log(`Gemini: ${gemini.isAvailable ? 'available' : 'disabled'}`);
console.log();

try {
  const mission = await orchestrator.executeMission({
    url,
    domain,
    useProxy: !noProxy,
    maxPages: 2,
    maxListings,
    maxReveals,
  });

  console.log(`\nDone. Status: ${mission.status}`);
} catch (err) {
  console.error(`\nFatal error: ${err.message}`);
  process.exit(1);
}
