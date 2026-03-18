/**
 * GeminiClient — Lightweight Gemini API integration
 *
 * API key is loaded dynamically from config (Settings UI).
 * Falls back to GEMINI_API_KEY from .env if config key not set.
 */

import 'dotenv/config';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';

class GeminiClient {
  constructor() {
    this._apiKey = process.env.GEMINI_API_KEY || null;
    this._getConfigKey = null; // will be set by server.js
  }

  /**
   * Set a callback to dynamically read the API key from config
   */
  setConfigKeyProvider(fn) {
    this._getConfigKey = fn;
  }

  /** Get the current API key (config takes priority over .env) */
  _getKey() {
    if (this._getConfigKey) {
      const configKey = this._getConfigKey();
      if (configKey && configKey.length > 5) return configKey;
    }
    return this._apiKey;
  }

  get isAvailable() {
    return !!this._getKey();
  }

  /**
   * Return a scoped client that uses a specific API key (for per-user isolation).
   * The returned object inherits all methods but overrides key resolution.
   */
  forKey(keyOrFn) {
    const wrapper = Object.create(this);
    if (typeof keyOrFn === 'function') {
      wrapper._getKey = () => {
        const k = keyOrFn();
        return (k && k.length > 5) ? k : this._getKey();
      };
    } else {
      wrapper._getKey = () => (keyOrFn && keyOrFn.length > 5) ? keyOrFn : this._getKey();
    }
    return wrapper;
  }

  /**
   * Send a prompt to Gemini and get a response
   */
  async generate(prompt, options = {}) {
    const apiKey = options.apiKey || this._getKey();
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Set it in Settings.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * Analyze a marketplace listing and extract structured context
   */
  async analyzeListing(listingData) {
    const personalityPrompt = {
      shark: 'Negotiation style: SHARK. Aggressive, low-ball offers, focus on flaws.',
      diplomat: 'Negotiation style: DIPLOMAT. Balanced, friendly, focus on trust and fair deal.',
      ghost: 'Negotiation style: GHOST. Cold, minimal talk, take-it-or-leave-it.',
    }[listingData.personality] || 'Balanced negotiation style.';

    const prompt = `Analyze this marketplace listing and provide a JSON response with:
- marketValue: estimated market value (number)
- dealQuality: "great", "fair", or "poor"
- negotiationTip: one-sentence tip for negotiation (${personalityPrompt})
- category: product category
- keyFeatures: array of key features extracted from the listing

Listing data:
${JSON.stringify(listingData, null, 2)}

Respond ONLY with valid JSON, no markdown.`;

    const text = await this.generate(prompt, { temperature: 0.3 });

    try {
      return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch {
      console.warn('[Gemini] Failed to parse JSON response, returning raw text');
      return { raw: text };
    }
  }

  /**
   * Analyze a page DOM to discover extraction selectors
   */
  async analyzePageStructure(html, domain) {
    const prompt = `You are analyzing a marketplace website (${domain}) to discover how to extract product data.

Analyze this HTML and return a JSON object with:
- listingSelectors: { title, price, description, sellerName, location } (CSS selectors)
- phoneReveal: { buttonSelector, resultSelector, approach } (how to reveal phone numbers)
- categorySelectors: { listingCard, listingLink, nextPage } (for category pages)
- contactMethods: array of available contact methods

HTML (truncated):
${html.substring(0, 15000)}

Respond ONLY with valid JSON, no markdown.`;

    const text = await this.generate(prompt, { temperature: 0.2, maxTokens: 4096 });

    try {
      return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch {
      console.warn('[Gemini] Failed to parse page analysis response');
      return null;
    }
  }
}

export default GeminiClient;
