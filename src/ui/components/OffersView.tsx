import React, { useState, useMemo } from 'react';
import {
  Search,
  ExternalLink,
  Phone,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  Clock,
  MessageSquare,
  Send,
  Bot,
  BotOff,
  AlertTriangle,
  Filter,
  ArrowDownUp,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Lead } from '../types';
import { getStatusStyle, formatPhone } from '../helpers';

type FilterStatus = 'all' | 'negotiating' | 'accepted' | 'autosend' | 'lost';
type SortKey = 'date' | 'reduction' | 'status';

/** Leads that qualify as "offers" — anything beyond initial `new` status */
const OFFER_STATUSES = new Set(['contacted', 'negotiating', 'accepted', 'autosend', 'closed']);

const LOST_CONTACT_MS = 48 * 60 * 60 * 1000; // 48 hours

function isLostContact(lead: Lead): boolean {
  if (!lead.lastContacted) return false;
  return Date.now() - new Date(lead.lastContacted).getTime() > LOST_CONTACT_MS
    && lead.status !== 'accepted' && lead.status !== 'autosend';
}

function parsePriceNum(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[^\d]/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
}

function calcReduction(lead: Lead): { percent: number; absolute: number; currency: string } | null {
  const initial = parsePriceNum(lead.initialPrice);
  const current = parsePriceNum(lead.finalPrice || lead.price);
  if (!initial || !current || current >= initial) return null;
  const currency = lead.initialPrice?.includes('€') ? '€' : 'lei';
  return {
    percent: Math.round(((initial - current) / initial) * 100),
    absolute: initial - current,
    currency,
  };
}

const statusPriority: Record<string, number> = {
  autosend: 0,
  accepted: 1,
  negotiating: 2,
  contacted: 3,
  closed: 4,
};

export default function OffersView({ leads, deleteLeads }: { leads: Lead[], deleteLeads: (ids: string[]) => void }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [sort, setSort] = useState<SortKey>('date');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelection(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function toggleAll() {
    // Note: offers is the filtered array
    if (selectedIds.size === Math.min(counts.all, offers.length) && offers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(offers.map(l => l.id)));
    }
  }

  async function deleteSelectedOffers() {
    if (!selectedIds.size) return;
    if (!confirm(`Sigur vrei să ștergi ${selectedIds.size} ${selectedIds.size === 1 ? 'ofertă selectată' : 'oferte selectate'}?`)) return;
    
    await deleteLeads(Array.from(selectedIds));
    setSelectedIds(new Set());
  }

  const offers = useMemo(() => {
    let filtered = leads.filter(l => OFFER_STATUSES.has(l.status));

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(l =>
        l.sellerName?.toLowerCase().includes(q) ||
        l.title?.toLowerCase().includes(q) ||
        l.phoneNumber?.includes(q)
      );
    }

    // Filter by status
    if (filter === 'lost') {
      filtered = filtered.filter(isLostContact);
    } else if (filter !== 'all') {
      filtered = filtered.filter(l => l.status === filter);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sort === 'date') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sort === 'reduction') {
        const ra = calcReduction(a)?.percent || 0;
        const rb = calcReduction(b)?.percent || 0;
        return rb - ra;
      }
      // status
      return (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);
    });

    return filtered;
  }, [leads, search, filter, sort]);

  const counts = useMemo(() => {
    const all = leads.filter(l => OFFER_STATUSES.has(l.status));
    return {
      all: all.length,
      negotiating: all.filter(l => l.status === 'negotiating').length,
      accepted: all.filter(l => l.status === 'accepted').length,
      autosend: all.filter(l => l.status === 'autosend').length,
      lost: all.filter(isLostContact).length,
    };
  }, [leads]);

  const filters: { key: FilterStatus; label: string; count: number }[] = [
    { key: 'all', label: 'Toate', count: counts.all },
    { key: 'negotiating', label: 'Negociere', count: counts.negotiating },
    { key: 'accepted', label: 'Acceptate', count: counts.accepted },
    { key: 'autosend', label: 'Adresă trimisă', count: counts.autosend },
    { key: 'lost', label: 'Pierdute', count: counts.lost },
  ];

  const sorts: { key: SortKey; label: string }[] = [
    { key: 'date', label: 'Dată' },
    { key: 'reduction', label: 'Reducere' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex items-center justify-center border border-amber-500/20">
            <ShoppingBag className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Oferte</h2>
            <p className="text-xs text-zinc-500">{counts.all} oferte colectate</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Caută vânzător, produs..."
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
          />
        </div>
      </div>

      {/* Filters + Sort */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f.key
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-zinc-900/50 text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
              }`}
            >
              {f.label}
              {f.count > 0 && (
                <span className={`ml-1.5 text-[10px] ${filter === f.key ? 'text-amber-500' : 'text-zinc-600'}`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ArrowDownUp className="w-3.5 h-3.5 text-zinc-600" />
          {sorts.map(s => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                sort === s.key
                  ? 'bg-zinc-800 text-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {offers.length > 0 && (
        <div className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
          <div className="flex items-center gap-3">
            <input 
              type="checkbox"
              checked={offers.length > 0 && selectedIds.size === offers.length}
              onChange={toggleAll}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500/30 cursor-pointer"
              title="Selectează tot"
            />
            <span className="text-xs text-zinc-400 font-medium">
              {selectedIds.size} selectate
            </span>
          </div>
          {selectedIds.size > 0 && (
            <button
              onClick={deleteSelectedOffers}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-xs font-bold transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> Șterge Selecția
            </button>
          )}
        </div>
      )}

      {/* Offers list */}
      {offers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
          <ShoppingBag className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-sm">Nu există oferte {filter !== 'all' ? 'pentru acest filtru' : 'încă'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {offers.map((lead, idx) => (
              <OfferCard
                key={lead.id}
                lead={lead}
                index={idx}
                expanded={expandedId === lead.id}
                isSelected={selectedIds.has(lead.id)}
                onToggle={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                onSelect={() => toggleSelection(lead.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/* ─── Offer Card ──────────────────────────────────────────────────────────────── */

function OfferCard({ lead, index, expanded, isSelected, onToggle, onSelect }: {
  key?: React.Key;
  lead: Lead;
  index: number;
  expanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const reduction = calcReduction(lead);
  const lost = isLostContact(lead);
  const hasHistory = lead.priceHistory && lead.priceHistory.length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      className={`bg-zinc-900/40 border rounded-2xl overflow-hidden transition-colors ${
        lost
          ? 'border-amber-500/30'
          : lead.status === 'accepted' || lead.status === 'autosend'
          ? 'border-emerald-500/20'
          : 'border-zinc-800/60'
      }`}
    >
      {/* Main row */}
      <div className="w-full px-4 lg:px-6 py-4 flex items-center gap-3 sm:gap-4 hover:bg-zinc-800/20 transition-colors">
        {/* Checkbox */}
        <div className="shrink-0 flex items-center">
          <input 
            type="checkbox" 
            checked={isSelected}
            onChange={onSelect}
            className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500/30 cursor-pointer"
          />
        </div>

        {/* Content wrapper replacing button */}
        <div
          onClick={onToggle}
          className="flex-1 min-w-0 flex items-center gap-4 cursor-pointer text-left"
        >
          {/* Avatar */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
            lead.status === 'accepted' || lead.status === 'autosend'
              ? 'bg-emerald-500/15 text-emerald-400'
              : lead.status === 'negotiating'
              ? 'bg-indigo-500/15 text-indigo-400'
              : 'bg-zinc-800 text-zinc-400'
          }`}>
            {lead.sellerName?.[0]?.toUpperCase() || '?'}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-sm text-zinc-100 truncate">{lead.sellerName}</span>
              {lost && (
                <span className="flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  <AlertTriangle className="w-2.5 h-2.5" /> PIERDUT
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 truncate max-w-[300px]">{lead.title}</p>
          </div>

          {/* Prices */}
          <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
            {lead.initialPrice && (
              <span className={`text-[11px] ${reduction ? 'line-through text-zinc-600' : 'text-zinc-400 font-medium'}`}>
                {lead.initialPrice}
              </span>
            )}
            {(lead.finalPrice || (lead.price && lead.price !== lead.initialPrice)) && (
              <span className="text-sm font-bold text-emerald-400">
                {lead.finalPrice || lead.price}
              </span>
            )}
            {reduction && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-500">
                <TrendingDown className="w-3 h-3" />
                -{reduction.percent}% ({reduction.absolute.toLocaleString()} {reduction.currency})
              </span>
            )}
          </div>

          {/* Status + Channel */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`text-[9px] uppercase font-black px-2 py-1 rounded-md flex items-center gap-1 w-fit ${getStatusStyle(lead.status)}`}>
              {lead.status === 'autosend' && <Send className="w-2.5 h-2.5" />}
              {lead.status === 'autosend' ? 'ADRESĂ TRIMISĂ' : lead.status}
            </span>
            <div className="flex items-center gap-1.5">
              {lead.channel === 'whatsapp' && (
                <span className="text-[10px] text-emerald-600">WA</span>
              )}
              {lead.channel === 'email' && (
                <span className="text-[10px] text-blue-500">Email</span>
              )}
              {lead.isBotActive ? (
                <Bot className="w-3 h-3 text-indigo-400" />
              ) : (
                <BotOff className="w-3 h-3 text-zinc-600" />
              )}
            </div>
          </div>

          {/* Expand chevron */}
          <div className="shrink-0 text-zinc-600 ml-2">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Mobile prices (shown below main row on small screens) */}
      <div className="sm:hidden px-4 pb-2 flex items-center gap-3">
        {lead.initialPrice && (
          <span className={`text-xs ${reduction ? 'line-through text-zinc-600' : 'text-zinc-400'}`}>
            {lead.initialPrice}
          </span>
        )}
        {(lead.finalPrice || (lead.price && lead.price !== lead.initialPrice)) && (
          <span className="text-sm font-bold text-emerald-400">
            {lead.finalPrice || lead.price}
          </span>
        )}
        {reduction && (
          <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-500">
            <TrendingDown className="w-3 h-3" />-{reduction.percent}%
          </span>
        )}
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 lg:px-6 pb-5 pt-2 border-t border-zinc-800/50 space-y-4">
              {/* Detail grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Phone */}
                {lead.phoneNumber && (
                  <DetailItem
                    icon={<Phone className="w-3.5 h-3.5" />}
                    label="Telefon"
                    value={
                      <a href={`tel:${lead.phoneNumber}`} className="text-indigo-400 hover:text-indigo-300 transition-colors">
                        {formatPhone(lead.phoneNumber)}
                      </a>
                    }
                  />
                )}

                {/* URL */}
                {lead.url && (
                  <DetailItem
                    icon={<ExternalLink className="w-3.5 h-3.5" />}
                    label="Anunț"
                    value={
                      <a href={lead.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 transition-colors truncate max-w-[180px] inline-block">
                        Deschide pe OLX →
                      </a>
                    }
                  />
                )}

                {/* Channel */}
                <DetailItem
                  icon={<MessageSquare className="w-3.5 h-3.5" />}
                  label="Canal"
                  value={<span className="capitalize">{lead.channel || 'whatsapp'}</span>}
                />

                {/* Created */}
                <DetailItem
                  icon={<Clock className="w-3.5 h-3.5" />}
                  label="Creat"
                  value={new Date(lead.createdAt).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                />

                {/* Last contacted */}
                {lead.lastContacted && (
                  <DetailItem
                    icon={<Clock className="w-3.5 h-3.5" />}
                    label="Ultimul contact"
                    value={
                      <span className={lost ? 'text-amber-400' : ''}>
                        {new Date(lead.lastContacted).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {lost && ' ⚠️'}
                      </span>
                    }
                  />
                )}

                {/* Bot status */}
                <DetailItem
                  icon={lead.isBotActive ? <Bot className="w-3.5 h-3.5" /> : <BotOff className="w-3.5 h-3.5" />}
                  label="Bot"
                  value={
                    <span className={lead.isBotActive ? 'text-emerald-400' : 'text-zinc-500'}>
                      {lead.isBotActive ? 'Activ' : 'Oprit'}
                    </span>
                  }
                />
              </div>

              {/* Last message */}
              {lead.lastMessage && (
                <div className="p-3 bg-zinc-800/30 rounded-xl border border-zinc-800/50">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1.5">Ultimul mesaj</p>
                  <p className="text-xs text-zinc-300 leading-relaxed line-clamp-3">{lead.lastMessage}</p>
                </div>
              )}

              {/* Price History Timeline */}
              {hasHistory && (
                <div className="space-y-2">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1.5">
                    <TrendingDown className="w-3 h-3" /> Istoric prețuri
                  </p>
                  <div className="relative pl-4 border-l-2 border-zinc-800 space-y-3">
                    {/* Initial price as first entry */}
                    {lead.initialPrice && (
                      <TimelineEntry
                        price={lead.initialPrice}
                        event="Preț inițial anunț"
                        date={lead.createdAt}
                        type="initial"
                      />
                    )}
                    {lead.priceHistory!.map((entry, i) => (
                      <TimelineEntry
                        key={i}
                        price={`${entry.price.toLocaleString()} ${lead.initialPrice?.includes('€') ? '€' : 'lei'}`}
                        event={entry.event || 'Preț actualizat'}
                        date={entry.date}
                        type={entry.eventType || 'message'}
                      />
                    ))}
                    {/* Final price if accepted */}
                    {lead.finalPrice && (
                      <TimelineEntry
                        price={lead.finalPrice}
                        event="✅ Preț final agreat"
                        date={lead.lastContacted || lead.createdAt}
                        type="accepted"
                        isFinal
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Detail Item ─────────────────────────────────────────────────────────────── */

function DetailItem({ icon, label, value }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 p-2.5 bg-zinc-800/20 rounded-lg">
      <div className="text-zinc-500 mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-zinc-600 uppercase font-bold">{label}</p>
        <div className="text-xs text-zinc-300 mt-0.5">{value}</div>
      </div>
    </div>
  );
}

/* ─── Timeline Entry ──────────────────────────────────────────────────────────── */

function TimelineEntry({ price, event, date, type, isFinal }: {
  key?: React.Key;
  price: string;
  event: string;
  date: string;
  type: string;
  isFinal?: boolean;
}) {
  return (
    <div className="relative">
      <div className={`absolute -left-[21px] w-2.5 h-2.5 rounded-full border-2 ${
        type === 'accepted' || isFinal
          ? 'bg-emerald-500 border-emerald-400'
          : type === 'initial'
          ? 'bg-zinc-600 border-zinc-500'
          : 'bg-indigo-500 border-indigo-400'
      }`} />
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <span className={`text-xs font-bold ${isFinal ? 'text-emerald-400' : 'text-zinc-200'}`}>
            {price}
          </span>
          <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{event}</p>
        </div>
        <span className="text-[10px] text-zinc-600 shrink-0">
          {new Date(date).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
