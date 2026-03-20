/**
 * Test: Batch Phone Reveal
 * 
 * Usage:
 *   node src/scraper/test-batch.js [--max-listings=N] [--no-proxy] [--category-url=URL]
 * 
 * Example:
 *   node src/scraper/test-batch.js --max-listings=3 --no-proxy --category-url=https://www.olx.ro/imobiliare/apartamente-garsoniere-de-vanzare/
 * 
 * If --category-url is given, it first scrapes listings then batch-reveals.
 * Otherwise uses hardcoded test URLs.
 */

import CategoryScraper from './category-scraper.js';
import BatchProcessor from './batch-processor.js';
import DomainStrategy from './domain-strategy.js';
import ProxyManager from './proxy-manager.js';

const args = process.argv.slice(2);
const maxListings = parseInt(args.find(a => a.startsWith('--max-listings='))?.split('=')[1] || '3');
const noProxy = args.includes('--no-proxy');
const categoryUrl = args.find(a => a.startsWith('--category-url='))?.split('=').slice(1).join('=');

const domainStrategy = new DomainStrategy();
const proxyManager = noProxy ? null : ProxyManager.fromVPS('206.189.10.234', 10001, 16);

console.log(`\nTest: Batch Phone Reveal`);
console.log(`Max listings: ${maxListings}`);
console.log(`Proxy: ${noProxy ? 'disabled' : 'enabled'}`);
if (categoryUrl) console.log(`Category: ${categoryUrl}`);
console.log();

async function getListings() {
  if (categoryUrl) {
    console.log('Scraping category for listings...\n');
    const scraper = new CategoryScraper({ domainStrategy, proxyManager });
    const all = await scraper.scrape(categoryUrl, {
      maxPages: 1,
      maxListings: maxListings + 5, // Get a few extra in case of dupes
      useProxy: !noProxy,
    });
    return all.slice(0, maxListings);
  }

  // Fallback: use test URLs (you'd replace these with real ones)
  console.log('No category URL provided. Provide --category-url=... to scrape live listings.\n');
  return [];
}

try {
  const listings = await getListings();

  if (listings.length === 0) {
    console.log('No listings to process. Provide --category-url to scrape listings first.');
    process.exit(0);
  }

  console.log(`\nStarting batch reveal for ${listings.length} listings...\n`);

  const processor = new BatchProcessor(
    noProxy ? null : proxyManager,
    domainStrategy,
    {
      useProxy: !noProxy,
      maxRevealsPerProxy: 3,
      delayBetweenRevealsMs: [15000, 25000],
      retryFailedOnce: true,
    }
  );

  // Listen to events
  processor.on('batch:progress', (data) => {
    console.log(`[Progress] ${data.completed}/${data.total} (${data.percentComplete}%) — success: ${data.success}, failed: ${data.failed}`);
  });

  processor.on('batch:waiting', (data) => {
    console.log(`[Waiting] ${(data.delayMs / 1000).toFixed(0)}s until next reveal...`);
  });

  const domain = listings[0]?.domain || 'olx.ro';
  const result = await processor.process(listings, domain);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Batch complete: ${result.success}/${result.total} (${result.successRate}%)`);
  console.log(`Phones found: ${result.phones.length}\n`);

  for (const phone of result.phones) {
    console.log(`  📞 ${phone.phone} — ${phone.title} (${phone.price})`);
    console.log(`     ${phone.url}`);
  }

  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  }
} catch (err) {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
}
