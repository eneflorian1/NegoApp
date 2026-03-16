/**
 * Test: Category Scraping
 * 
 * Usage:
 *   node src/scraper/test-category.js <category-url> [--max-pages=N] [--no-proxy]
 * 
 * Example:
 *   node src/scraper/test-category.js https://www.olx.ro/imobiliare/apartamente-garsoniere-de-vanzare/ --max-pages=1 --no-proxy
 */

import CategoryScraper from './category-scraper.js';
import DomainStrategy from './domain-strategy.js';
import ProxyManager from './proxy-manager.js';

const args = process.argv.slice(2);
const url = args.find(a => a.startsWith('http'));
const maxPages = parseInt(args.find(a => a.startsWith('--max-pages='))?.split('=')[1] || '1');
const noProxy = args.includes('--no-proxy');

if (!url) {
  console.error('Usage: node test-category.js <category-url> [--max-pages=N] [--no-proxy]');
  console.error('Example: node test-category.js https://www.olx.ro/imobiliare/ --max-pages=1');
  process.exit(1);
}

const domainStrategy = new DomainStrategy();
const proxyManager = noProxy ? null : ProxyManager.fromVPS('206.189.10.234', 10001, 16);

const scraper = new CategoryScraper({
  domainStrategy,
  proxyManager,
});

console.log(`\nTest: Category Scraping`);
console.log(`URL: ${url}`);
console.log(`Max pages: ${maxPages}`);
console.log(`Proxy: ${noProxy ? 'disabled' : 'enabled'}\n`);

try {
  const listings = await scraper.scrape(url, {
    maxPages,
    maxListings: 100,
    useProxy: !noProxy,
    headless: true,
  });

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Results: ${listings.length} listings found\n`);

  for (const [i, listing] of listings.entries()) {
    console.log(`${i + 1}. ${listing.title}`);
    console.log(`   Price: ${listing.price}`);
    console.log(`   Location: ${listing.location}`);
    console.log(`   URL: ${listing.url}`);
    if (listing.isPromoted) console.log(`   [PROMOTED]`);
    console.log();
  }

  // Output as JSON for piping
  if (args.includes('--json')) {
    console.log(JSON.stringify(listings, null, 2));
  }
} catch (err) {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
}
