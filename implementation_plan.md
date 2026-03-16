# Phase 2 — Orchestrator + Category Scraping

## Goal

Build an AI-powered orchestrator that can visit **any marketplace site**, learn how to extract phone numbers, save the working strategy, and process entire categories in batch.

## Proposed Changes

### Component 1: Domain Strategy Store

#### [NEW] [domain-strategy.js](file:///c:/Users/Admin/Documents/NegoApp/src/scraper/domain-strategy.js)

Persists working extraction strategies per domain on disk (`data/strategies/`).

```js
// Strategy structure per domain:
{
  domain: "olx.ro",
  version: 1,
  lastUpdated: "2026-03-15",
  successRate: 0.95,
  phoneReveal: {
    approach: "click_button",
    buttonSelector: "button[data-testid='ad-contact-phone']",
    resultSelector: "a[href^='tel:']",
    needsVisibleCheck: true,
    duplicateButtons: true
  },
  listingSelectors: {
    title: "[data-testid='offer_title']",
    price: "[data-testid='ad-price-container']",
    // ...
  },
  categorySelectors: {
    listingCard: "[data-testid='l-card']",
    listingLink: "[data-testid='l-card'] a",
    nextPage: "[data-testid='pagination-forward']"
  },
  rateLimit: { maxRevealsPerSession: 3, delayBetweenMs: 45000 }
}
```

- **`save(domain, strategy)`** — write to `data/strategies/{domain}.json`
- **`load(domain)`** — read from disk, return `null` if not found
- **`updateSuccessRate(domain, success)`** — track stats, invalidate strategy if success rate drops below 50%

---

### Component 2: Site Intelligence (AI DOM Analysis)

#### [NEW] [site-intelligence.js](file:///c:/Users/Admin/Documents/NegoApp/src/scraper/site-intelligence.js)

When no cached strategy exists for a domain, this module uses AI (Gemini) to analyze the live DOM and discover:
- Where are listing cards on category pages?
- Where is the phone reveal button on a listing page?
- What selectors to use for title, price, seller, etc.?
- How does pagination work?

**Flow:**
1. Navigate to listing page with stealth browser
2. Extract page HTML (cleaned — remove scripts, ads, keep structure)
3. Send to Gemini: *"Analyze this marketplace listing page. Find the phone reveal button, listing data selectors, and explain the reveal mechanism."*
4. Parse AI response → build strategy object
5. **Validate strategy** by running a test reveal
6. If it works → save to `DomainStrategy`
7. If it fails → retry with different prompt / manual fallback

**Key design:**
- AI call is only made **once per domain** (then cached)
- Keeps page HTML small (strip `<script>`, `<style>`, ads, SVGs — keep structure + data-testid attributes)
- Gemini API via `@google/generative-ai` package

---

### Component 3: Category Scraper

#### [NEW] [category-scraper.js](file:///c:/Users/Admin/Documents/NegoApp/src/scraper/category-scraper.js)

Extracts all listing URLs from a category page, with pagination.

**Input:** `https://www.olx.ro/imobiliare/apartamente-garsoniere-de-vanzare/`
**Output:** Array of listing URLs + basic listing data (title, price, thumbnail)

**Flow:**
1. Load domain strategy from cache (or discover via SiteIntelligence)
2. Navigate to category URL
3. Extract listing cards using `categorySelectors.listingCard`
4. For each card: extract link, title, price, thumbnail
5. Check for next page → navigate → repeat
6. Configurable: `maxPages`, `maxListings`

**Pagination strategies:**
- Page numbers: `?page=2`, `?page=3`
- Offset: `?s=120`, `?s=240`  
- Load more button: click button, wait for new listings
- Infinite scroll: scroll down, wait for new listings

---

### Component 4: Batch Processor

#### [NEW] [batch-processor.js](file:///c:/Users/Admin/Documents/NegoApp/src/scraper/batch-processor.js)

Processes multiple listings with proxy rotation and rate limiting.

**Input:** Array of listing URLs (from CategoryScraper)
**Output:** Array of reveal results with phone numbers

**Features:**
- Rotates through 16 IPv6 proxies (max 3 reveals per proxy per session)
- Configurable delay between reveals (default: 45-90 seconds)
- Progress tracking: emits events for UI updates
- Resume capability: saves progress to disk, can continue after restart
- Respects platform rate limits from domain strategy

---

### Component 5: Updated Orchestrator

#### [MODIFY] [agent-orchestrator.js](file:///c:/Users/Admin/Documents/NegoApp/src/core/agent-orchestrator.js)

Rewire the orchestrator to use the new components:

```
User: "Caută apartamente 2 camere pe OLX"
  ↓
Orchestrator.startMission()
  ↓
1. DomainStrategy.load("olx.ro") → cached? use it : SiteIntelligence.discover()
  ↓
2. CategoryScraper.scrape("olx.ro/imobiliare/apartamente/", strategy)
   → [url1, url2, ..., url50]
  ↓
3. BatchProcessor.process(urls, { proxyManager, strategy })
   → [{ phone: "072...", listing: {...} }, ...]
  ↓
4. NegotiationEngine.startNegotiation(bestDeals)
```

---

## File Structure After Changes

```
src/scraper/
├── proxy-manager.js        ✅ exists
├── stealth-browser.js      ✅ exists
├── phone-revealer.js       ✅ exists
├── domain-strategy.js      🆕 strategy cache (disk persistence)
├── site-intelligence.js    🆕 AI-powered DOM analysis
├── category-scraper.js     🆕 category listing extraction
└── batch-processor.js      🆕 batch reveal with rate limiting

data/strategies/
├── olx.ro.json             🆕 auto-generated after first successful run
├── autovit.ro.json         🆕 ...
└── craigslist.org.json     🆕 ...
```

---

## Build Order

| Step | Component | Depinde de | Estimate |
|------|-----------|-----------|----------|
| 1 | `domain-strategy.js` | nimic | simplu |
| 2 | `category-scraper.js` | domain-strategy | mediu |
| 3 | `batch-processor.js` | phone-revealer, proxy-manager | mediu |
| 4 | `site-intelligence.js` | domain-strategy, stealth-browser, Gemini API | complex |
| 5 | Rewrite [agent-orchestrator.js](file:///c:/Users/Admin/Documents/NegoApp/src/core/agent-orchestrator.js) | toate de mai sus | mediu |

> [!IMPORTANT]
> Steps 1-3 funcționează fără AI (cu strategii hardcodate pentru OLX). Step 4 adaugă AI discovery. Recomand să facem 1-3 primul, testăm pe OLX, apoi adăugăm AI.

---

## Verification Plan

### Test 1: Category Scraping (automat)
```bash
node src/scraper/test-category.js https://www.olx.ro/imobiliare/apartamente-garsoniere-de-vanzare/ --max-pages=1 --no-proxy
```
**Expected:** JSON cu 40+ listing URLs + titles + prices

### Test 2: Batch Reveal (automat, 3 listings)
```bash
node src/scraper/test-batch.js --max-listings=3 --no-proxy
```
**Expected:** 3 listing results cu phone numbers, ~50s total (16s × 3 + delays)

### Test 3: Domain Strategy Persistence
```bash
# Run reveal → strategy auto-saved
node src/scraper/test-reveal.js --no-proxy
# Check saved strategy
type data\strategies\olx.ro.json
# Run again → should use cached strategy (faster)
node src/scraper/test-reveal.js --no-proxy
```

### Test 4: Full Orchestrator (manual)
```bash
node src/core/test-orchestrator.js --query="apartament 2 camere" --domain=olx.ro --max-listings=5
```
**Expected:** Scans OLX, finds listings, reveals phones, outputs structured results

---

## Decizii necesare

1. **Gemini API key** — ai o cheie pentru `@google/generative-ai`? Fără ea, step 4 (SiteIntelligence) nu poate rula, dar steps 1-3 merg cu strategii hardcodate.
2. **Ordine prioritară** — Facem 1-3 (funcțional pe OLX fără AI) sau direct 1-5 (cu AI)?
