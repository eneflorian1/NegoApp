/**
 * Diagnostic v2 - Write output to file instead of console (avoids PowerShell encoding)
 * Also tries direct DOM click + evaluate-based click as alternatives
 */
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { writeFileSync } from 'fs';

puppeteer.use(StealthPlugin());

const URL_TARGET = 'https://www.olx.ro/d/oferta/apartament-2-camere-domenii-ion-mihalache-1-mai-bloc-boutique-premium-IDkgYcp.html';
const LOG_FILE = 'diag_output.txt';

const log = [];
function L(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  log.push(line);
  writeFileSync(LOG_FILE, log.join('\n'), 'utf8');
}

async function main() {
  L('=== OLX Phone Reveal Diagnostic v2 ===');
  L('Launching browser (headless: new)...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--window-size=1366,768'],
    defaultViewport: { width: 1366, height: 768 },
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7' });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.chrome = { runtime: {} };
  });

  // Track API calls
  const apiCalls = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('phone') || url.includes('numero') || url.includes('contact')) {
      const entry = { status: response.status(), url: url.substring(0, 200) };
      try { entry.body = (await response.text()).substring(0, 500); } catch (e) { entry.body = 'unreadable'; }
      apiCalls.push(entry);
      L(`API INTERCEPTED: ${entry.status} ${entry.url}`);
    }
  });

  L(`Navigating to: ${URL_TARGET}`);
  await page.goto(URL_TARGET, { waitUntil: 'networkidle2', timeout: 30000 });
  L('Page loaded (networkidle2)');

  // Close popups
  for (const sel of ['._close', '#onetrust-accept-btn-handler', '[id*="accept"]']) {
    try {
      const el = await page.$(sel);
      if (el) { await el.click(); L(`Closed popup: ${sel}`); await new Promise(r => setTimeout(r, 1000)); }
    } catch (e) {}
  }

  // List ALL data-testid buttons
  const allTestIds = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-testid]')).map(el => ({
      tag: el.tagName,
      testid: el.dataset.testid,
      text: el.textContent.trim().substring(0, 80),
      visible: el.getBoundingClientRect().width > 0,
    }));
  });
  L(`All data-testid elements (${allTestIds.length}):`);
  for (const t of allTestIds) {
    L(`  ${t.tag} [${t.testid}] visible=${t.visible} text="${t.text}"`);
  }

  // Find phone button specifically
  const btnExists = await page.$('button[data-testid="show-phone"]');
  if (!btnExists) {
    L('ERROR: button[data-testid="show-phone"] NOT FOUND in DOM');
    
    // Try alternative selectors
    for (const alt of ['[data-testid*="phone"]', '[data-testid*="call"]', '[data-testid*="suna"]']) {
      const found = await page.$(alt);
      L(`  Alternative ${alt}: ${found ? 'FOUND' : 'not found'}`);
    }

    // Search by text
    const phoneButtons = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      return Array.from(btns).filter(b => {
        const t = b.textContent.toLowerCase();
        return t.includes('suna') || t.includes('phone') || t.includes('telefon') || t.includes('apel');
      }).map(b => ({ text: b.textContent.trim().substring(0, 80), html: b.outerHTML.substring(0, 200) }));
    });
    L(`Phone-related buttons by text: ${JSON.stringify(phoneButtons)}`);
    
    await page.screenshot({ path: 'diag_v2_no_button.png', fullPage: true });
    L('Full page screenshot saved: diag_v2_no_button.png');
    await browser.close();
    return;
  }

  // Button found - get details
  const btnDetails = await btnExists.evaluate(el => ({
    outerHTML: el.outerHTML,
    rect: el.getBoundingClientRect(),
    visible: el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0,
    disabled: el.disabled,
    classes: el.className,
  }));
  L(`Button FOUND:`);
  L(`  HTML: ${btnDetails.outerHTML.substring(0, 300)}`);
  L(`  Rect: ${JSON.stringify(btnDetails.rect)}`);
  L(`  Visible: ${btnDetails.visible}, Disabled: ${btnDetails.disabled}`);

  await page.screenshot({ path: 'diag_v2_before_click.png' });
  L('Screenshot before click saved');

  // Scroll to button
  await page.evaluate(() => {
    const btn = document.querySelector('button[data-testid="show-phone"]');
    if (btn) btn.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await new Promise(r => setTimeout(r, 500));

  // METHOD 1: page.evaluate click (direct DOM event)
  L('--- Attempting METHOD 1: evaluate-based click ---');
  await page.evaluate(() => {
    const btn = document.querySelector('button[data-testid="show-phone"]');
    if (btn) btn.click();
  });
  
  await new Promise(r => setTimeout(r, 3000));

  // Check for phone after click
  const afterClick1 = await page.evaluate(() => {
    const btn = document.querySelector('button[data-testid="show-phone"]');
    const telLinks = document.querySelectorAll('a[href^="tel:"]');
    return {
      buttonHTML: btn ? btn.innerHTML.substring(0, 300) : 'GONE',
      telLinks: Array.from(telLinks).map(a => ({ href: a.href, text: a.textContent })),
      pageTitle: document.title,
    };
  });
  L(`After click (method 1):`);
  L(`  Button innerHTML: ${afterClick1.buttonHTML}`);
  L(`  Tel links: ${JSON.stringify(afterClick1.telLinks)}`);
  L(`  API calls intercepted: ${apiCalls.length}`);
  for (const call of apiCalls) {
    L(`    ${call.status} ${call.url}`);
    L(`    Body: ${call.body}`);
  }

  await page.screenshot({ path: 'diag_v2_after_click.png' });
  L('Screenshot after click saved');

  // If method 1 didn't work, try method 2: Puppeteer native click
  if (afterClick1.telLinks.length === 0) {
    L('--- Method 1 failed, trying METHOD 2: Puppeteer native click ---');
    // Reload page
    await page.goto(URL_TARGET, { waitUntil: 'networkidle2', timeout: 30000 });
    for (const sel of ['._close', '#onetrust-accept-btn-handler']) {
      try { const el = await page.$(sel); if (el) await el.click(); } catch (e) {}
    }
    await new Promise(r => setTimeout(r, 2000));
    
    const btn2 = await page.$('button[data-testid="show-phone"]');
    if (btn2) {
      await btn2.scrollIntoView();
      await btn2.click();
      await new Promise(r => setTimeout(r, 3000));

      const afterClick2 = await page.evaluate(() => {
        const telLinks = document.querySelectorAll('a[href^="tel:"]');
        const btn = document.querySelector('button[data-testid="show-phone"]');
        return {
          buttonHTML: btn ? btn.innerHTML.substring(0, 300) : 'GONE',
          telLinks: Array.from(telLinks).map(a => ({ href: a.href, text: a.textContent })),
        };
      });
      L(`After click (method 2):`);
      L(`  Button innerHTML: ${afterClick2.buttonHTML}`);
      L(`  Tel links: ${JSON.stringify(afterClick2.telLinks)}`);
      
      await page.screenshot({ path: 'diag_v2_method2.png' });
    }
  }

  L(`=== DONE ===`);
  L(`Total API calls intercepted: ${apiCalls.length}`);
  
  await browser.close();
}

main().catch(e => {
  L(`FATAL: ${e.message}\n${e.stack}`);
});
