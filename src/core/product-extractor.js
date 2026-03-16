/**
 * ProductExtractor - Extracts and normalizes product data from marketplace listings
 * 
 * Uses the SiteProfile from SiteAnalyzer to know which selectors to use,
 * then extracts structured product data from listing pages.
 */

class ProductExtractor {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Extract products from a search results page
   * @param {string} pageHtml - Raw HTML of the listing page
   * @param {SiteProfile} siteProfile - Site structure profile from SiteAnalyzer
   * @returns {Product[]} Array of normalized product objects
   */
  async extractProducts(pageHtml, siteProfile) {
    const { selectors } = siteProfile;

    // Use AI to extract products when selectors fail or for complex pages
    const products = await this.apiClient.analyze({
      task: 'product_extraction',
      prompt: `Extract all product listings from this HTML page.
        Known selectors: ${JSON.stringify(selectors)}
        For each product, extract:
        - title, price (numeric), currency, url, imageUrl
        - sellerName, sellerUrl, sellerRating
        - location, condition, postDate
        - description (if visible in listing)
        - contactMethod (phone, email, chat link, whatsapp)
        Return as JSON array.`,
      content: pageHtml,
    });

    return products.map(p => this._normalizeProduct(p, siteProfile.domain));
  }

  /**
   * Extract detailed info from a single product page
   * @param {string} productUrl - URL of the product detail page
   * @param {SiteProfile} siteProfile - Site structure profile
   * @returns {ProductDetail} Full product details
   */
  async extractProductDetail(productUrl, siteProfile) {
    const html = await this.apiClient.fetchPage(productUrl);

    const detail = await this.apiClient.analyze({
      task: 'product_detail_extraction',
      prompt: `Extract complete product details from this listing page on ${siteProfile.domain}:
        - Full title and description
        - Price (current, original if discounted)
        - All images
        - Seller info (name, rating, member since, response rate)
        - Contact options (phone, email, chat, whatsapp number)
        - Location (city, region)
        - Product attributes (condition, brand, model, year, etc.)
        - Similar/related products
        - Price negotiability indicators (e.g., "price negotiable", "or best offer")
        Return as structured JSON.`,
      content: html,
    });

    return {
      ...detail,
      sourceUrl: productUrl,
      domain: siteProfile.domain,
      extractedAt: Date.now(),
      negotiabilityScore: this._assessNegotiability(detail),
    };
  }

  /**
   * Search for products across a marketplace
   * @param {SiteProfile} siteProfile - Site profile with search capability info
   * @param {SearchCriteria} criteria - What to search for
   * @returns {Product[]} Matching products
   */
  async searchProducts(siteProfile, criteria) {
    const { searchCapability } = siteProfile;
    const searchUrl = this._buildSearchUrl(siteProfile, criteria);

    const html = await this.apiClient.fetchPage(searchUrl);
    const products = await this.extractProducts(html, siteProfile);

    // Filter by criteria that the site search might not handle
    return products.filter(p => {
      if (criteria.maxPrice && p.price > criteria.maxPrice) return false;
      if (criteria.minPrice && p.price < criteria.minPrice) return false;
      if (criteria.condition && p.condition !== criteria.condition) return false;
      return true;
    });
  }

  /**
   * Assess how negotiable a listing price is
   */
  _assessNegotiability(productDetail) {
    const indicators = {
      high: ['negotiable', 'best offer', 'obo', 'or best offer', 'preț negociabil', 'negociabil'],
      medium: ['reduced', 'sale', 'urgent', 'must sell', 'moving', 'reducere'],
      low: ['firm', 'fixed price', 'no offers', 'preț fix'],
    };

    const text = `${productDetail.title} ${productDetail.description}`.toLowerCase();

    for (const [level, keywords] of Object.entries(indicators)) {
      if (keywords.some(kw => text.includes(kw))) {
        return { level, confidence: 0.8 };
      }
    }

    // Default: most marketplace items are somewhat negotiable
    return { level: 'medium', confidence: 0.5 };
  }

  /**
   * Build a search URL based on site profile and criteria
   */
  _buildSearchUrl(siteProfile, criteria) {
    const base = `https://${siteProfile.domain}`;
    const search = siteProfile.searchCapability;

    const params = new URLSearchParams();
    params.set(search.queryParam || 'q', criteria.query);

    if (criteria.maxPrice && search.filters.includes('price_max')) {
      params.set('price_max', criteria.maxPrice);
    }
    if (criteria.minPrice && search.filters.includes('price_min')) {
      params.set('price_min', criteria.minPrice);
    }
    if (criteria.category) {
      params.set('category', criteria.category);
    }
    if (criteria.location) {
      params.set('location', criteria.location);
    }

    return `${search.searchUrl || base + '/search'}?${params.toString()}`;
  }

  /**
   * Normalize product data to a consistent format
   */
  _normalizeProduct(rawProduct, domain) {
    return {
      id: `${domain}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: rawProduct.title?.trim() || 'Unknown',
      price: parseFloat(rawProduct.price) || 0,
      currency: rawProduct.currency || this._guessCurrency(domain),
      url: rawProduct.url,
      imageUrl: rawProduct.imageUrl,
      seller: {
        name: rawProduct.sellerName,
        url: rawProduct.sellerUrl,
        rating: rawProduct.sellerRating,
      },
      location: rawProduct.location,
      condition: rawProduct.condition,
      postDate: rawProduct.postDate,
      domain,
      extractedAt: Date.now(),
    };
  }

  _guessCurrency(domain) {
    const currencyMap = {
      'olx.ro': 'RON',
      'craigslist.org': 'USD',
      'ebay.com': 'USD',
      'leboncoin.fr': 'EUR',
      'gumtree.com': 'GBP',
    };
    return currencyMap[domain] || 'USD';
  }
}

export default ProductExtractor;
