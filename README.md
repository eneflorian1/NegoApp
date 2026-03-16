# NegoApp - Autonomous AI Negotiator Agent

An AI-powered autonomous agent that searches marketplace platforms, finds products, and negotiates prices on your behalf.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  AgentOrchestrator                    │
│  (Main brain - coordinates all components)           │
├──────────┬──────────────┬───────────────┬───────────┤
│          │              │               │           │
│  SiteAnalyzer  ProductExtractor  NegotiationEngine  │
│  - Maps site   - Finds products  - Opens offers     │
│    structure   - Extracts data   - Counter-offers    │
│  - Discovers   - Normalizes      - Knows when to    │
│    categories    listings          walk away         │
│  - Detects     - Scores deals                       │
│    pagination                                       │
├──────────┴──────────────┴───────────────┴───────────┤
│                    Channels                          │
│  ┌─────────────────┐  ┌──────────────────┐         │
│  │ WhatsApp Client │  │  AgentMail Client │         │
│  │ (QR Connect)    │  │  (Email Channel)  │         │
│  └─────────────────┘  └──────────────────┘         │
└─────────────────────────────────────────────────────┘
```

## Core Flow

1. **Mission Creation**: User defines what to buy, budget, and target platforms
2. **Site Analysis**: Agent crawls and understands marketplace structure
3. **Product Search**: Finds matching products across platforms
4. **Evaluation & Shortlisting**: Scores products by price, negotiability, seller rating
5. **Autonomous Negotiation**: Opens conversations, counters offers, closes deals
6. **Notification**: Reports successful negotiations with final prices
7. **Delivery Coordination**: Optionally handles shipping details

## Supported Platforms

| Platform | Status | Contact Method |
|----------|--------|---------------|
| OLX.ro | ✅ Pre-configured | Chat, Phone |
| Craigslist | ✅ Pre-configured | Email Relay |
| eBay | ✅ Pre-configured | Best Offer |
| Autovit.ro | ✅ Pre-configured | Chat, Phone |
| Facebook Marketplace | ⚠️ Limited | Messenger |
| Custom domains | 🔄 Auto-analyzed | Varies |

## Project Structure

```
NegoApp/
├── src/
│   ├── core/
│   │   ├── site-analyzer.js        # Site structure understanding engine
│   │   ├── product-extractor.js    # Product data extraction & normalization
│   │   ├── negotiation-engine.js   # AI-powered price negotiation
│   │   └── agent-orchestrator.js   # Main agent coordination brain
│   ├── channels/
│   │   ├── whatsapp-client.js      # WhatsApp QR connect client
│   │   └── mail-client.js          # AgentMail email client
│   └── config/
│       └── platforms.js            # Platform configurations & presets
├── package.json
└── README.md
```

## Getting Started

```bash
npm install
npm run dev
```

## TODO

- [ ] Backend implementation for WhatsApp QR connect
- [ ] AgentMail server integration
- [ ] Puppeteer-based site crawling
- [ ] Real-time seller response monitoring
- [ ] Multi-language negotiation templates
- [ ] Price history tracking
- [ ] Success rate analytics
