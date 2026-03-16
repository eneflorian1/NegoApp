import React, { useState } from 'react';
import { Send, Phone, Mail, ExternalLink, CheckCircle2, ChevronLeft, MoreVertical, AlertCircle, X, MessageSquare, Zap, Users, LineChart, Search } from 'lucide-react';
import { LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Lead, Message } from '../types';
import { getStatusStyle, parsePrice } from '../helpers';
import { MOCK_MESSAGES } from '../mockData';

export default function InboxView({ leads, selectedLeadId, setSelectedLeadId, onToggleBot }: { leads: Lead[], selectedLeadId: string | null, setSelectedLeadId: (id: string) => void, onToggleBot: (id: string) => void, key?: string }) {
  const [messageText, setMessageText] = useState('');
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [chartLeadId, setChartLeadId] = useState<string | null>(null);
  const selectedLead = leads.find(l => l.id === selectedLeadId);
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
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {leads.map(lead => (
            <div
              key={lead.id}
              className="relative group"
            >
              <button
                onClick={() => {
                  setSelectedLeadId(lead.id);
                  setIsMobileChatOpen(true);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onToggleBot(lead.id);
                }}
                className={`w-full p-4 flex flex-col gap-3 border-b border-zinc-800/50 transition-all duration-300 ${selectedLeadId === lead.id ? 'bg-indigo-600/5 border-l-2 border-l-indigo-500' : 'hover:bg-zinc-800/30'
                  } ${lead.status === 'accepted' ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500 ring-1 ring-emerald-500/20' : ''} ${lead.status === 'autosend' ? 'bg-red-500/5 border-l-2 border-l-red-500 ring-1 ring-red-500/20' : ''
                  }`}
              >
                <div className="flex gap-3 w-full">
                  <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-lg font-bold transition-colors ${lead.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-400' :
                      lead.status === 'autosend' ? 'bg-red-500/20 text-red-400' :
                        'bg-zinc-800 text-indigo-400'
                    }`}>
                    {lead.sellerName[0]}
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                    <div className="flex justify-between items-start">
                      <span className={`font-bold truncate text-sm ${lead.status === 'accepted' ? 'text-emerald-400' :
                          lead.status === 'autosend' ? 'text-red-400' :
                            'text-zinc-100'
                        }`}>{lead.sellerName}</span>
                      <span className="text-[10px] text-zinc-600 whitespace-nowrap ml-2">12:05 PM</span>
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
              </button>
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
              {MOCK_MESSAGES.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] lg:max-w-[70%] p-4 rounded-2xl ${msg.sender === 'me'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-zinc-800 text-zinc-200 rounded-tl-none'
                    }`}>
                    <p className="text-sm">{msg.text}</p>
                    <p className={`text-[10px] mt-2 ${msg.sender === 'me' ? 'text-indigo-200' : 'text-zinc-500'}`}>
                      12:10 PM
                    </p>
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
                  placeholder="Type a message..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button className="p-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white transition-colors">
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
