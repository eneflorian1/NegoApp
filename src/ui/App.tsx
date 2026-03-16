import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Zap,
  Users,
  Search,
  Settings,
  Menu,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { AnimatePresence } from 'motion/react';
import { Lead, OrchestratorTask, Config, MarketStats, ServiceStatus } from './types';
import { MOCK_MARKET_STATS } from './mockData';

import DashboardView from './components/DashboardView';
import InboxView from './components/InboxView';
import OrchestratorView from './components/OrchestratorView';
import DatabaseView from './components/DatabaseView';
import LeadsView from './components/LeadsView';
import SettingsView from './components/SettingsView';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inbox' | 'orchestrator' | 'leads' | 'database' | 'settings'>('orchestrator');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [marketStats] = useState<MarketStats[]>(MOCK_MARKET_STATS);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<OrchestratorTask[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    whatsapp: { connected: false, initializing: false, phone: null, name: null, hasQR: false, error: null },
    agentmail: { connected: false, error: null },
  });

  const toggleBotActive = async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const updated = !lead.isBotActive;
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, isBotActive: updated } : l
    ));
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBotActive: updated }),
      });
    } catch { /* ignore */ }
  };

  const deleteLead = async (leadId: string) => {
    setLeads(prev => prev.filter(l => l.id !== leadId));
    if (selectedLeadId === leadId) setSelectedLeadId('');
    try {
      await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
    } catch { /* ignore */ }
  };

  // Fetch leads from server with polling
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const res = await fetch('/api/leads');
        const data = await res.json();
        setLeads(data);
      } catch { /* ignore */ }
    };
    fetchLeads();
    const interval = setInterval(fetchLeads, 5000);
    return () => clearInterval(interval);
  }, []);
  const [config, setConfig] = useState<Config>({
    geminiApiKey: '',
    agentMailApiKey: '',
    whatsappConnected: true,
    autoPilotEnabled: false,
    requestLocationConfirmation: true,
    meetingAddress: 'Piata Unirii, Bucuresti',
    autosendAddress: false,
    defaultPersonality: 'diplomat',
    whatsappSystemPrompt: '',
    emailSystemPrompt: '',
    yoloDefaults: {
      autoNegThreshold: 10,
      modaExcludedBrands: 'Zara, H&M',
      electroniceMinWarrantyMonths: 12
    }
  });

  const [configLoaded, setConfigLoaded] = useState(false);

  // Load config from server on mount
  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(saved => {
      if (saved && Object.keys(saved).length > 0) {
        setConfig(prev => ({ ...prev, ...saved }));
      }
      setConfigLoaded(true);
    }).catch(() => {
      setConfigLoaded(false);
    });
  }, []);

  // Poll service status every 5s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/services/status');
        const data = await res.json();
        setServiceStatus(data);
      } catch { /* ignore */ }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'orchestrator', label: 'Orchestrator', icon: <Zap className="w-5 h-5" /> },
    { id: 'inbox', label: 'Inbox', icon: <MessageSquare className="w-5 h-5" /> },
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'database', label: 'Database', icon: <Search className="w-5 h-5" /> },
    { id: 'leads', label: 'Leads', icon: <Users className="w-5 h-5" /> },
  ];

  return (
    <div className="flex h-screen bg-[#0A0A0B] text-zinc-100 font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-zinc-800 flex-col bg-[#0D0D0E]">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">NegoFlow</span>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map(item => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeTab === item.id}
              onClick={() => setActiveTab(item.id as any)}
            />
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'settings'
                ? 'bg-indigo-600/10 text-indigo-400 font-medium'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 left-0 h-full w-64 bg-[#0D0D0E] border-r border-zinc-800 z-50 lg:hidden flex flex-col"
            >
              <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 text-white fill-white" />
                  </div>
                  <span className="font-bold text-xl tracking-tight">NegoFlow</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-zinc-800 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 px-4 space-y-1">
                {navItems.map(item => (
                  <NavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    active={activeTab === item.id}
                    onClick={() => { setActiveTab(item.id as any); setIsMobileMenuOpen(false); }}
                  />
                ))}
              </nav>

              <div className="p-4 border-t border-zinc-800">
                <button
                  onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'settings'
                      ? 'bg-indigo-600/10 text-indigo-400 font-medium'
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'
                    }`}
                >
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-4 lg:px-8 bg-[#0D0D0E]/50 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 hover:bg-zinc-800 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold">{navItems.find(n => n.id === activeTab)?.label || 'Settings'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              {/* WhatsApp LED */}
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${serviceStatus.whatsapp.connected ? 'bg-emerald-500 animate-pulse' : serviceStatus.whatsapp.initializing ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
                <span className={`text-[10px] font-medium hidden sm:inline ${serviceStatus.whatsapp.connected ? 'text-emerald-500' : serviceStatus.whatsapp.initializing ? 'text-amber-500' : 'text-red-500'}`}>
                  WA
                </span>
              </div>
              {/* AgentMail LED */}
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${serviceStatus.agentmail.connected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
                <span className={`text-[10px] font-medium hidden sm:inline ${serviceStatus.agentmail.connected ? 'text-emerald-500' : 'text-zinc-500'}`}>
                  Mail
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className={`flex-1 ${activeTab === 'orchestrator' ? 'overflow-hidden' : 'overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-12'} custom-scrollbar`}>
          {/* Always-mounted views — prevents state loss (polling, results) on tab switch */}
          <div className="h-full p-4 lg:p-8 pb-24 lg:pb-12" style={{ display: activeTab === 'orchestrator' ? 'block' : 'none' }}>
            <OrchestratorView config={config} tasks={tasks} setTasks={setTasks} />
          </div>
          <div style={{ display: activeTab === 'inbox' ? 'block' : 'none' }}>
            <InboxView
              leads={leads}
              selectedLeadId={selectedLeadId}
              setSelectedLeadId={setSelectedLeadId}
              onToggleBot={toggleBotActive}
            />
          </div>
          <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
            <DashboardView leads={leads} config={config} />
          </div>
          <div style={{ display: activeTab === 'database' ? 'block' : 'none' }}>
            <DatabaseView />
          </div>
          <div style={{ display: activeTab === 'leads' ? 'block' : 'none' }}>
            <LeadsView leads={leads} marketStats={marketStats} selectedLeadId={selectedLeadId} setSelectedLeadId={setSelectedLeadId} onDeleteLead={deleteLead} />
          </div>
          <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }}>
            <SettingsView config={config} setConfig={setConfig} serviceStatus={serviceStatus} configLoaded={configLoaded} />
          </div>
        </div>

        <div className="lg:hidden fixed bottom-0 inset-x-0 h-20 bg-[#0D0D0E]/80 backdrop-blur-xl border-t border-zinc-800 flex items-center justify-around px-4 z-30">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center gap-1 transition-colors ${activeTab === item.id ? 'text-indigo-400' : 'text-zinc-500'
                }`}
            >
              <div className={`p-2 rounded-xl transition-colors ${activeTab === item.id ? 'bg-indigo-600/10' : ''}`}>
                {item.icon}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, key?: any }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${active
          ? 'bg-indigo-600/10 text-indigo-400 font-medium'
          : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'
        }`}
    >
      {icon}
      <span>{label}</span>
      {active && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 bg-indigo-500 rounded-full" />}
    </button>
  );
}
