/**
 * Phone utility functions — extracted from server.js
 */
import LeadRepo from '../db/models/Lead.js';

/** Strip WhatsApp suffixes and extract clean phone number */
export function stripWhatsAppId(waId) {
  if (!waId) return '';
  return waId.replace(/@.*$/, '');
}

/** Normalize phone to digits-only for matching */
export function normalizePhone(phone) {
  if (!phone) return '';
  const digits = stripWhatsAppId(phone).replace(/[^0-9]/g, '');
  // Normalize Romanian prefix: 40xxx -> 0xxx
  return digits.replace(/^40(\d{9})$/, '0$1');
}

/** Format a phone number for display (e.g. 40730535359 -> +40 730 535 359) */
export function formatPhoneDisplay(phone) {
  if (!phone) return 'Contact';
  const digits = phone.replace(/[^0-9]/g, '');
  // Romanian format: 40XXXXXXXXX
  if (digits.length === 11 && digits.startsWith('40')) {
    return `+40 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  // Romanian format: 0XXXXXXXXX
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  // Generic international
  if (digits.length > 8) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return phone;
}

/** Find lead by WhatsApp sender ID */
export function findLeadByPhone(waFrom) {
  if (!waFrom) return null;
  const leads = LeadRepo.getAll();

  // 1. Try exact match by whatsappId (most reliable for existing conversations)
  const byId = leads.find(l => l.whatsappId === waFrom);
  if (byId) return byId;

  // 2. Try normalized phone match
  const normalized = normalizePhone(waFrom);
  if (!normalized) return null;
  return leads.find(l => normalizePhone(l.phoneNumber) === normalized || normalizePhone(l.whatsappId) === normalized);
}

/** Format phone for WhatsApp: ensure country code, add @c.us */
export function phoneToWhatsAppId(phone) {
  let waId = phone.replace(/[^0-9]/g, '');
  if (waId.startsWith('0')) waId = '40' + waId.substring(1); // Romanian prefix
  return waId + '@c.us';
}
