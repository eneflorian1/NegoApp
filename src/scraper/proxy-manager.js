/**
 * ProxyManager - Rotates through IPv6 proxies via 3proxy
 * 
 * Manages a pool of proxy endpoints, each bound to a different IPv6 address.
 * Tracks usage per proxy to distribute load and avoid detection.
 */

class ProxyManager {
  constructor(proxies = []) {
    this.proxies = proxies.map((p, i) => ({
      ...p,
      id: i,
      usageCount: 0,
      lastUsed: null,
      blocked: false,
    }));
    this.currentIndex = 0;
  }

  /**
   * Build proxy list from VPS config
   * @param {string} host - VPS IPv4 address (e.g., "206.189.10.234")
   * @param {number} startPort - First proxy port
   * @param {number} count - Number of proxies
   * @returns {ProxyManager}
   */
  static fromVPS(host, startPort, count) {
    const proxies = [];
    for (let i = 0; i < count; i++) {
      proxies.push({
        host,
        port: startPort + i,
        protocol: 'http',
        url: `http://${host}:${startPort + i}`,
      });
    }
    return new ProxyManager(proxies);
  }

  /**
   * Get next available proxy (round-robin with cooldown)
   */
  getNext() {
    const available = this.proxies.filter(p => !p.blocked);
    if (available.length === 0) {
      throw new Error('All proxies are blocked. Wait for cooldown.');
    }

    // Find the least recently used proxy
    available.sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));
    const proxy = available[0];

    proxy.usageCount++;
    proxy.lastUsed = Date.now();

    return proxy;
  }

  /**
   * Get a specific proxy by index
   */
  getByIndex(index) {
    return this.proxies[index];
  }

  /**
   * Get a random proxy
   */
  getRandom() {
    const available = this.proxies.filter(p => !p.blocked);
    if (available.length === 0) {
      throw new Error('All proxies are blocked.');
    }
    const idx = Math.floor(Math.random() * available.length);
    const proxy = available[idx];
    proxy.usageCount++;
    proxy.lastUsed = Date.now();
    return proxy;
  }

  /**
   * Mark a proxy as blocked (e.g., after getting banned)
   */
  markBlocked(proxyId, cooldownMs = 3600000) {
    const proxy = this.proxies.find(p => p.id === proxyId);
    if (proxy) {
      proxy.blocked = true;
      setTimeout(() => { proxy.blocked = false; }, cooldownMs);
    }
  }

  /**
   * Get stats for all proxies
   */
  getStats() {
    return this.proxies.map(p => ({
      id: p.id,
      url: p.url,
      usageCount: p.usageCount,
      lastUsed: p.lastUsed ? new Date(p.lastUsed).toISOString() : 'never',
      blocked: p.blocked,
    }));
  }

  /**
   * Number of available proxies
   */
  get availableCount() {
    return this.proxies.filter(p => !p.blocked).length;
  }

  get totalCount() {
    return this.proxies.length;
  }
}

export default ProxyManager;
