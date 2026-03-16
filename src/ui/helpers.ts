import { Lead } from './types';

export const getStatusStyle = (status: Lead['status']) => {
  switch (status) {
    case 'new':
      return 'bg-zinc-700 text-zinc-300 border border-zinc-600';
    case 'contacted':
      return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    case 'negotiating':
      return 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] border border-indigo-400/50';
    case 'accepted':
      return 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.5)] border border-emerald-400/50 animate-pulse';
    case 'closed':
      return 'bg-zinc-800 text-zinc-400 border border-zinc-700';
    case 'autosend':
      return 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]';
    default:
      return 'bg-zinc-500 text-white';
  }
};

export const parsePrice = (priceStr: string) => {
  const match = priceStr.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

export function formatPhone(phone: string) {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10 && clean.startsWith('0')) {
    return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`;
  }
  return phone;
}
