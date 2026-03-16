import React, { useState, useEffect, useRef } from 'react';
import { Send, Phone, Mail, ExternalLink, CheckCircle2, ChevronLeft, MoreVertical, AlertCircle, X, MessageSquare, Zap, Users, LineChart, Search, Filter, Trash2 } from 'lucide-react';
import { LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Lead, Message } from '../types';
import { getStatusStyle, parsePrice } from '../helpers';

export default function InboxView({ leads, selectedLeadId, setSelectedLeadId, onToggleBot }: { leads: Lead[], selectedLeadId: string | null, setSelectedLeadId: (id: string) => void, onToggleBot: (id: string) => void, key?: string }) {
  const [messageText, setMessageText] = useState('');
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [chartLeadId, setChartLeadId] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'email'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [readTimestamps, setReadTimestamps] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('inboxReadTimestamps') || '{}');
    } catch { return {}; }
  });
  const filterRef = useRef<HTMLDivElement>(null);
  const selectedLead = leads.find(l => l.id === selectedLeadId);

  // Mark selected lead as read
  useEffect(() => {
    if (!selectedLeadId) return;
    const now = new Date().toISOString();
    setReadTimestamps(prev => {
      const next = { ...prev, [selectedLeadId]: now };
      localStorage.setItem('inboxReadTimestamps', JSON.stringify(next));
      return next;
    });
  }, [selectedLeadId]);

  // Compute unread counts and latest message timestamp per lead
  const leadMeta = React.useMemo(() => {
    const meta: Record<string, { unread: number; latestTs: string; lastSender: string }> = {};
    for (const msg of messages) {
      if (!meta[msg.leadId]) {
        meta[msg.leadId] = { unread: 0, latestTs: msg.timestamp, lastSender: msg.sender };
      }
      if (msg.timestamp > meta[msg.leadId].latestTs) {
        meta[msg.leadId].latestTs = msg.timestamp;
        meta[msg.leadId].lastSender = msg.sender;
      }
      if (msg.sender !== 'me') {
        const readTs = readTimestamps[msg.leadId];
        if (!readTs || msg.timestamp > readTs) {
          meta[msg.leadId].unread++;
        }
      }
    }
    // If bot is active and has already replied, clear unread count
    for (const lead of leads) {
      if (lead.isBotActive && meta[lead.id] && meta[lead.id].lastSender === 'me') {
        meta[lead.id].unread = 0;
      }
    }
    return meta;
  }, [messages, readTimestamps, leads]);

  const handleDeleteConversation = async (leadId: string) => {
    try {
      await fetch(`/api/conversations/${leadId}?deleteLead=true`, { method: 'DELETE' });
      setDeleteConfirmId(null);
      if (selectedLeadId === leadId) {
        setSelectedLeadId('');
        setIsMobileChatOpen(false);
      }
      setMessages(prev => prev.filter(m => m.leadId !== leadId));
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  // Fetch messages from API with polling
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const url = channelFilter === 'all'
          ? '/api/messages'
          : `/api/messages?channel=${channelFilter}`;
        const res = await fetch(url);
        const data = await res.json();
        setMessages(data);
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      }
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [channelFilter]);

  // Close filter dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredLeads = (channelFilter === 'all'
    ? leads
    : leads.filter(lead =>
        messages.some(m => m.leadId === lead.id)
      )
  ).slice().sort((a, b) => {
    const tsA = leadMeta[a.id]?.latestTs || a.createdAt || '';
    const tsB = leadMeta[b.id]?.latestTs || b.createdAt || '';
    return tsB.localeCompare(tsA);
  });

  const leadMessages = messages.filter(m => m.leadId === selectedLeadId);

  const handleSend = async () => {
    if (!messageText.trim() || !selectedLead) return;
    try {
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          text: messageText,
          channel: 'whatsapp',
          to: selectedLead.phoneNumber,
        }),
      });
      setMessageText('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };
  const leadForChart = leads.find(l => l.id === chartLeadId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full -m-4 lg:-m-8"
    >
      {leadForChart && <PriceChartModal lead={leadForChart} onClose={() => setChartLeadId(null)} />}

      {/* Thread List */}
      <div className={`w-full lg:w-80 border-r border-zinc-800 flex flex-col bg-[#0D0D0E]/30 ${isMobileChatOpen ? 'hidden lg:flex' : 'flex'}`}>
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
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredLeads.length === 0 && channelFilter !== 'all' && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare className="w-8 h-8 text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500">Nu exista conversatii pe {channelFilter === 'whatsapp' ? 'WhatsApp' : 'Email'}</p>
            </div>
          )}
          {filteredLeads.map(lead => (
            <div
              key={lead.id}
              className="relative group"
            >
              {/* Delete button - visible on hover */}
              {deleteConfirmId === lead.id ? (
                <div className="absolute right-2 top-2 z-10 flex items-center gap-1 bg-zinc-900 border border-red-500/30 rounded-lg p-1.5 shadow-xl">
                  <span className="text-[10px] text-red-400 px-1">Ștergi?</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteConversation(lead.id); }}
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
                onClick={() => {
                  setSelectedLeadId(lead.id);
                  setIsMobileChatOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedLeadId(lead.id);
                    setIsMobileChatOpen(true);
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

                {/* Mini Dashboard per Conversation */}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setChartLeadId(lead.id);
                        }}
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

                {/* Savings/Profit Indicator */}
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

                {/* Last Message Preview */}
                {lead.lastMessage && (
                  <p className={`text-[10px] line-clamp-1 italic leading-relaxed border-l pl-2 ${lead.status === 'accepted' ? 'text-emerald-400/70 border-emerald-500/30' :
                      lead.status === 'autosend' ? 'text-red-400/70 border-red-500/30' :
                        'text-zinc-500 border-zinc-800'
                    }`}>
                    "{lead.lastMessage}"
                  </p>
                )}

                {/* Manual mode + unread: urgent attention banner */}
                {!lead.isBotActive && (leadMeta[lead.id]?.unread || 0) > 0 && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                      {leadMeta[lead.id].unread} mesaj{leadMeta[lead.id].unread > 1 ? 'e' : ''} nou{leadMeta[lead.id].unread > 1 ? 'a' : ''} — Manual Mode
                    </span>
                  </div>
                )}

                {/* Take Over Button */}
                {lead.isBotActive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleBot(lead.id);
                    }}
                    className="mt-2 w-full py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 rounded-lg text-[10px] font-bold text-indigo-400 uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <Zap className="w-3 h-3 fill-indigo-400" /> Take Over Conversation
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col bg-[#0A0A0B] ${isMobileChatOpen ? 'flex' : 'hidden lg:flex'}`}>
        {selectedLead ? (
          <>
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-[#0D0D0E]/50">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsMobileChatOpen(false)}
                  className="lg:hidden p-2 -ml-2 hover:bg-zinc-800 rounded-lg text-zinc-400"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-indigo-400 font-bold">
                  {selectedLead.sellerName[0]}
                </div>
                <div>
                  <h3 className="font-medium">{selectedLead.sellerName}</h3>
                  <div className="text-xs text-zinc-500 flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Online
                    </div>
                    <span className="text-zinc-700">|</span>
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter ${selectedLead.isBotActive ? 'bg-indigo-500/10 text-indigo-400' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                      {selectedLead.isBotActive ? (
                        <><Zap className="w-2.5 h-2.5 fill-indigo-400" /> Bot Active</>
                      ) : (
                        <><Users className="w-2.5 h-2.5" /> Manual Mode</>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedLead.isBotActive && (
                  <button
                    onClick={() => onToggleBot(selectedLead.id)}
                    className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-600/20"
                  >
                    Take Over
                  </button>
                )}
                {!selectedLead.isBotActive && (
                  <button
                    onClick={() => onToggleBot(selectedLead.id)}
                    className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-bold text-zinc-300 transition-all"
                  >
                    Re-activate Bot
                  </button>
                )}
                <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400"><Phone className="w-5 h-5" /></button>
                <button className="hidden sm:block p-2 hover:bg-zinc-800 rounded-lg text-zinc-400"><Mail className="w-5 h-5" /></button>
                <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400"><MoreVertical className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6 space-y-4">
              {!selectedLead.isBotActive && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-3 mb-4"
                >
                  <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-500 uppercase tracking-widest">Manual Mode Active</p>
                    <p className="text-[10px] text-amber-500/70">The bot has been deactivated for this conversation. You are in full control.</p>
                  </div>
                  <button
                    onClick={() => onToggleBot(selectedLead.id)}
                    className="ml-auto px-3 py-1 bg-amber-500 text-black text-[10px] font-bold rounded-lg hover:bg-amber-400 transition-colors"
                  >
                    Re-activate
                  </button>
                </motion.div>
              )}
              {leadMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="w-10 h-10 text-zinc-700 mb-3 opacity-30" />
                  <p className="text-sm text-zinc-600">Niciun mesaj inca</p>
                </div>
              )}
              {leadMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] lg:max-w-[70%] p-4 rounded-2xl ${msg.sender === 'me'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-zinc-800 text-zinc-200 rounded-tl-none'
                    }`}>
                    {msg.channel === 'email' && msg.subject && (
                      <p className={`text-xs font-semibold mb-1 ${msg.sender === 'me' ? 'text-indigo-100' : 'text-zinc-400'}`}>
                        {msg.subject}
                      </p>
                    )}
                    <p className="text-sm">{msg.text || (msg.channel === 'email' && msg.subject ? '' : '(mesaj gol)')}</p>
                    <div className={`flex items-center gap-1.5 mt-2 ${msg.sender === 'me' ? 'text-indigo-200' : 'text-zinc-500'}`}>
                      {msg.channel === 'whatsapp' ? <MessageSquare className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                      <span className="text-[10px]">
                        {new Date(msg.timestamp).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-zinc-800 bg-[#0D0D0E]/50 space-y-3">
              {selectedLead.aiSuggestion && selectedLead.isBotActive && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMessageText(selectedLead.aiSuggestion || '')}
                    className="flex-1 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 py-2 px-4 rounded-xl text-xs font-medium flex items-center justify-center gap-2 hover:bg-indigo-600/20 transition-colors"
                  >
                    <Zap className="w-3 h-3 fill-indigo-400" /> <span className="truncate">Use AI: "{selectedLead.aiSuggestion.substring(0, 30)}..."</span>
                  </button>
                </div>
              )}
              {!selectedLead.isBotActive && selectedLead.aiSuggestion && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 py-2 px-4 rounded-xl text-[10px] italic flex items-center gap-2">
                    <AlertCircle className="w-3 h-3" /> AI suggestions are disabled in manual mode.
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                  placeholder="Type a message..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button onClick={handleSend} className="p-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white transition-colors">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 p-8 text-center">
            <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
            <p>Select a conversation to start chatting</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PriceChartModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  if (!lead.priceHistory || lead.priceHistory.length === 0) return null;
  const marketAvg = lead.marketValue ? parseInt(lead.marketValue) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="glass-panel rounded-3xl p-6 w-full max-w-lg relative z-10 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold">{lead.title}</h3>
            <p className="text-xs text-zinc-500">{lead.sellerName} • Price History</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ReLineChart data={lead.priceHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 10 }} domain={['dataMin - 200', 'dataMax + 200']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', fontSize: '12px' }}
                labelStyle={{ color: '#a1a1aa' }}
              />
              {marketAvg && (
                <ReferenceLine
                  y={marketAvg}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  label={{ value: 'Preț Mediu Piață', fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }}
                />
              )}
              <Line
                type="monotone"
                dataKey="price"
                stroke="#6366f1"
                strokeWidth={3}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload.eventType === 'accepted') {
                    return <circle cx={cx} cy={cy} r={6} fill="#10b981" stroke="#fff" strokeWidth={2} />;
                  }
                  if (payload.eventType === 'message') {
                    return <circle cx={cx} cy={cy} r={4} fill="#6366f1" stroke="#fff" strokeWidth={2} />;
                  }
                  return <circle cx={cx} cy={cy} r={3} fill="#6366f1" />;
                }}
              />
            </ReLineChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {lead.priceHistory.filter(p => p.event).map((p, i) => (
            <div key={i} className="flex items-center gap-3 text-xs">
              <div className={`w-2 h-2 rounded-full ${p.eventType === 'accepted' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
              <span className="text-zinc-500">{p.date}</span>
              <span className="text-zinc-300">{p.event}</span>
              <span className="ml-auto font-bold">{p.price} lei</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
