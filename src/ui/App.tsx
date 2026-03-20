import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Zap,
  Users,
  Search,
  Settings,
  Menu,
  X,
  ShoppingBag,
  LogOut,
} from 'lucide-react';
import { motion } from 'motion/react';
import { AnimatePresence } from 'motion/react';
import { OrchestratorTask, MarketStats } from './types';
import { MOCK_MARKET_STATS } from './mockData';
import { useAppData } from './hooks/useAppData';

import DashboardView from './components/DashboardView';
import InboxView from './components/InboxView';
import OrchestratorView from './components/OrchestratorView';
import DatabaseView from './components/DatabaseView';
import LeadsView from './components/LeadsView';
import SettingsView from './components/SettingsView';
import OffersView from './components/OffersView';
import LoginView from './components/LoginView';

interface AuthUser {
  id: string;
  username: string;
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.id) setUser({ id: data.id, username: data.username });
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={setUser} />;
  }

  return <AppContent user={user} onLogout={handleLogout} />;
}

function AppContent({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [activeTab, setActiveTabState] = useState<'dashboard' | 'inbox' | 'orchestrator' | 'leads' | 'database' | 'offers' | 'settings'>(
    () => (sessionStorage.getItem('activeTab') as any) || 'orchestrator'
  );
  const setActiveTab = (tab: typeof activeTab) => {
    sessionStorage.setItem('activeTab', tab);
    setActiveTabState(tab);
  };

  const { leads, config, setConfig, configLoaded, serviceStatus, toggleBotActive, deleteLead, deleteLeads } = useAppData();

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<OrchestratorTask[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [marketStats] = useState<MarketStats[]>(MOCK_MARKET_STATS);

  const navItems = [
    { id: 'orchestrator', label: 'Orchestrator', icon: <Zap className="w-5 h-5" /> },
    { id: 'inbox', label: 'Inbox', icon: <MessageSquare className="w-5 h-5" /> },
    { id: 'offers', label: 'Oferte', icon: <ShoppingBag className="w-5 h-5" /> },
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'database', label: 'Database', icon: <Search className="w-5 h-5" /> },
    { id: 'leads', label: 'Leads', icon: <Users className="w-5 h-5" /> },
  ];

  return (
    <div className="flex bg-[#0A0A0B] text-zinc-100 font-sans overflow-hidden" style={{ height: '100dvh' }}>
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

        <div className="p-4 border-t border-zinc-800 space-y-1">
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
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm">{user.username}</span>
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
              initial={{ x: 280 }}
              animate={{ x: 0 }}
              exit={{ x: 280 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 h-full w-64 bg-[#0D0D0E] border-l border-zinc-800 z-50 lg:hidden flex flex-col"
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
                {navItems.filter(item => ['dashboard', 'leads'].includes(item.id)).map(item => (
                  <NavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    active={activeTab === item.id}
                    onClick={() => { setActiveTab(item.id as any); setIsMobileMenuOpen(false); }}
                  />
                ))}
              </nav>
              <div className="p-4 border-t border-zinc-800 space-y-1">
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
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm">{user.username}</span>
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
            <h1 className="text-lg font-bold">{navItems.find(n => n.id === activeTab)?.label || 'Settings'}</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Auto-Pilot Switch */}
            <div className="flex items-center gap-1.5 sm:mr-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase hidden sm:inline">Auto-Pilot</span>
              <span className="text-[10px] font-bold text-zinc-500 uppercase sm:hidden">Auto</span>
              <button
                onClick={() => setConfig({ ...config, autoPilotEnabled: !config.autoPilotEnabled })}
                className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 flex items-center ${config.autoPilotEnabled ? 'bg-indigo-600' : 'bg-zinc-700'}`}
              >
                <motion.div
                  animate={{ x: config.autoPilotEnabled ? 22 : 2 }}
                  className="w-4 h-4 bg-white rounded-full absolute"
                />
              </button>
            </div>

            {/* WhatsApp LED */}
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${serviceStatus.whatsapp.connected ? 'bg-emerald-500 animate-pulse' : serviceStatus.whatsapp.initializing ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
              <span className={`text-[10px] font-medium ${serviceStatus.whatsapp.connected ? 'text-emerald-500' : serviceStatus.whatsapp.initializing ? 'text-amber-500' : 'text-red-500'}`}>
                <span className="sm:hidden">W</span>
                <span className="hidden sm:inline">WA</span>
              </span>
            </div>
            {/* AgentMail LED */}
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${serviceStatus.agentmail.connected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
              <span className={`text-[10px] font-medium ${serviceStatus.agentmail.connected ? 'text-emerald-500' : 'text-zinc-500'}`}>
                <span className="sm:hidden">M</span>
                <span className="hidden sm:inline">Mail</span>
              </span>
            </div>
            {/* Gemini LED */}
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${config.geminiApiKey ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span className={`text-[10px] font-medium ${config.geminiApiKey ? 'text-emerald-500' : 'text-red-500'}`}>
                <span className="sm:hidden">G</span>
                <span className="hidden sm:inline">Gemini</span>
              </span>
            </div>
            {/* Username badge */}
            <div className="hidden sm:flex items-center gap-1.5 bg-zinc-800/60 px-2.5 py-1 rounded-lg">
              <span className="text-[11px] text-zinc-400">{user.username}</span>
            </div>
          </div>
        </header>

        <div className={`flex-1 min-h-0 flex flex-col ${activeTab === 'orchestrator' || activeTab === 'inbox' ? 'overflow-hidden' : 'overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-12'} custom-scrollbar`}>
          <div className="w-full flex-1 flex flex-col p-4 lg:p-8 pb-24 lg:pb-12" style={{ display: activeTab === 'orchestrator' ? 'flex' : 'none' }}>
            <OrchestratorView config={config} tasks={tasks} setTasks={setTasks} />
          </div>
          <div className="w-full flex-1 flex flex-col min-h-0 overflow-hidden p-4 lg:p-8" style={{ display: activeTab === 'inbox' ? 'flex' : 'none' }}>
            <InboxView
              leads={leads}
              selectedLeadId={selectedLeadId}
              setSelectedLeadId={setSelectedLeadId}
              onToggleBot={toggleBotActive}
              onDeleteLead={deleteLead}
            />
          </div>
          <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
            <DashboardView leads={leads} config={config} />
          </div>
          <div style={{ display: activeTab === 'database' ? 'block' : 'none' }}>
            <DatabaseView />
          </div>
          <div style={{ display: activeTab === 'offers' ? 'block' : 'none' }}>
            <OffersView leads={leads} deleteLeads={deleteLeads} />
          </div>
          <div style={{ display: activeTab === 'leads' ? 'block' : 'none' }}>
            <LeadsView leads={leads} marketStats={marketStats} selectedLeadId={selectedLeadId} setSelectedLeadId={setSelectedLeadId} onDeleteLead={deleteLead} />
          </div>
          <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }}>
            <SettingsView config={config} setConfig={setConfig} serviceStatus={serviceStatus} configLoaded={configLoaded} />
          </div>
        </div>

        <div className="lg:hidden fixed bottom-0 inset-x-0 h-20 bg-[#0D0D0E]/80 backdrop-blur-xl border-t border-zinc-800 flex items-center justify-around px-4 z-30">
          {navItems.filter(item => ['orchestrator', 'inbox', 'offers', 'database'].includes(item.id)).map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center gap-1 transition-colors ${activeTab === item.id ? 'text-indigo-400' : 'text-zinc-500'}`}
            >
              <div className={`p-2 rounded-xl transition-colors ${activeTab === item.id ? 'bg-indigo-600/10' : ''}`}>
                {item.icon}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center gap-1 transition-colors text-zinc-500 hover:text-indigo-400"
          >
            <div className="p-2 rounded-xl transition-colors">
              <Menu className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium">Meniu</span>
          </button>
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
