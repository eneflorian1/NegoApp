import React, { useState, useEffect } from 'react';
import { Search, Trash2, ExternalLink, Phone, Zap, Clock, CheckCircle2, XCircle, RefreshCw, Database, ChevronDown, ChevronUp, StopCircle, MessageCircle, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatPhone } from '../helpers';

interface Mission {
  id: string;
  mode: 'single' | 'category';
  platform: string;
  url: string;
  query?: string;
  useProxy: boolean;
  status: 'running' | 'completed' | 'error' | 'aborted' | 'interrupted';
  domain: string;
  results: any[]; // For single mode
  reveals?: any[]; // For category mode
  listings?: any[]; // For category mode (all scraped listings)
  phones?: string[]; // For category mode
  summary?: any;
  createdAt: string;
  updatedAt: string;
  progress?: number;
  leadsFound?: number;
}

interface MissionStats {
  total: number;
  completed: number;
  failed: number;
  running: number;
  totalPhones: number;
  successRate: number;
  avgTimeMs: number;
}

export default function DatabaseView() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [stats, setStats] = useState<MissionStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      const [mRes, sRes] = await Promise.all([
        fetch('/api/missions', { credentials: 'include' }),
        fetch('/api/missions/stats', { credentials: 'include' }),
      ]);
      const mData = await mRes.json();
      const sData = await sRes.json();
      setMissions(mData);
      setStats(sData);
    } catch (e) {
      console.log('[Database] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  async function deleteMission(id: string) {
    if (!confirm('Sigur vrei să ștergi această misiune?')) return;
    try {
      await fetch(`/api/mission/${id}`, { method: 'DELETE' });
      setMissions(prev => prev.filter(m => m.id !== id));
      fetchData(); // Refresh stats
    } catch (e) {
      console.log('[Database] Delete error:', e);
    }
  }

  async function stopMission(id: string) {
    try {
      await fetch(`/api/mission/${id}/stop`, { method: 'POST' });
      fetchData();
    } catch (e) {
      console.log('[Database] Stop error:', e);
    }
  }

  function toggleSelection(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function toggleAll() {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(m => m.id)));
    }
  }

  async function deleteSelectedMissions() {
    if (!selectedIds.size) return;
    if (!confirm(`Sigur vrei să ștergi ${selectedIds.size} ${selectedIds.size === 1 ? 'misiune selectată' : 'misiuni selectate'}?`)) return;
    
    try {
      await fetch('/api/missions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      setMissions(prev => prev.filter(m => !selectedIds.has(m.id)));
      setSelectedIds(new Set());
      fetchData();
    } catch (e) {
      console.log('[Database] Bulk delete error:', e);
    }
  }

  const filtered = missions.filter(m => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hasPhone = m.results?.some(r => r.phone?.includes(q)) || m.phones?.some(p => p.includes(q));
      const hasTitle = m.results?.[0]?.listing?.title?.toLowerCase().includes(q) || 
                       m.summary?.topListings?.some((l: any) => l.title?.toLowerCase().includes(q));
      return m.url.toLowerCase().includes(q) || hasPhone || hasTitle || m.domain.includes(q);
    }
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-5xl mx-auto pb-10"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/10">
            <Database className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Lead Database</h2>
            <p className="text-xs text-zinc-500">Toate telefoanele extrase și istoricul misiunilor</p>
          </div>
        </div>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-7 gap-1 sm:gap-3">
          <StatPill label="Total" value={stats.total} />
          <StatPill label="Done" value={stats.completed} color="text-emerald-400" />
          <StatPill label="Fail" value={stats.failed} color="text-red-400" />
          <StatPill label="Run" value={stats.running} color="text-indigo-400" />
          <StatPill label="Ph" value={stats.totalPhones} color="text-purple-400" />
          <StatPill label="OK" value={`${stats.successRate || 0}%`} color="text-amber-400" />
          <StatPill label="Time" value={stats.avgTimeMs > 0 ? `${(stats.avgTimeMs / 1000).toFixed(0)}s` : '—'} color="text-zinc-400" />
        </div>
      )}

      {/* Bulk Actions & Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
          <div className="flex items-center gap-3">
            <input 
              type="checkbox"
              checked={filtered.length > 0 && selectedIds.size === filtered.length}
              onChange={toggleAll}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500/30 cursor-pointer"
              title="Selectează tot"
            />
            <span className="text-xs text-zinc-400 font-medium">
              {selectedIds.size} selectate
            </span>
          </div>
          {selectedIds.size > 0 && (
            <button
              onClick={deleteSelectedMissions}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-xs font-bold transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> Șterge Selecția
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Căutare..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-1.5 sm:py-2.5 pl-10 pr-4 text-[11px] sm:text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {['all', 'completed', 'running', 'aborted', 'interrupted', 'error'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-1 sm:px-3 sm:py-2 rounded-lg text-[8px] sm:text-[10px] font-black uppercase tracking-tight sm:tracking-widest transition-colors flex-shrink-0 ${
                statusFilter === s
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                  : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      </div>

      {/* Mission List */}
      <div className="space-y-4">
        {filtered.map(mission => (
          <MissionCard 
            key={mission.id} 
            mission={mission} 
            isExpanded={expandedId === mission.id}
            isSelected={selectedIds.has(mission.id)}
            onToggle={() => setExpandedId(expandedId === mission.id ? null : mission.id)}
            onSelect={() => toggleSelection(mission.id)}
            onDelete={() => deleteMission(mission.id)}
            onStop={() => stopMission(mission.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="glass-panel rounded-2xl p-12 text-center">
            <Database className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
            <p className="text-zinc-500 text-sm">Niciun rezultat găsit.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────
// Mission Card Component
// ────────────────────────────────────────────────────────────────

function MissionCard({ mission, isExpanded, isSelected, onToggle, onSelect, onDelete, onStop }: {
  key?: React.Key;
  mission: Mission;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onDelete: () => void;
  onStop: () => void;
}) {
  const isCategory = mission.mode === 'category';
  const results = mission.mode === 'single' ? mission.results : (mission.reveals || []);
  const mainResult = results[0];
  
  const statusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (status === 'error') return <XCircle className="w-4 h-4 text-red-500" />;
    if (status === 'aborted') return <StopCircle className="w-4 h-4 text-amber-500" />;
    if (status === 'interrupted') return <StopCircle className="w-4 h-4 text-zinc-500" />;
    return <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />;
  };

  const statusColor = (status: string) => {
    if (status === 'completed') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (status === 'error') return 'bg-red-500/10 text-red-400 border-red-500/30';
    if (status === 'aborted') return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    if (status === 'interrupted') return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
    return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
  };

  return (
    <div className={`glass-panel rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-300 ${
      isExpanded ? 'ring-2 ring-indigo-500/30' : 'hover:border-zinc-700'
    } ${
      mission.status === 'completed' ? 'border-l-4 border-l-emerald-500' :
      mission.status === 'error' ? 'border-l-4 border-l-red-500' :
      mission.status === 'aborted' ? 'border-l-4 border-l-amber-500' :
      mission.status === 'interrupted' ? 'border-l-4 border-l-zinc-600' :
      'border-l-4 border-l-indigo-500'
    }`}>
      {/* Header Row */}
      <div className="flex items-center gap-2 sm:gap-4 p-3 lg:p-5">
        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <input 
            type="checkbox" 
            checked={isSelected}
            onChange={onSelect}
            className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500/30 cursor-pointer"
          />
        </div>
        <div className="flex-shrink-0">{statusIcon(mission.status)}</div>
        
        <div className="flex-1 min-w-0" onClick={onToggle} style={{ cursor: 'pointer' }}>
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-tighter px-1 sm:px-1.5 py-0.5 rounded ${
              isCategory ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}>
              {mission.mode}
            </span>
            <h3 className="text-xs sm:text-sm font-bold truncate text-zinc-200">
              {isCategory ? `${mission.domain}` : (mainResult?.listing?.title || mission.url)}
            </h3>
          </div>
          <p className="text-[9px] sm:text-[10px] text-zinc-500 truncate font-mono">{mission.url}</p>
        </div>

        {/* Stats Preview */}
        <div className="hidden md:flex items-center gap-6 text-xs mr-4">
          {isCategory ? (
            <>
              <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase font-bold text-zinc-600">Leads</span>
                <span className="font-bold text-zinc-300">{mission.leadsFound || (mission.listings?.length || 0)}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase font-bold text-zinc-600">Phones</span>
                <span className="font-bold text-emerald-400">{mission.phones?.length || results.filter(r => r.phone).length}</span>
              </div>
            </>
          ) : (
            mainResult?.phone && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-emerald-400 tabular-nums tracking-wider">{formatPhone(mainResult.phone)}</span>
              </div>
            )
          )}
          <div className="flex flex-col items-end">
             <span className="text-[9px] uppercase font-bold text-zinc-600">Data</span>
             <span className="text-[10px] text-zinc-400">{new Date(mission.createdAt).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' })}</span>
          </div>
        </div>

        {/* Status Badge */}
        <div className={`hidden sm:block text-[9px] font-black uppercase px-2 py-1 rounded border ${statusColor(mission.status)}`}>
          {mission.status}
        </div>

        {/* Actions Dropdown / Expand */}
        <div className="flex items-center gap-2">
           <button onClick={onToggle} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
             {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
           </button>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-zinc-800 bg-zinc-900/40"
          >
            <div className="p-5 space-y-6">
              {/* Mission Controls Row */}
              <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-zinc-800/50">
                 <div className="flex items-center gap-4 text-xs">
                    <DetailField label="Mission ID" value={mission.id} mono />
                    <DetailField label="Platform" value={mission.platform} />
                    <DetailField label="Proxy" value={mission.useProxy ? 'IPv6 Proxy' : 'No Proxy'} />
                 </div>
                 <div className="flex items-center gap-2">
                    {mission.status === 'running' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); onStop(); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-xs font-bold transition-all"
                      >
                        <StopCircle className="w-3.5 h-3.5" /> STOP
                      </button>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-xs font-bold transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> DELETE
                    </button>
                    <a 
                      href={mission.url} target="_blank" rel="noopener"
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                 </div>
              </div>

              {/* Nested Results Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">
                    {isCategory ? `Results found (${results.length})` : 'Listing Details'}
                  </p>
                </div>
                
                {results.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-zinc-600 border-b border-zinc-800">
                          <th className="pb-2 font-black uppercase tracking-tighter w-1/2 sm:w-1/2">Product</th>
                          <th className="pb-2 font-black uppercase tracking-tighter text-center">Price</th>
                          <th className="hidden sm:table-cell pb-2 font-black uppercase tracking-tighter text-center">Status</th>
                          <th className="pb-2 font-black uppercase tracking-tighter text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((res: any, idx: number) => (
                          <tr key={res.url || idx} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors group">
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-3">
                                {res.listing?.thumbnail && (
                                  <img src={res.listing.thumbnail} className="w-10 h-10 rounded-lg object-cover bg-zinc-800 flex-shrink-0" alt="" />
                                )}
                                <div className="min-w-0">
                                  <p className="font-bold text-zinc-200 truncate group-hover:text-indigo-400 transition-colors">
                                    {res.listing?.title || "Listing Detail"}
                                  </p>
                                  <p className="text-[9px] text-zinc-500 truncate mt-0.5">{res.url || mission.url}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 text-center font-mono font-bold text-indigo-400">
                              {res.listing?.price || '—'}
                            </td>
                            <td className="hidden sm:table-cell py-3 text-center">
                               {res.phone ? (
                                 <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-md text-[9px] font-black">
                                   PHONE EXTRACTED
                                 </span>
                               ) : res.success === false ? (
                                 <span className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/30 rounded-md text-[9px] font-black">
                                   FAILED
                                 </span>
                               ) : (
                                 <span className="px-2 py-1 bg-zinc-800 text-zinc-500 rounded-md text-[9px]">
                                   PENDING
                                 </span>
                               )}
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                {res.phone && (
                                  <>
                                    <button 
                                      onClick={() => navigator.clipboard.writeText(res.phone)}
                                      className="p-1.5 hover:bg-emerald-500/20 rounded text-emerald-400 transition-colors"
                                      title="Copy Phone"
                                    >
                                      <Phone className="w-3.5 h-3.5" />
                                    </button>
                                    <a 
                                      href={`https://wa.me/${res.phone.replace(/[^0-9]/g, '')}`}
                                      target="_blank" rel="noopener"
                                      className="p-1.5 hover:bg-teal-500/20 rounded text-teal-400 transition-colors"
                                      title="WhatsApp"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5" />
                                    </a>
                                  </>
                                )}
                                <a 
                                  href={res.url || mission.url} target="_blank" rel="noopener"
                                  className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-6 text-center text-zinc-600 italic text-xs">
                    No individual leads processed yet.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatPill({ label, value, color = 'text-zinc-200' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="glass-panel rounded-lg sm:rounded-xl p-2 sm:p-3 text-center border-t border-t-white/5">
      <p className="text-[7px] sm:text-[9px] text-zinc-500 uppercase font-black tracking-widest leading-none mb-1">{label}</p>
      <p className={`text-xs sm:text-lg font-black ${color}`}>{value}</p>
    </div>
  );
}

function DetailField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[9px] text-zinc-500 uppercase font-black tracking-wider mb-0.5">{label}</p>
      <p className={`text-xs text-zinc-300 ${mono ? 'font-mono bg-zinc-800/50 px-1.5 py-0.5 rounded' : ''}`}>{value}</p>
    </div>
  );
}
