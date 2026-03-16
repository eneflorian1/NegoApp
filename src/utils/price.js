/**
 * Price utility functions — extracted from server.js
 */

/** Sanitize price text — strip extra labels like "Prețul e negociabil" */
export function sanitizePrice(raw) {
  if (!raw) return raw;
  const match = raw.match(/^([\d][\d\s.,]*\s*(?:€|lei|RON|EUR|USD|\$|£))/i);
  if (match) return match[1].trim();
  const match2 = raw.match(/^((?:€|lei|RON|EUR|USD|\$|£)\s*[\d][\d\s.,]*)/i);
  if (match2) return match2[1].trim();
  const match3 = raw.match(/^([\d][\d\s.,]*)/);
  if (match3 && match3[1].trim().length >= 2) return match3[1].trim();
  return raw;
}

/** Sanitize corrupt prices in a lead object. Returns number of fields fixed. */
export function sanitizeLeadPrices(lead) {
  let fixed = 0;
  for (const field of ['initialPrice', 'price', 'finalPrice']) {
    if (lead[field]) {
      const match = lead[field].match(/^([\d][\d\s.,]*\s*(?:€|lei|RON|EUR|USD|\$|£))/i);
      if (match && match[1].trim() !== lead[field]) {
        lead[field] = match[1].trim();
        fixed++;
      }
    }
  }
  return fixed;
}
