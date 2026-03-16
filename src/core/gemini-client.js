/**
 * GeminiClient — Lightweight Gemini API integration
 * 
 * Uses GEMINI_API_KEY from .env to interact with Google's Gemini API.
 * Provides context understanding for the orchestrator:
 * - Analyze listing data
 * - Understand page structure
 * - Make negotiation decisions
 */

import 'dotenv/config';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

class GeminiClient {
  constructor() {
    if (!GEMINI_API_KEY) {
      console.warn('[Gemini] No GEMINI_API_KEY found in .env — AI features disabled');
    }
  }

  get isAvailable() {
    return !!GEMINI_API_KEY;
  }

  /**
   * Send a prompt to Gemini and get a response
   * @param {string} prompt - The instruction/question
   * @param {object} options - { temperature, maxTokens }
   * @returns {string} Text response from Gemini
   */
  async generate(prompt, options = {}) {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
      },
    };

    const res = await fetch(GEMINI_URL, {
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
   * @param {object} listingData - { title, price, description, sellerName, ... }
   * @returns {object} Structured analysis
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
   * @param {string} html - Cleaned HTML of the page
   * @param {string} domain - The domain being analyzed
   * @returns {object} Discovered strategy
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
