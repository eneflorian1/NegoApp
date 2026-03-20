import React from 'react';
import { Phone, Mail, ExternalLink, MessageSquare, Zap, Search, Filter, Trash2, PlayCircle, MapPin, Send } from 'lucide-react';
import { Lead } from '../../types';
import { getStatusStyle, parsePrice } from '../../helpers';
import { LineChart } from 'lucide-react';

interface LeadMeta {
  unread: number;
  latestTs: string;
  lastSender: string;
}

interface ThreadListProps {
  leads: Lead[];
  selectedLeadId: string | null;
  leadMeta: Record<string, LeadMeta>;
  channelFilter: 'all' | 'whatsapp' | 'email';
  setChannelFilter: (f: 'all' | 'whatsapp' | 'email') => void;
  showFilterDropdown: boolean;
  setShowFilterDropdown: (v: boolean) => void;
  filterRef: React.RefObject<HTMLDivElement | null>;
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
  startingConvoId: string | null;
  sendingAddressId: string | null;
  isMobileChatOpen: boolean;
  onSelectLead: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onToggleBot: (id: string) => void;
  onStartConversation: (id: string) => void;
  onSendAddress: (id: string) => void;
  onChartOpen: (id: string) => void;
}

export default function ThreadList({
  leads, selectedLeadId, leadMeta, channelFilter, setChannelFilter,
  showFilterDropdown, setShowFilterDropdown, filterRef,
  deleteConfirmId, setDeleteConfirmId, startingConvoId, sendingAddressId,
  isMobileChatOpen, onSelectLead, onDeleteConversation, onToggleBot,
  onStartConversation, onSendAddress, onChartOpen,
}: ThreadListProps) {
  return (
    <div className={`w-full lg:w-80 border-r border-zinc-800 flex flex-col min-h-0 bg-[#0D0D0E]/30 ${isMobileChatOpen ? 'hidden lg:flex' : 'flex'}`}>
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`p-2 rounded-lg transition-colors ${
                channelFilter !== 'all'
                  ? 'bg-indigo-600/10 text-indigo-400'
                  : 'hover:bg-zinc-800 text-zinc-400'
              }`}
            >
              <Filter className="w-5 h-5" />
            </button>
            {showFilterDropdown && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden">
                {([
                  { key: 'all' as const, label: 'Toate', icon: null },
                  { key: 'email' as const, label: 'Email', icon: <Mail className="w-4 h-4" /> },
                  { key: 'whatsapp' as const, label: 'WhatsApp', icon: <MessageSquare className="w-4 h-4" /> },
                ]).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setChannelFilter(opt.key); setShowFilterDropdown(false); }}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                      channelFilter === opt.key
                        ? 'bg-indigo-600/10 text-indigo-400 font-medium'
                        : 'text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
        {leads.length === 0 && channelFilter !== 'all' && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageSquare className="w-8 h-8 text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-500">Nu exista conversatii pe {channelFilter === 'whatsapp' ? 'WhatsApp' : 'Email'}</p>
          </div>
        )}
        {leads.map(lead => (
          <div key={lead.id} className="relative group">
            {/* Delete button */}
            {deleteConfirmId === lead.id ? (
              <div className="absolute right-2 top-2 z-10 flex items-center gap-1 bg-zinc-900 border border-red-500/30 rounded-lg p-1.5 shadow-xl">
                <span className="text-[10px] text-red-400 px-1">Ștergi?</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteConversation(lead.id); }}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded transition-colors"
                >
                  Da
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                  className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-[10px] font-bold rounded transition-colors"
                >
                  Nu
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(lead.id); }}
                className="absolute right-2 top-2 z-10 p-1.5 rounded-lg bg-zinc-900/80 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelectLead(lead.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectLead(lead.id);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                onToggleBot(lead.id);
              }}
              className={`w-full p-4 flex flex-col gap-3 border-b border-zinc-800/50 transition-all duration-300 cursor-pointer ${selectedLeadId === lead.id ? 'bg-indigo-600/5 border-l-2 border-l-indigo-500' : 'hover:bg-zinc-800/30'
                } ${lead.status === 'accepted' ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500 ring-1 ring-emerald-500/20' : ''} ${lead.status === 'autosend' ? 'bg-red-500/5 border-l-2 border-l-red-500 ring-1 ring-red-500/20' : ''
                }`}
            >
              <div className="flex gap-3 w-full">
                <div className="relative flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-colors ${lead.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-400' :
                      lead.status === 'autosend' ? 'bg-red-500/20 text-red-400' :
                        'bg-zinc-800 text-indigo-400'
                    }`}>
                    {lead.sellerName[0]}
                  </div>
                  {(leadMeta[lead.id]?.unread || 0) > 0 && (
                    <span className={`absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white px-1 shadow-lg shadow-indigo-500/40 ${!lead.isBotActive ? 'animate-pulse ring-2 ring-amber-500/50' : ''}`}>
                      {leadMeta[lead.id].unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 text-left overflow-hidden">
                  <div className="flex justify-between items-start">
                    <span className={`font-bold truncate text-sm ${(leadMeta[lead.id]?.unread || 0) > 0 ? 'text-white' : ''} ${lead.status === 'accepted' ? 'text-emerald-400' :
                        lead.status === 'autosend' ? 'text-red-400' :
                          (leadMeta[lead.id]?.unread || 0) > 0 ? 'text-white' : 'text-zinc-100'
                      }`}>{lead.sellerName}</span>
                    <span className={`text-[10px] whitespace-nowrap ml-2 ${(leadMeta[lead.id]?.unread || 0) > 0 ? 'text-indigo-400 font-medium' : 'text-zinc-600'}`}>
                      {leadMeta[lead.id]?.latestTs
                        ? new Date(leadMeta[lead.id].latestTs).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[11px] text-zinc-400 truncate flex-1">{lead.title}</p>
                    {lead.isBotActive && (
                      <span className="flex items-center gap-1 text-[8px] font-bold text-indigo-400 bg-indigo-500/10 px-1 rounded uppercase tracking-tighter ml-2">
                        <Zap className="w-2 h-2 fill-indigo-400" /> Bot
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Last Message Preview */}
              {lead.lastMessage && (
                <p className={`text-[10px] line-clamp-1 italic leading-relaxed border-l pl-2 ${lead.status === 'accepted' ? 'text-emerald-400/70 border-emerald-500/30' :
                    lead.status === 'autosend' ? 'text-red-400/70 border-red-500/30' :
                      'text-zinc-500 border-zinc-800'
                  }`}>
                  "{lead.lastMessage}"
                </p>
              )}

              {/* Mini Dashboard */}
              <div className={`flex items-center justify-between rounded-xl p-2 border transition-colors ${lead.status === 'accepted' ? 'bg-emerald-500/10 border-emerald-500/30' :
                  lead.status === 'autosend' ? 'bg-red-500/10 border-red-500/30' :
                    lead.status === 'closed' ? 'bg-zinc-900/30 border-zinc-800/30 opacity-60' :
                      'bg-zinc-900/50 border-zinc-800/50'
                }`}>
                <div className="flex flex-col">
                  <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">Preț Listă</span>
                  <span className="text-xs font-medium text-zinc-500 line-through decoration-zinc-600">{lead.initialPrice}</span>
                </div>

                <div className="flex flex-col items-center px-2 border-x border-zinc-800/50 relative">
                  <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">
                    {lead.status === 'closed' ? 'Preț Final' : 'Ofertă'}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-black ${lead.status === 'accepted' ? 'text-emerald-400' :
                        lead.status === 'autosend' ? 'text-red-400' :
                          lead.status === 'closed' ? 'text-zinc-400' :
                            'text-indigo-400'
                      }`}>
                      {lead.status === 'closed' ? (lead.finalPrice || lead.price) : lead.price}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onChartOpen(lead.id); }}
                      className="p-1 hover:bg-zinc-800 rounded-md transition-colors text-zinc-500 hover:text-indigo-400"
                    >
                      <LineChart className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Status</span>
                  <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded shadow-sm flex items-center gap-1 ${getStatusStyle(lead.status)}`}>
                    {lead.status === 'autosend' && <Send className="w-2.5 h-2.5" />}
                    {lead.status === 'autosend' ? 'DELIVERY SENT' : lead.status}
                  </span>
                </div>
              </div>

              {/* Savings Indicator */}
              {(lead.status === 'accepted' || lead.status === 'closed' || lead.status === 'autosend') && (
                <div className={`flex items-center justify-between px-2 py-1 rounded-lg text-[10px] font-bold ${lead.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-500' :
                    lead.status === 'autosend' ? 'bg-red-500/10 text-red-500' :
                      'bg-zinc-800/50 text-zinc-500'
                  }`}>
                  <span className="uppercase tracking-wider">
                    {lead.status === 'accepted' ? 'Economie Negociată' :
                      lead.status === 'autosend' ? 'Economie Confirmată' : 'Economie Totală'}
                  </span>
                  <span>
                    -{parsePrice(lead.initialPrice) - parsePrice(lead.status === 'closed' ? (lead.finalPrice || lead.price) : lead.price)} lei
                  </span>
                </div>
              )}

              {/* Manual mode urgent banner */}
              {!lead.isBotActive && (leadMeta[lead.id]?.unread || 0) > 0 && (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                    {leadMeta[lead.id].unread} mesaj{leadMeta[lead.id].unread > 1 ? 'e' : ''} nou{leadMeta[lead.id].unread > 1 ? 'a' : ''} — Manual Mode
                  </span>
                </div>
              )}

              {/* Start Conversation Button */}
              {lead.phoneNumber && !leadMeta[lead.id]?.latestTs && lead.status === 'new' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onStartConversation(lead.id); }}
                  disabled={startingConvoId === lead.id}
                  className="mt-2 w-full py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 rounded-lg text-[10px] font-bold text-emerald-400 uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <PlayCircle className="w-3 h-3" />
                  {startingConvoId === lead.id ? 'Se trimite...' : 'Pornește Conversația'}
                </button>
              )}

              {/* Take Over Button */}
              {lead.isBotActive && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleBot(lead.id); }}
                  className="mt-2 w-full py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 rounded-lg text-[10px] font-bold text-indigo-400 uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <Zap className="w-3 h-3 fill-indigo-400" /> Take Over Conversation
                </button>
              )}

              {/* Send Address Card */}
              {lead.status === 'accepted' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSendAddress(lead.id); }}
                  disabled={sendingAddressId === lead.id}
                  className="mt-2 w-full py-2 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 rounded-lg text-[10px] font-bold text-emerald-400 uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50 animate-pulse"
                >
                  <MapPin className="w-3 h-3" />
                  {sendingAddressId === lead.id ? 'Se trimite adresa...' : 'Trimite Adresa de Livrare'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
