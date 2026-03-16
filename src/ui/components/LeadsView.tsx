import React, { useState } from 'react';
import { Search, Filter, ExternalLink, Phone, TrendingUp, ChevronLeft, ArrowRight, X, Send, MessageSquare, Zap, BarChart3 } from 'lucide-react';
import { LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Lead, MarketStats } from '../types';
import { getStatusStyle, parsePrice } from '../helpers';

export default function LeadsView({ leads, marketStats, selectedLeadId, setSelectedLeadId }: { leads: Lead[], marketStats: MarketStats[], selectedLeadId: string | null, setSelectedLeadId: (id: string) => void, key?: string }) {
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const selectedLead = leads.find(l => l.id === selectedLeadId);
  const stats = marketStats.find(s =>
    selectedLead?.title.toLowerCase().includes(s.query.toLowerCase()) ||
    s.query.toLowerCase().includes(selectedLead?.title.toLowerCase() || '')
  ) || marketStats[0];

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 h-full">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 glass-panel rounded-2xl overflow-hidden self-start"
      >
        <div className="p-4 lg:p-6 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-lg font-medium">Extracted Leads</h3>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 border border-zinc-800"><Filter className="w-4 h-4" /></button>
            <button className="hidden sm:block px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors">Export CSV</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                <th className="px-4 lg:px-6 py-4 font-medium">Seller</th>
                <th className="hidden sm:table-cell px-6 py-4 font-medium">Product</th>
                <th className="px-4 lg:px-6 py-4 font-medium">Price</th>
                <th className="hidden md:table-cell px-6 py-4 font-medium">Status</th>
                <th className="px-4 lg:px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {leads.map(lead => (
                <tr
                  key={lead.id}
                  onClick={() => {
                    setSelectedLeadId(lead.id);
                    setIsMobilePanelOpen(true);
                  }}
                  className={`cursor-pointer transition-colors ${selectedLeadId === lead.id ? 'bg-indigo-600/10' : 'hover:bg-zinc-800/20'
                    }`}
                >
                  <td className="px-4 lg:px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-xs font-bold text-indigo-400">
                        {lead.sellerName[0]}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{lead.sellerName}</span>
                        <span className="sm:hidden text-[10px] text-zinc-500 truncate max-w-[100px]">{lead.title}</span>
                      </div>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-6 py-4 text-sm text-zinc-300 max-w-[200px] truncate">{lead.title}</td>
                  <td className="px-4 lg:px-6 py-4 text-sm font-mono font-bold text-indigo-400">{lead.price}</td>
                  <td className="hidden md:table-cell px-6 py-4">
                    <span className={`text-[9px] uppercase font-black px-2 py-1 rounded-md shadow-sm flex items-center gap-1 w-fit ${getStatusStyle(lead.status)}`}>
                      {lead.status === 'autosend' && <Send className="w-2.5 h-2.5" />}
                      {lead.status === 'autosend' ? 'DELIVERY SENT' : lead.status}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 py-4">
                    <div className="flex gap-2">
                      <button className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500"><ExternalLink className="w-3.5 h-3.5" /></button>
                      <button className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500"><MessageSquare className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Market Analysis Panel */}
      <AnimatePresence>
        {selectedLead && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`
              fixed lg:relative inset-0 lg:inset-auto z-40 lg:z-0
              w-full lg:w-96 shrink-0
              bg-[#0A0A0B] lg:bg-transparent
              p-4 lg:p-0
              ${isMobilePanelOpen ? 'flex flex-col' : 'hidden lg:block'}
            `}
          >
            <motion.div
              key={selectedLead.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel rounded-3xl p-6 space-y-6 border-t-4 border-t-indigo-500 h-full lg:h-auto overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm uppercase tracking-wider">Market Analysis</h3>
                    <p className="text-[10px] text-zinc-500">Real-time data for {selectedLead.title.substring(0, 20)}...</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedLeadId('');
                    setIsMobilePanelOpen(false);
                  }}
                  className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-5 bg-zinc-900/50 rounded-2xl border border-zinc-800/50">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">Listing Price</p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${selectedLead.dealRating === 'great' ? 'bg-emerald-500/10 text-emerald-500' :
                        selectedLead.dealRating === 'fair' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                      }`}>
                      {selectedLead.dealRating} deal
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-white">{selectedLead.price}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800/50">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Avg Market</p>
                    <p className="text-lg font-bold text-zinc-200">{stats.averagePrice} lei</p>
                  </div>
                  <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800/50">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Min Price</p>
                    <p className="text-lg font-bold text-emerald-500">{stats.minPrice} lei</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">Price Distribution</p>
                    <span className="text-[10px] text-zinc-600">{stats.totalListings} listings found</span>
                  </div>
                  <div className="space-y-2.5">
                    {stats.priceDistribution.map((dist, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-zinc-400">{dist.range} lei</span>
                          <span className="text-zinc-200 font-medium">{dist.count}</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(dist.count / stats.totalListings) * 100}%` }}
                            className="h-full bg-indigo-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 bg-indigo-600/10 rounded-2xl border border-indigo-500/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-indigo-400" />
                    <p className="text-[10px] font-bold uppercase text-indigo-400 tracking-widest">AI Negotiation Strategy</p>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    This unit is priced <span className="text-emerald-400 font-bold">{Math.round(((stats.averagePrice - parseInt(selectedLead.price)) / stats.averagePrice) * 100)}% below</span> market average.
                    The seller is likely motivated.
                  </p>
                  <div className="pt-2">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold mb-2">Recommended Action</p>
                    <button className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20">
                      Send Low-Ball Offer ({parseInt(selectedLead.price) - 200} lei)
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
