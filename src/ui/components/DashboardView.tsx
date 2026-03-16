import React from 'react';
import { TrendingUp, CheckCircle2, Clock, BarChart3, Search, Users, MessageSquare, Send, Phone, Zap, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Lead, Config } from '../types';
import { parsePrice, getStatusStyle } from '../helpers';

export default function DashboardView({ leads, config }: { leads: Lead[], config: Config }) {
  const negotiatingValue = leads
    .filter(l => l.status === 'negotiating')
    .reduce((acc, curr) => acc + parsePrice(curr.price), 0);

  const closedValue = leads
    .filter(l => l.status === 'closed')
    .reduce((acc, curr) => acc + parsePrice(curr.price), 0);

  const totalPotential = leads
    .filter(l => l.status !== 'closed')
    .reduce((acc, curr) => acc + parsePrice(curr.price), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      {/* Financial Mini Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-t-4 border-t-indigo-500 bg-gradient-to-b from-indigo-500/10 to-transparent relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <TrendingUp className="w-24 h-24 sm:w-32 sm:h-32 text-indigo-500" />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] sm:text-xs text-zinc-400 font-bold uppercase tracking-widest mb-1 sm:mb-2">În Negociere</p>
            <p className="text-2xl sm:text-4xl font-black text-white tracking-tight">{negotiatingValue.toLocaleString()} <span className="text-xs sm:text-sm font-medium text-zinc-500">lei</span></p>
            <div className="mt-2 sm:mt-4 flex items-center gap-2 text-[9px] sm:text-[10px] text-indigo-400 font-bold bg-indigo-500/10 w-fit px-2 py-1 rounded-md">
              <Clock className="w-3 h-3" /> ACTIVE DEALS
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-t-4 border-t-emerald-500 bg-gradient-to-b from-emerald-500/10 to-transparent relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <CheckCircle2 className="w-24 h-24 sm:w-32 sm:h-32 text-emerald-500" />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] sm:text-xs text-zinc-400 font-bold uppercase tracking-widest mb-1 sm:mb-2">Finalizat (Closed)</p>
            <p className="text-2xl sm:text-4xl font-black text-white tracking-tight">{closedValue.toLocaleString()} <span className="text-xs sm:text-sm font-medium text-zinc-500">lei</span></p>
            <div className="mt-2 sm:mt-4 flex items-center gap-2 text-[9px] sm:text-[10px] text-emerald-400 font-bold bg-emerald-500/10 w-fit px-2 py-1 rounded-md">
              <Zap className="w-3 h-3 fill-emerald-400" /> REVENUE GENERATED
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-t-4 border-t-zinc-700 bg-gradient-to-b from-zinc-700/10 to-transparent relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <BarChart3 className="w-24 h-24 sm:w-32 sm:h-32 text-zinc-500" />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] sm:text-xs text-zinc-400 font-bold uppercase tracking-widest mb-1 sm:mb-2">Total Potențial</p>
            <p className="text-2xl sm:text-4xl font-black text-white tracking-tight">{totalPotential.toLocaleString()} <span className="text-xs sm:text-sm font-medium text-zinc-500">lei</span></p>
            <div className="mt-2 sm:mt-4 flex items-center gap-2 text-[9px] sm:text-[10px] text-zinc-500 font-bold bg-zinc-500/10 w-fit px-2 py-1 rounded-md">
              <Search className="w-3 h-3" /> PIPELINE VALUE
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
        <StatCard label="Total Leads" value={leads.length.toString()} trend="+12%" icon={<Users className="w-5 h-5 text-indigo-400" />} />
        <StatCard label="Conversations" value="48" trend="+5%" icon={<MessageSquare className="w-5 h-5 text-emerald-400" />} />
        <StatCard label="Success Rate" value="24%" trend="+2%" icon={<CheckCircle2 className="w-5 h-5 text-amber-400" />} />
        <StatCard label="Auto-Pilot" value={config.autoPilotEnabled ? "Active" : "Off"} icon={<Zap className="w-5 h-5 text-purple-400" />} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
        <StatCard label="Autosend Address" value={config.autosendAddress ? "Enabled" : "Disabled"} icon={<Send className="w-5 h-5 text-indigo-400" />} />
        <StatCard label="WhatsApp" value={config.whatsappConnected ? "Connected" : "Disconnected"} icon={<MessageSquare className="w-5 h-5 text-emerald-400" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-lg font-medium mb-6">Recent Activity</h3>
          <div className="space-y-4">
            {leads.map(lead => (
              <div key={lead.id} className="flex items-center justify-between p-4 bg-zinc-800/30 rounded-xl border border-zinc-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-700 rounded-lg flex items-center justify-center">
                    <Phone className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <p className="font-medium">{lead.title}</p>
                    <p className="text-xs text-zinc-500">{lead.sellerName} • {lead.price}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] uppercase tracking-wider font-black px-2 py-1 rounded-md shadow-sm ${getStatusStyle(lead.status)}`}>
                    {lead.status}
                  </span>
                  <p className="text-[10px] text-zinc-600 mt-1">2 hours ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 bg-indigo-600/20 rounded-full flex items-center justify-center">
            <Zap className="w-8 h-8 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Orchestrator Ready</h3>
            <p className="text-zinc-500 mt-2 max-w-xs">Start an autonomous search to find and contact new sellers instantly.</p>
          </div>
          <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-medium transition-colors flex items-center gap-2">
            Launch Agent <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, trend, icon }: { label: string; value: string; trend?: string; icon: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-2xl p-3 sm:p-5 flex items-center gap-3 sm:gap-4 group hover:border-indigo-500/20 transition-all">
      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-zinc-800 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
        {React.cloneElement(icon as React.ReactElement, { className: 'w-4 h-4 sm:w-5 sm:h-5' })}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] sm:text-[10px] text-zinc-500 uppercase font-bold tracking-widest truncate">{label}</p>
        <p className="text-lg sm:text-xl font-bold truncate">{value}</p>
      </div>
      {trend && (
        <span className="text-[8px] sm:text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md">
          {trend}
        </span>
      )}
    </div>
  );
}
