/**
 * NegotiationEngine - AI-powered price negotiation logic
 * 
 * Handles the complete negotiation flow:
 * 1. Analyzes product value and market comparables
 * 2. Determines opening offer strategy
 * 3. Generates negotiation messages
 * 4. Adapts based on seller responses
 * 5. Knows when to accept, counter, or walk away
 */

class NegotiationEngine {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.activeNegotiations = new Map();
  }

  /**
   * Start a new negotiation for a product
   * @param {ProductDetail} product - Full product details
   * @param {NegotiationConfig} config - User's negotiation preferences
   * @returns {Negotiation} Active negotiation session
   */
  async startNegotiation(product, config) {
    // Step 1: Analyze fair market value
    const marketAnalysis = await this._analyzeMarketValue(product);

    // Step 2: Determine negotiation strategy
    const strategy = this._buildStrategy(product, marketAnalysis, config);

    const negotiation = {
      id: `nego-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      product,
      config,
      marketAnalysis,
      strategy,
      status: 'initiated', // initiated, opening_sent, countering, accepted, rejected, walked_away
      messages: [],
      currentOffer: null,
      targetPrice: strategy.targetPrice,
      floorPrice: strategy.absoluteFloor,
      ceilingPrice: product.price,
      rounds: 0,
      maxRounds: config.maxRounds || 5,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.activeNegotiations.set(negotiation.id, negotiation);
    return negotiation;
  }

  /**
   * Generate the opening negotiation message
   */
  async generateOpeningMessage(negotiationId, channel = 'email') {
    const nego = this.activeNegotiations.get(negotiationId);
    if (!nego) throw new Error('Negotiation not found');

    const { strategy, product } = nego;

    const message = await this.apiClient.analyze({
      task: 'generate_negotiation_message',
      prompt: `Generate a natural, friendly opening negotiation message for buying this product:
        Product: ${product.title}
        Listed Price: ${product.price} ${product.currency}
        Our Opening Offer: ${strategy.openingOffer} ${product.currency}
        Channel: ${channel} (adjust tone accordingly)
        Language: ${this._detectLanguage(product)}
        
        Guidelines:
        - Be polite and show genuine interest in the product
        - Mention specific details about the product to show you've read the listing
        - Provide a reasonable justification for the lower offer
        - Don't be aggressive or insulting
        - If the product shows signs of negotiability, reference that
        - Keep it concise for ${channel === 'whatsapp' ? 'WhatsApp' : 'email'}
        
        Return JSON: { subject (if email), body, tone_analysis }`,
      content: JSON.stringify(product),
    });

    nego.messages.push({
      role: 'buyer',
      content: message.body,
      offer: strategy.openingOffer,
      channel,
      timestamp: Date.now(),
    });
    nego.currentOffer = strategy.openingOffer;
    nego.status = 'opening_sent';
    nego.updatedAt = Date.now();

    return message;
  }

  /**
   * Process a seller's response and generate counter-offer or acceptance
   */
  async processSellerResponse(negotiationId, sellerMessage) {
    const nego = this.activeNegotiations.get(negotiationId);
    if (!nego) throw new Error('Negotiation not found');

    // Use AI to understand the seller's response
    const analysis = await this.apiClient.analyze({
      task: 'analyze_seller_response',
      prompt: `Analyze this seller response in a price negotiation:
        Our last offer: ${nego.currentOffer} ${nego.product.currency}
        Listed price: ${nego.product.price} ${nego.product.currency}
        Seller's message: "${sellerMessage}"
        
        Determine:
        1. Did the seller accept, reject, or counter?
        2. If counter, what price did they propose?
        3. Seller's tone (firm, flexible, frustrated, eager)
        4. Any additional conditions mentioned?
        5. Is there room for further negotiation?
        Return structured JSON.`,
      content: sellerMessage,
    });

    nego.messages.push({
      role: 'seller',
      content: sellerMessage,
      offer: analysis.counterPrice || null,
      analysis,
      timestamp: Date.now(),
    });
    nego.rounds++;

    // Determine next action
    return this._determineNextAction(nego, analysis);
  }

  /**
   * Determine the next negotiation action
   */
  _determineNextAction(nego, sellerAnalysis) {
    const { strategy, config } = nego;

    // Seller accepted
    if (sellerAnalysis.decision === 'accepted') {
      nego.status = 'accepted';
      nego.updatedAt = Date.now();
      return {
        action: 'accepted',
        finalPrice: nego.currentOffer,
        savings: nego.product.price - nego.currentOffer,
        savingsPercent: ((nego.product.price - nego.currentOffer) / nego.product.price * 100).toFixed(1),
        nextStep: 'confirm_purchase',
      };
    }

    // Seller countered
    if (sellerAnalysis.counterPrice) {
      const counterPrice = sellerAnalysis.counterPrice;

      // Counter is within our acceptable range
      if (counterPrice <= strategy.targetPrice) {
        nego.status = 'accepted';
        nego.currentOffer = counterPrice;
        nego.updatedAt = Date.now();
        return {
          action: 'accept_counter',
          finalPrice: counterPrice,
          savings: nego.product.price - counterPrice,
          savingsPercent: ((nego.product.price - counterPrice) / nego.product.price * 100).toFixed(1),
          nextStep: 'send_acceptance',
        };
      }

      // Counter is above our absolute ceiling or max rounds reached
      if (counterPrice > strategy.walkAwayPrice || nego.rounds >= nego.maxRounds) {
        nego.status = 'walked_away';
        nego.updatedAt = Date.now();
        return {
          action: 'walk_away',
          reason: nego.rounds >= nego.maxRounds ? 'max_rounds_reached' : 'price_too_high',
          lastSellerPrice: counterPrice,
          ourLastOffer: nego.currentOffer,
        };
      }

      // Counter, but we can still negotiate
      const nextOffer = this._calculateCounterOffer(nego, counterPrice);
      nego.currentOffer = nextOffer;
      nego.status = 'countering';
      nego.updatedAt = Date.now();
      return {
        action: 'counter',
        ourNewOffer: nextOffer,
        sellerAsked: counterPrice,
        needsMessage: true,
      };
    }

    // Seller rejected without counter
    if (sellerAnalysis.decision === 'rejected') {
      if (sellerAnalysis.tone === 'firm') {
        nego.status = 'rejected';
        nego.updatedAt = Date.now();
        return { action: 'rejected', reason: 'seller_firm' };
      }

      // Try once more with a higher offer
      const nextOffer = this._calculateCounterOffer(nego, nego.product.price * 0.9);
      nego.currentOffer = nextOffer;
      return {
        action: 'retry',
        ourNewOffer: nextOffer,
        needsMessage: true,
      };
    }

    return { action: 'unclear', needsHumanReview: true };
  }

  /**
   * Calculate counter-offer based on negotiation dynamics
   */
  _calculateCounterOffer(nego, sellerPrice) {
    const { strategy } = nego;
    const midpoint = (nego.currentOffer + sellerPrice) / 2;

    // Gradually move toward midpoint but never exceed target
    const nextOffer = Math.min(
      midpoint + (strategy.targetPrice - midpoint) * 0.3,
      strategy.targetPrice
    );

    // Round to nice numbers
    return Math.round(nextOffer / 5) * 5;
  }

  /**
   * Analyze market value using comparable listings
   */
  async _analyzeMarketValue(product) {
    return {
      estimatedFairPrice: product.price * 0.85, // Placeholder
      priceRange: {
        low: product.price * 0.7,
        mid: product.price * 0.85,
        high: product.price * 0.95,
      },
      comparables: [],
      demandLevel: 'medium',
      timeOnMarket: null,
      seasonalFactor: 1.0,
    };
  }

  /**
   * Build negotiation strategy based on product analysis and user config
   */
  _buildStrategy(product, marketAnalysis, config) {
    const aggressiveness = config.aggressiveness || 'moderate'; // conservative, moderate, aggressive
    const negotiability = product.negotiabilityScore?.level || 'medium';

    const discountFactors = {
      conservative: { opening: 0.85, target: 0.90, walkAway: 0.95 },
      moderate: { opening: 0.75, target: 0.82, walkAway: 0.90 },
      aggressive: { opening: 0.65, target: 0.75, walkAway: 0.85 },
    };

    const factors = discountFactors[aggressiveness];

    // Adjust based on negotiability
    if (negotiability === 'high') {
      factors.opening *= 0.95;
      factors.target *= 0.95;
    } else if (negotiability === 'low') {
      factors.opening *= 1.05;
      factors.target *= 1.02;
    }

    return {
      openingOffer: Math.round(product.price * factors.opening),
      targetPrice: config.targetPrice || Math.round(product.price * factors.target),
      walkAwayPrice: Math.round(product.price * factors.walkAway),
      absoluteFloor: config.maxBudget || Math.round(product.price * factors.walkAway),
      aggressiveness,
      estimatedRounds: aggressiveness === 'aggressive' ? 4 : 3,
    };
  }

  _detectLanguage(product) {
    if (product.domain.endsWith('.ro')) return 'ro';
    if (product.domain.endsWith('.fr')) return 'fr';
    if (product.domain.endsWith('.de')) return 'de';
    return 'en';
  }
}

export default NegotiationEngine;
