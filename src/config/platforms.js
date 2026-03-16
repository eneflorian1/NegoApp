/**
 * Platform Configurations
 * 
 * Pre-configured profiles for known marketplace platforms.
 * These serve as hints to the SiteAnalyzer, accelerating the analysis process.
 */

export const PLATFORMS = {
  'olx.ro': {
    name: 'OLX Romania',
    baseUrl: 'https://www.olx.ro',
    language: 'ro',
    currency: 'RON',
    country: 'RO',
    searchUrl: 'https://www.olx.ro/oferte/',
    searchParams: { q: 'query' },
    categories: [
      'electronice-si-electrocasnice', 'auto-masini', 'imobiliare',
      'moda-si-frumusete', 'casa-si-gradina', 'sport-hobby',
    ],
    contactMethods: ['in_app_chat', 'phone_reveal'],
    selectors: {
      listingCard: '[data-cy="l-card"]',
      title: '[data-cy="l-card"] h6',
      price: '[data-testid="ad-price"]',
      location: '[data-testid="location-date"]',
    },
    pagination: { type: 'page_number', param: 'page' },
    rateLimit: { requestsPerMinute: 20, delayMs: 3000 },
  },

  'craigslist.org': {
    name: 'Craigslist',
    baseUrl: 'https://www.craigslist.org',
    language: 'en',
    currency: 'USD',
    country: 'US',
    searchUrl: 'https://{city}.craigslist.org/search/',
    searchParams: { query: 'query' },
    categories: [
      'sss', 'cta', 'rea', 'jjj', 'ggg', 'hhh',
    ],
    contactMethods: ['email_relay'],
    selectors: {
      listingCard: '.cl-search-result',
      title: '.posting-title .label',
      price: '.priceinfo',
      location: '.meta .separator ~ span',
    },
    pagination: { type: 'offset', param: 's', step: 120 },
    rateLimit: { requestsPerMinute: 10, delayMs: 6000 },
    notes: 'City-specific subdomains required. Contact via anonymized email relay.',
  },

  'facebook.com/marketplace': {
    name: 'Facebook Marketplace',
    baseUrl: 'https://www.facebook.com/marketplace',
    language: 'multi',
    currency: 'multi',
    country: 'multi',
    searchUrl: 'https://www.facebook.com/marketplace/search/',
    contactMethods: ['messenger'],
    selectors: {},
    pagination: { type: 'infinite_scroll' },
    rateLimit: { requestsPerMinute: 5, delayMs: 12000 },
    notes: 'Requires Facebook authentication. Heavy anti-scraping measures.',
  },

  'autovit.ro': {
    name: 'Autovit Romania',
    baseUrl: 'https://www.autovit.ro',
    language: 'ro',
    currency: 'EUR',
    country: 'RO',
    searchUrl: 'https://www.autovit.ro/autoturisme',
    contactMethods: ['in_app_chat', 'phone_reveal'],
    categories: ['autoturisme', 'autoutilitare', 'motociclete', 'piese'],
    pagination: { type: 'page_number', param: 'page' },
    rateLimit: { requestsPerMinute: 15, delayMs: 4000 },
  },

  'ebay.com': {
    name: 'eBay',
    baseUrl: 'https://www.ebay.com',
    language: 'en',
    currency: 'USD',
    country: 'US',
    searchUrl: 'https://www.ebay.com/sch/i.html',
    searchParams: { _nkw: 'query' },
    contactMethods: ['ebay_messaging'],
    selectors: {
      listingCard: '.s-item',
      title: '.s-item__title',
      price: '.s-item__price',
      location: '.s-item__location',
    },
    pagination: { type: 'page_number', param: '_pgn' },
    rateLimit: { requestsPerMinute: 20, delayMs: 3000 },
    notes: 'Best Offer feature for direct negotiation on eligible listings.',
  },
};

export const NEGOTIATION_PRESETS = {
  conservative: {
    label: 'Conservative',
    description: 'Gentle negotiation, smaller discounts, maintain good relationship',
    openingDiscount: 0.10, // 10% below asking
    targetDiscount: 0.08,
    maxRounds: 3,
  },
  moderate: {
    label: 'Moderate',
    description: 'Balanced approach, fair offers, willing to meet halfway',
    openingDiscount: 0.20,
    targetDiscount: 0.15,
    maxRounds: 4,
  },
  aggressive: {
    label: 'Aggressive',
    description: 'Bold opening offers, persistent negotiation, max savings',
    openingDiscount: 0.35,
    targetDiscount: 0.25,
    maxRounds: 6,
  },
};

export const SUPPORTED_CURRENCIES = {
  RON: { symbol: 'lei', locale: 'ro-RO' },
  USD: { symbol: '$', locale: 'en-US' },
  EUR: { symbol: '€', locale: 'de-DE' },
  GBP: { symbol: '£', locale: 'en-GB' },
};
