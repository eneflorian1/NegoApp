import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Zap, 
  Users, 
  Settings, 
  Search, 
  Plus, 
  Send, 
  Phone, 
  Mail, 
  ExternalLink,
  CheckCircle2,
  Clock,
  MoreVertical,
  Filter,
  ArrowRight,
  TrendingUp,
  BarChart3,
  PieChart,
  AlertCircle,
  X,
  Menu,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Lead, Message, OrchestratorTask, Config, MarketStats } from './types';

// --- Mock Data ---
const MOCK_LEADS: Lead[] = [
  {
    id: '1',
    url: 'https://www.olx.ro/d/oferta/iphone-15-pro-max-IDkk',
    title: 'iPhone 15 Pro Max 256GB',
    price: '4500 lei',
    sellerName: 'Andrei M.',
    phoneNumber: '0723 456 789',
    isSaved: true,
    status: 'negotiating',
    lastContacted: '2026-03-15T12:30:00Z',
    platform: 'olx',
    createdAt: '2026-03-15T10:00:00Z',
    marketValue: '4800 lei',
    dealRating: 'great',
    aiSuggestion: 'Salut! Sunt interesat de iPhone. Arati foarte bine in poze. Accepti 4200 lei cash astazi?',
    lastMessage: 'Vanzatorul a acceptat oferta de 4300 lei. Astept confirmarea locatiei.'
  },
  {
    id: '2',
    url: 'https://www.olx.ro/d/oferta/laptop-gaming-asus-IDjj',
    title: 'Laptop Gaming ASUS ROG Strix',
    price: '3200 lei',
    sellerName: 'Elena P.',
    phoneNumber: '0744 112 233',
    isSaved: false,
    status: 'new',
    platform: 'olx',
    createdAt: '2026-03-15T11:15:00Z',
    marketValue: '3100 lei',
    dealRating: 'fair',
    aiSuggestion: 'Buna ziua! Mai este valabil laptopul? Se poate vedea in Bucuresti?',
    lastMessage: 'Mesaj initial trimis. Se asteapta raspuns de la vanzator.'
  },
  {
    id: '3',
    url: 'https://www.olx.ro/d/oferta/sony-ps5-slim-IDzz',
    title: 'Sony PS5 Slim + 2 Jocuri',
    price: '1900 lei',
    sellerName: 'Marius T.',
    phoneNumber: '0722 999 888',
    isSaved: true,
    status: 'closed',
    platform: 'olx',
    createdAt: '2026-03-14T15:00:00Z',
    marketValue: '2100 lei',
    dealRating: 'great',
    lastMessage: 'Tranzactie finalizata cu succes la pretul de 1850 lei.'
  }
];

const MOCK_MESSAGES: Message[] = [
  { id: '1', leadId: '1', sender: 'me', text: 'Salut! Mai este valabil anuntul?', timestamp: '2026-03-15T12:00:00Z', channel: 'whatsapp' },
  { id: '2', leadId: '1', sender: 'seller', text: 'Salut! Da, este inca disponibil.', timestamp: '2026-03-15T12:05:00Z', channel: 'whatsapp' },
  { id: '3', leadId: '1', sender: 'me', text: 'Care este ultimul pret?', timestamp: '2026-03-15T12:10:00Z', channel: 'whatsapp' },
];

const MOCK_MARKET_STATS: MarketStats[] = [
  {
    id: '1',
    query: 'Huawei P80',
    averagePrice: 3200,
    minPrice: 2800,
    maxPrice: 4500,
    totalListings: 142,
    priceDistribution: [
      { range: '2800-3000', count: 45 },
      { range: '3000-3500', count: 68 },
      { range: '3500-4000', count: 20 },
      { range: '4000+', count: 9 },
    ],
    topDeals: [MOCK_LEADS[0]],
    lastUpdated: new Date().toISOString()
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inbox' | 'orchestrator' | 'leads' | 'database' | 'settings'>('inbox');
  const [leads] = useState<Lead[]>(MOCK_LEADS);
  const [marketStats] = useState<MarketStats[]>(MOCK_MARKET_STATS);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(MOCK_LEADS[0].id);
  const [tasks, setTasks] = useState<OrchestratorTask[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [config, setConfig] = useState<Config>({
    agentMailApiKey: '',
    whatsappConnected: true,
    autoPilotEnabled: false,
    requestLocationConfirmation: true,
    meetingAddress: 'Piata Unirii, Bucuresti',
    autosendAddress: false
  });

  const navItems = [
    { id: 'inbox', label: 'Inbox', icon: <MessageSquare className="w-5 h-5" /> },
    { id: 'orchestrator', label: 'Orchestrator', icon: <Zap className="w-5 h-5" /> },
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
          <NavItem 
            icon={<Settings className="w-5 h-5" />} 
            label="Settings" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
          />
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-[#0D0D0E] z-50 lg:hidden border-r border-zinc-800 flex flex-col"
            >
              <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 text-white fill-white" />
                  </div>
                  <span className="font-bold text-xl tracking-tight">NegoFlow</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-zinc-500">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex-1 px-4 py-2 space-y-1">
                <p className="px-4 text-[10px] uppercase font-bold text-zinc-600 mb-2 tracking-widest">Main Menu</p>
                {navItems.map(item => (
                  <NavItem 
                    key={item.id}
                    icon={item.icon} 
                    label={item.label} 
                    active={activeTab === item.id} 
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setIsMobileMenuOpen(false);
                    }} 
                  />
                ))}
                
                <div className="pt-6">
                  <p className="px-4 text-[10px] uppercase font-bold text-zinc-600 mb-2 tracking-widest">Future Tabs</p>
                  <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-600 cursor-not-allowed">
                    <Plus className="w-5 h-5" />
                    <span>Add New Tab</span>
                  </button>
                </div>
              </nav>

              <div className="p-4 border-t border-zinc-800">
                <NavItem 
                  icon={<Settings className="w-5 h-5" />} 
                  label="Settings" 
                  active={activeTab === 'settings'} 
                  onClick={() => {
                    setActiveTab('settings');
                    setIsMobileMenuOpen(false);
                  }} 
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-4 lg:px-8 bg-[#0D0D0E]/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-medium capitalize">{activeTab}</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-emerald-500">WhatsApp Active</span>
            </div>
            <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-8 pb-24 lg:pb-8">
          <AnimatePresence mode="wait">
            {activeTab === 'inbox' && <InboxView key="inbox" leads={leads} selectedLeadId={selectedLeadId} setSelectedLeadId={setSelectedLeadId} />}
            {activeTab === 'orchestrator' && <OrchestratorView key="orchestrator" tasks={tasks} setTasks={setTasks} />}
            {activeTab === 'dashboard' && <DashboardView key="dashboard" leads={leads} config={config} />}
            {activeTab === 'database' && <DatabaseView key="database" leads={leads} />}
            {activeTab === 'leads' && <LeadsView key="leads" leads={leads} marketStats={marketStats} selectedLeadId={selectedLeadId} setSelectedLeadId={setSelectedLeadId} />}
            {activeTab === 'settings' && <SettingsView key="settings" config={config} setConfig={setConfig} />}
          </AnimatePresence>
        </div>

        <div className="lg:hidden fixed bottom-0 inset-x-0 h-20 bg-[#0D0D0E]/80 backdrop-blur-xl border-t border-zinc-800 flex items-center justify-around px-4 z-30">
          {navItems.map(item => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center gap-1 transition-colors ${
                activeTab === item.id ? 'text-indigo-400' : 'text-zinc-500'
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

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, key?: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        active 
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

const getStatusStyle = (status: Lead['status']) => {
  switch (status) {
    case 'new':
      return 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]';
    case 'negotiating':
      return 'bg-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.3)]';
    case 'contacted':
      return 'bg-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.3)]';
    case 'closed':
      return 'bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]';
    default:
      return 'bg-zinc-500 text-white';
  }
};

const parsePrice = (priceStr: string) => {
  const match = priceStr.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

function DashboardView({ leads, config }: { leads: Lead[], config: Config, key?: string }) {
  const negotiatingValue = leads
    .filter(l => l.status === 'negotiating')
    .reduce((acc, curr) => acc + parsePrice(curr.price), 0);
  
  const closedValue = leads
    .filter(l => l.status === 'closed')
    .reduce((acc, curr) => acc + parsePrice(curr.price), 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      {/* Financial Mini Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        <div className="glass-panel rounded-2xl p-6 border-l-4 border-l-indigo-500 bg-gradient-to-r from-indigo-500/10 to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-400 font-medium uppercase tracking-wider">În Negociere</p>
              <p className="text-3xl font-bold mt-1 text-white">{negotiatingValue.toLocaleString()} <span className="text-sm font-normal text-zinc-500">lei</span></p>
            </div>
            <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-6 border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-500/10 to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-400 font-medium uppercase tracking-wider">Finalizat (Closed)</p>
              <p className="text-3xl font-bold mt-1 text-white">{closedValue.toLocaleString()} <span className="text-sm font-normal text-zinc-500">lei</span></p>
            </div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-purple-400" />
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

function StatCard({ label, value, trend, icon, rotate }: { label: string, value: string, trend?: string, icon: React.ReactNode, rotate?: number }) {
  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-zinc-800 rounded-lg" style={{ transform: rotate ? `rotate(${rotate}deg)` : 'none' }}>{icon}</div>
        {trend && <span className="text-xs text-emerald-500 font-medium">{trend}</span>}
      </div>
      <p className="text-zinc-500 text-sm">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function InboxView({ leads, selectedLeadId, setSelectedLeadId }: { leads: Lead[], selectedLeadId: string | null, setSelectedLeadId: (id: string) => void, key?: string }) {
  const [messageText, setMessageText] = useState('');
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const selectedLead = leads.find(l => l.id === selectedLeadId);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full -m-4 lg:-m-8"
    >
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
            <button 
              key={lead.id}
              onClick={() => {
                setSelectedLeadId(lead.id);
                setIsMobileChatOpen(true);
              }}
              className={`w-full p-4 flex gap-3 border-b border-zinc-800/50 transition-colors ${
                selectedLeadId === lead.id ? 'bg-indigo-600/5 border-l-2 border-l-indigo-500' : 'hover:bg-zinc-800/30'
              }`}
            >
              <div className="w-12 h-12 bg-zinc-800 rounded-full flex-shrink-0 flex items-center justify-center text-lg font-bold text-indigo-400">
                {lead.sellerName[0]}
              </div>
              <div className="flex-1 text-left overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="font-medium truncate text-sm">{lead.sellerName}</span>
                  <span className="text-[10px] text-zinc-600 whitespace-nowrap ml-2">12:05 PM</span>
                </div>
                <p className="text-[11px] text-indigo-400 font-medium truncate mt-0.5">{lead.title}</p>
                
                {/* Status Contact Badge */}
                <div className="mt-1.5 flex items-center justify-between">
                  <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded shadow-sm ${getStatusStyle(lead.status)}`}>
                    {lead.status}
                  </span>
                  <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <MessageSquare className="w-2.5 h-2.5" /> WhatsApp
                  </p>
                </div>

                {/* Lead Description / Last Message */}
                {lead.lastMessage && (
                  <p className="text-[10px] text-zinc-500 mt-2 line-clamp-2 italic leading-relaxed border-l border-zinc-800 pl-2">
                    "{lead.lastMessage}"
                  </p>
                )}
              </div>
            </button>
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
                  <div className="text-xs text-zinc-500 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Online
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400"><Phone className="w-5 h-5" /></button>
                <button className="hidden sm:block p-2 hover:bg-zinc-800 rounded-lg text-zinc-400"><Mail className="w-5 h-5" /></button>
                <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400"><MoreVertical className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6 space-y-4">
              {MOCK_MESSAGES.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] lg:max-w-[70%] p-4 rounded-2xl ${
                    msg.sender === 'me' 
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
              {selectedLead.aiSuggestion && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setMessageText(selectedLead.aiSuggestion || '')}
                    className="flex-1 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 py-2 px-4 rounded-xl text-xs font-medium flex items-center justify-center gap-2 hover:bg-indigo-600/20 transition-colors"
                  >
                    <Zap className="w-3 h-3 fill-indigo-400" /> <span className="truncate">Use AI: "{selectedLead.aiSuggestion.substring(0, 30)}..."</span>
                  </button>
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

function OrchestratorView({ tasks, setTasks }: { tasks: OrchestratorTask[], setTasks: React.Dispatch<React.SetStateAction<OrchestratorTask[]>>, key?: string }) {
  const [url, setUrl] = useState('');

  const handleStart = () => {
    if (!url) return;
    const newTask: OrchestratorTask = {
      id: Math.random().toString(36).substr(2, 9),
      categoryUrl: url,
      status: 'running',
      leadsFound: 0,
      leadsContacted: 0,
      progress: 0,
      createdAt: new Date().toISOString()
    };
    setTasks([newTask, ...tasks]);
    setUrl('');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="glass-panel rounded-3xl p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600/20 rounded-2xl flex items-center justify-center">
            <Zap className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Autonomous Orchestrator</h2>
            <p className="text-zinc-500">Deploy an agent to process entire categories. It will extract, analyze, and negotiate with every compliant listing.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input 
            type="text" 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste OLX Category URL" 
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-6 focus:outline-none focus:border-indigo-500 transition-colors text-base sm:text-lg"
          />
          <button 
            onClick={handleStart}
            className="px-8 py-4 sm:py-0 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
          >
            Deploy Agent
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <div className="p-4 bg-zinc-800/30 rounded-2xl border border-zinc-800/50 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold">Auto-Extraction</p>
              <p className="text-xs">Scans all pages (up to 500+)</p>
            </div>
          </div>
          <div className="p-4 bg-zinc-800/30 rounded-2xl border border-zinc-800/50 flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold">Market Validation</p>
              <p className="text-xs">Real-time price comparison</p>
            </div>
          </div>
          <div className="p-4 bg-zinc-800/30 rounded-2xl border border-zinc-800/50 flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold">Smart Negotiation</p>
              <p className="text-xs">AI-driven WhatsApp/Email</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium px-2">Active Missions</h3>
        {tasks.length === 0 ? (
          <div className="p-12 glass-panel rounded-3xl text-center text-zinc-600">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No active missions. Deploy your first agent above.</p>
          </div>
        ) : (
          tasks.map(task => (
            <div key={task.id} className="glass-panel rounded-2xl p-6 space-y-4 relative group">
              <button 
                onClick={() => setTasks(tasks.filter(t => t.id !== task.id))}
                className="absolute top-4 right-4 p-2 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center justify-between pr-8">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping flex-shrink-0" />
                  <span className="font-medium truncate text-sm">{task.categoryUrl}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                    {task.status}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
                  <p className="text-xl font-bold">{task.leadsFound}</p>
                  <p className="text-[10px] text-zinc-500 uppercase">Listings Scanned</p>
                </div>
                <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
                  <p className="text-xl font-bold">{task.leadsContacted}</p>
                  <p className="text-[10px] text-zinc-500 uppercase">Compliant & Contacted</p>
                </div>
                <div className="col-span-2 flex flex-col justify-center bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
                  <div className="flex justify-between mb-2">
                    <p className="text-[10px] text-zinc-500 uppercase">Mission Progress</p>
                    <p className="text-[10px] text-indigo-400 font-bold">Processing Page 1/25</p>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '15%' }}
                      className="h-full bg-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

function DatabaseView({ leads, key }: { leads: Lead[], key?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Extraction Database</h2>
          <p className="text-zinc-500">Raw data and metadata extracted from marketplace listings.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {leads.map(lead => (
          <div key={lead.id} className="glass-panel rounded-2xl p-6 border-l-4 border-l-indigo-500">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-bold text-lg">{lead.title}</h4>
                <p className="text-xs text-zinc-500 font-mono">{lead.url}</p>
              </div>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-zinc-800 rounded text-[10px] uppercase font-bold text-zinc-400">ID: {lead.id}</span>
                <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${lead.isSaved ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                  {lead.isSaved ? 'DATABASE SYNCED' : 'PENDING SAVE'}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Seller Data</p>
                <p className="text-sm">{lead.sellerName}</p>
                <p className="text-xs text-indigo-400 font-mono mt-1">{lead.isSaved ? lead.phoneNumber : 'REDACTED'}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Financials</p>
                <p className="text-sm font-bold">{lead.price}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-zinc-600">Market: {lead.marketValue || 'N/A'}</span>
                  {lead.dealRating && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      lead.dealRating === 'great' ? 'bg-emerald-500/10 text-emerald-500' : 
                      lead.dealRating === 'fair' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                    }`}>
                      {lead.dealRating} deal
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Extraction Log</p>
                <p className="text-xs text-zinc-400 italic">Success: 200 OK</p>
                <p className="text-[10px] text-zinc-600 mt-1">{new Date(lead.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex items-end justify-end">
                <button className="text-xs text-indigo-400 hover:underline flex items-center gap-1">
                  View Raw JSON <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function LeadsView({ leads, marketStats, selectedLeadId, setSelectedLeadId }: { leads: Lead[], marketStats: MarketStats[], selectedLeadId: string | null, setSelectedLeadId: (id: string) => void, key?: string }) {
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
                  className={`cursor-pointer transition-colors ${
                    selectedLeadId === lead.id ? 'bg-indigo-600/10' : 'hover:bg-zinc-800/20'
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
                    <span className={`text-[9px] uppercase font-black px-2 py-1 rounded-md shadow-sm ${getStatusStyle(lead.status)}`}>
                      {lead.status}
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
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                        selectedLead.dealRating === 'great' ? 'bg-emerald-500/10 text-emerald-500' : 
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

function SettingsView({ config, setConfig }: { config: Config, setConfig: React.Dispatch<React.SetStateAction<Config>>, key?: string }) {
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 1000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto space-y-8 pb-12"
    >
      <div className="glass-panel rounded-3xl p-8 space-y-8 relative overflow-hidden">
        <AnimatePresence>
          {showSuccess && (
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="absolute top-0 left-0 right-0 bg-emerald-500/20 border-b border-emerald-500/30 py-3 px-6 flex items-center justify-center gap-2 z-10 backdrop-blur-md"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Configuration Saved Successfully</span>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-400" /> AgentMail API
          </h3>
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 uppercase font-bold">API Key</label>
            <input 
              type="password" 
              value={config.agentMailApiKey}
              onChange={(e) => setConfig({...config, agentMailApiKey: e.target.value})}
              placeholder="am_live_..." 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
            />
            <p className="text-[10px] text-zinc-600">Used for autonomous email negotiations and follow-ups.</p>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" /> WhatsApp Connection
          </h3>
          <div className="p-6 bg-zinc-800/30 rounded-2xl border border-zinc-800/50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="font-medium">Device Connected</p>
                <p className="text-xs text-zinc-500">Last synced: 2 minutes ago</p>
              </div>
            </div>
            <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors">Disconnect</button>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-400" /> Automation Preferences
          </h3>
          <div className="flex items-center justify-between p-4 bg-zinc-800/30 rounded-xl border border-zinc-800/50">
            <div>
              <p className="font-medium">Auto-Pilot Mode</p>
              <p className="text-xs text-zinc-500">Allow agent to contact sellers without approval</p>
            </div>
            <button 
              onClick={() => setConfig({...config, autoPilotEnabled: !config.autoPilotEnabled})}
              className={`w-12 h-6 rounded-full relative transition-colors ${config.autoPilotEnabled ? 'bg-indigo-600' : 'bg-zinc-700'}`}
            >
              <motion.div 
                animate={{ x: config.autoPilotEnabled ? 26 : 4 }}
                className="w-4 h-4 bg-white rounded-full absolute top-1" 
              />
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" /> Negotiation Preferences
          </h3>
          <div className="flex items-center justify-between p-4 bg-zinc-800/30 rounded-xl border border-zinc-800/50">
            <div>
              <p className="font-medium text-sm">Request location confirmation</p>
              <p className="text-xs text-zinc-500">Ask for location after offer is accepted</p>
            </div>
            <button 
              onClick={() => setConfig({...config, requestLocationConfirmation: !config.requestLocationConfirmation})}
              className={`w-12 h-6 rounded-full relative transition-colors ${config.requestLocationConfirmation ? 'bg-indigo-600' : 'bg-zinc-700'}`}
            >
              <motion.div 
                animate={{ x: config.requestLocationConfirmation ? 26 : 4 }}
                className="w-4 h-4 bg-white rounded-full absolute top-1" 
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-zinc-800/30 rounded-xl border border-zinc-800/50">
            <div>
              <p className="font-medium text-sm">Autosend Address</p>
              <p className="text-xs text-zinc-500">Automatically send meeting location when deal is reached</p>
            </div>
            <button 
              onClick={() => setConfig({...config, autosendAddress: !config.autosendAddress})}
              className={`w-12 h-6 rounded-full relative transition-colors ${config.autosendAddress ? 'bg-indigo-600' : 'bg-zinc-700'}`}
            >
              <motion.div 
                animate={{ x: config.autosendAddress ? 26 : 4 }}
                className="w-4 h-4 bg-white rounded-full absolute top-1" 
              />
            </button>
          </div>

          {(config.requestLocationConfirmation || config.autosendAddress) && (
            <div className="space-y-2 p-4 bg-zinc-800/20 rounded-xl border border-zinc-800/30">
              <label className="text-[10px] text-zinc-500 uppercase font-bold">Default Meeting Address</label>
              <input 
                type="text" 
                value={config.meetingAddress}
                onChange={(e) => setConfig({...config, meetingAddress: e.target.value})}
                placeholder="e.g. Piata Unirii, Bucuresti" 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <p className="text-[10px] text-zinc-600">This address will be used when "Request location confirmation" or "Autosend Address" is active.</p>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" /> Blacklist & Filtering
          </h3>
          <div className="space-y-3">
            <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-800/50 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Block Professional Sellers</span>
                <button className="w-10 h-5 bg-indigo-600 rounded-full relative">
                  <div className="w-3 h-3 bg-white rounded-full absolute top-1 right-1" />
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase font-bold">Negative Keywords</label>
                <input 
                  type="text" 
                  defaultValue="nu negociez, pret fix, fara schimburi" 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          </div>
        </section>

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full py-4 rounded-2xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${
            isSaving ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
          }`}
        >
          {isSaving ? (
            <>
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-400 rounded-full"
              />
              Saving...
            </>
          ) : (
            'Save Configuration'
          )}
        </button>
      </div>
    </motion.div>
  );
}

