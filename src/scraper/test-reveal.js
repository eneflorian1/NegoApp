/**
 * Quick JSON result test - outputs phone number clearly
 */
import ProxyManager from './proxy-manager.js';
import PhoneRevealer from './phone-revealer.js';
import { writeFileSync } from 'fs';

async function main() {
  const noProxy = process.argv.includes('--no-proxy');
  const url = process.argv.find(a => a.startsWith('http')) ||
    'https://www.olx.ro/d/oferta/apartament-2-camere-domenii-ion-mihalache-1-mai-bloc-boutique-premium-IDkgYcp.html';

  let proxyManager = null;
  if (!noProxy) {
    proxyManager = ProxyManager.fromVPS('206.189.10.234', 10001, 16);
  }

  const revealer = new PhoneRevealer(proxyManager);
  const result = await revealer.revealPhone(url, { debugScreenshot: true });

  // Write full result to file
  writeFileSync('reveal_result.json', JSON.stringify(result, null, 2), 'utf8');
  
  // Also write clean summary
  const summary = `
=== REVEAL RESULT ===
Success: ${result.success}
Phone:   ${result.phone || 'N/A'}
Title:   ${result.listing?.title || 'N/A'}
Price:   ${result.listing?.price || 'N/A'}
Seller:  ${result.listing?.sellerName || 'N/A'}
Proxy:   ${result.proxy}
Time:    ${result.timing?.totalMs}ms
Error:   ${result.error || 'none'}
`;
  console.log(summary);
  writeFileSync('reveal_summary.txt', summary, 'utf8');
}

main().catch(e => console.error('Fatal:', e));
