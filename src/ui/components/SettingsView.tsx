import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Zap, Phone, Mail, CheckCircle2, MessageSquare, TrendingUp, AlertCircle, Loader2, QrCode, Wifi, WifiOff, ChevronDown, RefreshCcw, Plus, Trash2, Pencil, X, Check, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Config, ServiceStatus, CustomScenario } from '../types';
import { SCENARIOS } from '../constants/scenarios';

interface SettingsViewProps {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
  serviceStatus?: ServiceStatus;
  configLoaded?: boolean;
}

export default function SettingsView({ config, setConfig, serviceStatus, configLoaded = true }: SettingsViewProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [waQR, setWaQR] = useState<string | null>(null);
  const [waConnecting, setWaConnecting] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);
  const [waPairPhone, setWaPairPhone] = useState('');
  const [waPairCode, setWaPairCode] = useState<string | null>(null);
  const [waPairing, setWaPairing] = useState(false);
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);
  const [newScenarioName, setNewScenarioName] = useState('');
  const [showAddScenario, setShowAddScenario] = useState(false);
  
  // OLX Session States
  const [olxEmail, setOlxEmail] = useState('');
  const [olxPassword, setOlxPassword] = useState('');
  const [olxConnecting, setOlxConnecting] = useState(false);
  const [olxStatus, setOlxStatus] = useState<{ valid: boolean; cookieCount?: number; loginDate?: string; expiresAt?: string } | null>(null);
  const [olxError, setOlxError] = useState<string | null>(null);

  const isFirstRender = React.useRef(true);

  // Merge default scenarios with user custom scenarios
  const allScenarios = useMemo(() => {
    const custom = (config.customScenarios || []).map(s => ({ ...s }));
    return [...SCENARIOS, ...custom];
  }, [config.customScenarios]);

  // Auto-save config when it changes (debounced)
  useEffect(() => {
    if (!configLoaded) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      fetch('/api/config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      }).then(() => {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
      }).catch(err => console.error('Auto-save failed:', err));
    }, 800);
    return () => clearTimeout(timeout);
  }, [config, configLoaded]);

  // Poll QR code when connecting
  useEffect(() => {
    if (!waConnecting) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/whatsapp/qr', { credentials: 'include' });
        const data = await res.json();
        if (data.qr && !waPairCode) setWaQR(data.qr);
        if (data.status?.pairingCode && waPairCode !== data.status.pairingCode) {
          setWaPairCode(data.status.pairingCode);
        }
        if (data.status?.connected) {
          setWaConnecting(false);
          setWaQR(null);
          setWaPairCode(null);
          setWaError(null);
        }
        // Detect initialization failure
        if (data.status?.error && !data.status?.initializing && !data.status?.connected) {
          setWaConnecting(false);
          setWaQR(null);
          setWaPairCode(null);
          setWaError(data.status.error);
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [waConnecting, waPairCode]);

  // Load OLX Status
  useEffect(() => {
    fetch('/api/session/olx/status', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setOlxStatus(data))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/config', { credentials: 'include', 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleWhatsAppConnect = async () => {
    setWaConnecting(true);
    setWaQR(null);
    setWaError(null);
    try {
      const res = await fetch('/api/whatsapp/connect', { credentials: 'include',  method: 'POST' });
      const data = await res.json();
      if (data.status === 'error') {
        setWaConnecting(false);
        setWaError(data.error || 'Connection failed');
      }
    } catch (err) {
      console.error('WhatsApp connect error:', err);
      setWaConnecting(false);
      setWaError('Network error connecting to WhatsApp');
    }
  };

  const handleWhatsAppDisconnect = async () => {
    try {
      await fetch('/api/whatsapp/disconnect', { credentials: 'include',  method: 'POST' });
      setWaQR(null);
      setWaPairCode(null);
      setWaConnecting(false);
    } catch (err) {
      console.error('WhatsApp disconnect error:', err);
    }
  };

  const handleRequestPairingCode = async () => {
    if (!waPairPhone) return;
    setWaPairing(true);
    setWaError(null);
    try {
      const res = await fetch('/api/whatsapp/pair', { credentials: 'include', 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: waPairPhone }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setWaPairCode(data.code);
      } else {
        setWaError(data.error || 'Failed to request code');
      }
    } catch (err) {
      setWaError('Network error requesting pairing code');
    } finally {
      setWaPairing(false);
    }
  };

  const handleOlxLogin = async () => {
    if (!olxEmail || !olxPassword) {
      setOlxError('Completează adresa de email și parola');
      return;
    }
    setOlxConnecting(true);
    setOlxError(null);
    try {
      const res = await fetch('/api/session/olx/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: olxEmail, password: olxPassword })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setOlxError(data.error || 'Autentificare eșuată');
      } else {
        // Refresh status
        const statusRes = await fetch('/api/session/olx/status', { credentials: 'include' });
        const statusData = await statusRes.json();
        setOlxStatus(statusData);
        setOlxEmail('');
        setOlxPassword('');
      }
    } catch (err: any) {
      setOlxError(err.message || 'Eroare de rețea. Verifică serverul.');
    } finally {
      setOlxConnecting(false);
    }
  };

  const waStatus = serviceStatus?.whatsapp;
  const isWaConnected = waStatus?.connected || false;

  const handleScenarioChange = (channel: 'whatsapp' | 'email', scenarioId: string) => {
    const scenario = allScenarios.find(s => s.id === scenarioId);
    if (!scenario) return;
    
    if (channel === 'whatsapp') {
      setConfig({ 
        ...config, 
        whatsappSystemPrompt: scenario.whatsappPrompt,
        whatsappScenario: scenarioId
      });
    } else {
      setConfig({ 
        ...config, 
        emailSystemPrompt: scenario.emailPrompt,
        emailScenario: scenarioId
      });
    }
  };

  const handleAddCustomScenario = () => {
    if (!newScenarioName.trim()) return;
    const newScenario: CustomScenario = {
      id: `custom-${Date.now()}`,
      label: newScenarioName.trim(),
      icon: '✨',
      whatsappPrompt: '',
      emailPrompt: '',
    };
    setConfig({
      ...config,
      customScenarios: [...(config.customScenarios || []), newScenario],
    });
    setNewScenarioName('');
    setShowAddScenario(false);
    setEditingScenarioId(newScenario.id);
  };

  const handleDeleteCustomScenario = (id: string) => {
    const updated = (config.customScenarios || []).filter(s => s.id !== id);
    const patch: Partial<Config> = { customScenarios: updated };
    // If the deleted scenario was selected, fallback to 'universal'
    if (config.whatsappScenario === id) {
      const uni = SCENARIOS.find(s => s.id === 'universal')!;
      patch.whatsappScenario = 'universal';
      patch.whatsappSystemPrompt = uni.whatsappPrompt;
    }
    if (config.emailScenario === id) {
      const uni = SCENARIOS.find(s => s.id === 'universal')!;
      patch.emailScenario = 'universal';
      patch.emailSystemPrompt = uni.emailPrompt;
    }
    setConfig({ ...config, ...patch });
    if (editingScenarioId === id) setEditingScenarioId(null);
  };

  const handleUpdateCustomScenario = (id: string, field: keyof CustomScenario, value: string) => {
    const updated = (config.customScenarios || []).map(s =>
      s.id === id ? { ...s, [field]: value } : s
    );
    setConfig({ ...config, customScenarios: updated });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto space-y-6 sm:space-y-8 pb-32 lg:pb-12"
    >
      <div className="glass-panel rounded-[2rem] p-5 sm:p-8 space-y-8 relative overflow-hidden">
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="absolute top-0 left-0 right-0 bg-emerald-500/20 border-b border-emerald-500/30 py-3 px-6 flex items-center justify-center gap-2 z-10 backdrop-blur-md"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Auto-saved</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Gemini AI ── */}
        <section className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" /> Gemini AI
            <div className={`ml-auto w-2.5 h-2.5 rounded-full ${config.geminiApiKey && config.geminiApiKey.length > 5 ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
          </h3>
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 uppercase font-bold">API Key</label>
            <input
              type="password"
              value={config.geminiApiKey}
              onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value })}
              placeholder="AIzaSy..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
            />
            <p className="text-[10px] text-zinc-600">Google Gemini API key for AI auto-replies on WhatsApp and Email. Get one from Google AI Studio.</p>
          </div>
        </section>

        {/* ── AgentMail ── */}
        <section className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-400" /> AgentMail API
            <div className={`ml-auto w-2.5 h-2.5 rounded-full ${serviceStatus?.agentmail?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
          </h3>
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 uppercase font-bold">API Key</label>
            <input
              type="password"
              value={config.agentMailApiKey}
              onChange={(e) => setConfig({ ...config, agentMailApiKey: e.target.value })}
              placeholder="am_live_..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
            />
            <p className="text-[10px] text-zinc-600">Used for autonomous email negotiations and follow-ups. Saved to server on Save.</p>
            {serviceStatus?.agentmail?.error && (
              <p className="text-[10px] text-red-400 mt-1">{serviceStatus.agentmail.error}</p>
            )}
          </div>
          <div className="space-y-4 mt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <label className="text-xs text-zinc-500 uppercase font-bold">Email Agent Instructions</label>
              <div className="relative inline-block text-left w-full sm:w-auto">
                <select 
                  value={config.emailScenario || 'universal'} 
                  onChange={(e) => handleScenarioChange('email', e.target.value)}
                  className="w-full sm:w-auto appearance-none bg-zinc-800 border border-zinc-700 rounded-lg py-1.5 pl-3 pr-8 text-xs font-medium text-zinc-300 focus:outline-none focus:border-indigo-500 transition-all cursor-pointer hover:bg-zinc-700"
                >
                  {SCENARIOS.map(s => (
                    <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
                  ))}
                  {(config.customScenarios || []).length > 0 && (
                    <option disabled>── Custom ──</option>
                  )}
                  {(config.customScenarios || []).map(s => (
                    <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
              </div>
            </div>
            
            <p className="text-[10px] text-zinc-600">Instruct the AI on how to respond to emails — tone, negotiation style, language preferences. The agent will follow these instructions when composing email replies.</p>
            
            <div className="relative group">
              <textarea
                value={config.emailSystemPrompt}
                onChange={(e) => setConfig({ ...config, emailSystemPrompt: e.target.value })}
                placeholder={"Ești un agent AI expert în negociere și cumpărare de produse/servicii..."}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 transition-colors text-sm min-h-[120px] resize-y custom-scrollbar"
              />
              <button 
                onClick={() => handleScenarioChange('email', config.emailScenario || 'universal')}
                className="absolute top-2 right-2 p-1.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg text-zinc-500 hover:text-indigo-400 transition-all opacity-0 group-hover:opacity-100"
                title="Reset to scenario template"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* ── WhatsApp ── */}
        <section className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" /> WhatsApp Connection
            <div className={`ml-auto w-2.5 h-2.5 rounded-full ${isWaConnected ? 'bg-emerald-500 animate-pulse' : waConnecting ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
          </h3>

          {isWaConnected ? (
            /* Connected state */
            <div className="p-6 bg-zinc-800/30 rounded-2xl border border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <Wifi className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="font-medium text-emerald-400">Connected</p>
                  <p className="text-xs text-zinc-500">
                    {waStatus?.name || 'WhatsApp'}{waStatus?.phone ? ` · ${waStatus.phone}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={handleWhatsAppDisconnect}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-sm font-medium text-red-400 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : waConnecting || waQR ? (
            /* QR code state */
            <div className="p-6 bg-zinc-800/30 rounded-2xl border border-amber-500/20 space-y-6">
              <div className="flex items-start gap-4 flex-col lg:flex-row">
                <div className="flex-1 space-y-4 w-full">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                    <div>
                      <p className="font-medium text-amber-400">Waiting for connection...</p>
                      <p className="text-xs text-zinc-500">Scan QR or link with phone number</p>
                    </div>
                  </div>
                  
                  <div className="pt-3 border-t border-zinc-800/50 space-y-3">
                    <p className="text-xs text-zinc-500">Scan QR: WhatsApp pe telefon → <strong className="text-zinc-400">Linked Devices</strong> → <strong className="text-zinc-400">Link a Device</strong> → scanează codul.</p>
                    
                    <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50 space-y-2">
                      <p className="text-xs font-medium text-zinc-400">Ești deja pe telefon? Conectează fără a scana QR</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={waPairPhone}
                          onChange={(e) => setWaPairPhone(e.target.value)}
                          placeholder="Prefix+Număr (ex: 407XXXXXXXX)"
                          disabled={waPairing}
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 px-3 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                        />
                        <button
                          onClick={handleRequestPairingCode}
                          disabled={waPairing || !waPairPhone || !!waPairCode}
                          className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-sm font-medium text-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center min-w-[100px]"
                        >
                          {waPairing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generează Cod'}
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-500 leading-tight">Introduci numărul tău de WhatsApp și primești un cod cu care te conectezi din secțiunea "Link with phone number" ("Asociază număr de telefon") din WhatsApp.</p>
                    </div>
                  </div>
                </div>

                <div className="hidden lg:block w-px self-stretch bg-zinc-800/50 mx-2" />

                {/* QR Code Section */}
                <div className="flex flex-col items-center justify-center space-y-2 lg:w-64 self-center w-full pt-4 lg:pt-0 border-t lg:border-t-0 border-zinc-800/50">
                  {waPairCode ? (
                    <div className="w-56 h-56 flex flex-col items-center justify-center bg-zinc-900 rounded-xl border border-amber-500/50 space-y-3 p-4 text-center">
                      <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center">
                        <Phone className="w-5 h-5 text-amber-500" />
                      </div>
                      <p className="text-xs font-medium text-amber-400">Introdu codul în WhatsApp</p>
                      <div className="text-2xl font-mono tracking-widest text-white font-bold bg-zinc-800 px-4 py-2 rounded-lg border border-zinc-700 shadow-inner">
                        {waPairCode}
                      </div>
                      <p className="text-[10px] text-zinc-500 px-2 mt-2">Notificare din WhatsApp pe telefon: "Introduceți codul" / "Asociați".</p>
                    </div>
                  ) : waQR ? (
                    <div className="bg-white p-3 rounded-xl shadow-lg border border-zinc-200">
                      <img src={waQR} alt="WhatsApp QR Code" className="w-56 h-56" />
                    </div>
                  ) : (
                    <div className="w-56 h-56 flex flex-col items-center justify-center bg-zinc-900 rounded-xl border border-zinc-800 border-dashed gap-3">
                      <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
                      <span className="text-xs text-zinc-600 font-medium tracking-wide">Pregătire conexiune...</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => { setWaConnecting(false); setWaQR(null); setWaPairCode(null); }}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-400 transition-colors"
              >
                Cancel Connection
              </button>
            </div>
          ) : (
            /* Disconnected state */
            <div className="p-6 bg-zinc-800/30 rounded-2xl border border-zinc-800/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                  <WifiOff className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <p className="font-medium text-zinc-300">Not Connected</p>
                  <p className="text-xs text-zinc-500">Connect to send WhatsApp messages</p>
                  {(waError || waStatus?.error) && (
                    <p className="text-[10px] text-red-400 mt-1">{waError || waStatus.error}</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleWhatsAppConnect}
                className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-sm font-medium text-emerald-400 transition-colors"
              >
                Connect
              </button>
            </div>
          )}

          <div className="space-y-4 mt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <label className="text-xs text-zinc-500 uppercase font-bold">WhatsApp Agent Instructions</label>
              <div className="relative inline-block text-left w-full sm:w-auto">
                <select 
                  value={config.whatsappScenario || 'universal'} 
                  onChange={(e) => handleScenarioChange('whatsapp', e.target.value)}
                  className="w-full sm:w-auto appearance-none bg-zinc-800 border border-zinc-700 rounded-lg py-1.5 pl-3 pr-8 text-xs font-medium text-zinc-300 focus:outline-none focus:border-indigo-500 transition-all cursor-pointer hover:bg-zinc-700"
                >
                  {SCENARIOS.map(s => (
                    <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
                  ))}
                  {(config.customScenarios || []).length > 0 && (
                    <option disabled>── Custom ──</option>
                  )}
                  {(config.customScenarios || []).map(s => (
                    <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
              </div>
            </div>
            
            <p className="text-[10px] text-zinc-600">Instruct the AI on how to respond to WhatsApp messages — persona, tone, behavior rules. The agent remembers history for context.</p>
            
            <div className="relative group">
              <textarea
                value={config.whatsappSystemPrompt}
                onChange={(e) => setConfig({ ...config, whatsappSystemPrompt: e.target.value })}
                placeholder={"Ești o persoană reală..."}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 transition-colors text-sm min-h-[120px] resize-y custom-scrollbar"
              />
              <button 
                onClick={() => handleScenarioChange('whatsapp', config.whatsappScenario || 'universal')}
                className="absolute top-2 right-2 p-1.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg text-zinc-500 hover:text-indigo-400 transition-all opacity-0 group-hover:opacity-100"
                title="Reset to scenario template"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
        {/* ── OLX Integration ── */}
        <section className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-blue-400" /> OLX Integration
            <div className={`ml-auto w-2.5 h-2.5 rounded-full ${olxStatus?.valid ? 'bg-emerald-500 animate-pulse' : olxConnecting ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
          </h3>

          {olxStatus?.valid ? (
            <div className="p-6 bg-zinc-800/30 rounded-2xl border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="font-medium text-emerald-400">Authenticated (Persistent Session)</p>
                  <p className="text-xs text-zinc-500">
                    {olxStatus.cookieCount} cookies active. Logged in: {new Date(olxStatus.loginDate || Date.now()).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-zinc-400 max-w-[200px] text-left md:text-right leading-tight">
                Phone numbers are fully visible for 100% of OLX listings. The system will use this session automatically.
              </p>
            </div>
          ) : (
            <div className="p-6 bg-zinc-800/30 rounded-2xl border border-zinc-800/50 space-y-4">
              <div className="flex items-start gap-4 mb-2">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
                  <ShoppingBag className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-zinc-300">Autentificare OLX Required</p>
                  <p className="text-[11px] text-zinc-500 leading-snug">
                    Logarea o singură dată este necesară pentru ca scraper-ul să poată extrage 100% din numerele de telefon (altfel OLX ascunde telefoanele la 90% din anunțuri).
                  </p>
                </div>
              </div>

              {olxError && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-[11px] text-red-400">{olxError}</p>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-zinc-500 uppercase font-bold">Email Cont OLX</label>
                  <input
                    type="email"
                    value={olxEmail}
                    onChange={(e) => setOlxEmail(e.target.value)}
                    placeholder="email@example.com"
                    disabled={olxConnecting}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase font-bold">Parolă Cont OLX</label>
                  <input
                    type="password"
                    value={olxPassword}
                    onChange={(e) => setOlxPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={olxConnecting}
                    onKeyDown={(e) => e.key === 'Enter' && handleOlxLogin()}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                  />
                </div>
                
                <button
                  onClick={handleOlxLogin}
                  disabled={olxConnecting || !olxEmail || !olxPassword}
                  className="w-full py-2.5 mt-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
                >
                  {olxConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Se deschide un browser pe ecran (maxim 60s)...
                    </>
                  ) : 'Login & Salvează Sesiunea'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Custom Scenarios ── */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Pencil className="w-5 h-5 text-cyan-400" /> Prompturi Custom
            </h3>
            <button
              onClick={() => setShowAddScenario(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-xs font-medium text-cyan-400 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Adaugă
            </button>
          </div>

          <AnimatePresence>
            {showAddScenario && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-zinc-800/30 rounded-xl border border-cyan-500/20 space-y-3">
                  <label className="text-xs text-zinc-500 uppercase font-bold">Numele Scenariului</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newScenarioName}
                      onChange={(e) => setNewScenarioName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCustomScenario()}
                      placeholder="Ex: Agent Imobiliare Lux"
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                      autoFocus
                    />
                    <button
                      onClick={handleAddCustomScenario}
                      disabled={!newScenarioName.trim()}
                      className="px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-sm font-medium text-cyan-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setShowAddScenario(false); setNewScenarioName(''); }}
                      className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {(config.customScenarios || []).length === 0 && !showAddScenario && (
            <div className="p-6 bg-zinc-800/20 rounded-xl border border-dashed border-zinc-800/50 text-center">
              <p className="text-xs text-zinc-600">Nu ai creat încă niciun prompt custom. Apasă "Adaugă" pentru a crea unul.</p>
            </div>
          )}

          <div className="space-y-3">
            {(config.customScenarios || []).map((scenario) => (
              <motion.div
                key={scenario.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-800/50 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base">{scenario.icon}</span>
                    {editingScenarioId === scenario.id ? (
                      <input
                        type="text"
                        value={scenario.label}
                        onChange={(e) => handleUpdateCustomScenario(scenario.id, 'label', e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 rounded-lg py-1 px-2 text-sm font-medium focus:outline-none focus:border-cyan-500 transition-colors"
                      />
                    ) : (
                      <span className="text-sm font-medium text-zinc-300">{scenario.label}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingScenarioId(editingScenarioId === scenario.id ? null : scenario.id)}
                      className={`p-1.5 rounded-lg transition-colors ${editingScenarioId === scenario.id ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
                      title={editingScenarioId === scenario.id ? 'Închide editarea' : 'Editează'}
                    >
                      {editingScenarioId === scenario.id ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDeleteCustomScenario(scenario.id)}
                      className="p-1.5 hover:bg-red-500/10 rounded-lg text-zinc-500 hover:text-red-400 transition-colors"
                      title="Șterge"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {editingScenarioId === scenario.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 overflow-hidden"
                    >
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold">Prompt WhatsApp</label>
                        <textarea
                          value={scenario.whatsappPrompt}
                          onChange={(e) => handleUpdateCustomScenario(scenario.id, 'whatsappPrompt', e.target.value)}
                          placeholder="Instrucțiuni pentru agentul WhatsApp..."
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:border-cyan-500 transition-colors text-sm min-h-[100px] resize-y custom-scrollbar"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold">Prompt Email</label>
                        <textarea
                          value={scenario.emailPrompt}
                          onChange={(e) => handleUpdateCustomScenario(scenario.id, 'emailPrompt', e.target.value)}
                          placeholder="Instrucțiuni pentru agentul de Email..."
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:border-cyan-500 transition-colors text-sm min-h-[100px] resize-y custom-scrollbar"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Automation ── */}
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
              onClick={() => setConfig({ ...config, autoPilotEnabled: !config.autoPilotEnabled })}
              className={`w-12 h-6 rounded-full relative transition-colors ${config.autoPilotEnabled ? 'bg-indigo-600' : 'bg-zinc-700'}`}
            >
              <motion.div
                animate={{ x: config.autoPilotEnabled ? 26 : 4 }}
                className="w-4 h-4 bg-white rounded-full absolute top-1"
              />
            </button>
          </div>
        </section>

        {/* ── Negotiation ── */}
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
              onClick={() => setConfig({ ...config, requestLocationConfirmation: !config.requestLocationConfirmation })}
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
              <p className="font-medium text-sm">Autosend Delivery Info</p>
              <p className="text-xs text-zinc-500">Automatically send delivery details when deal is reached</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, autosendAddress: !config.autosendAddress })}
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
              <label className="text-[10px] text-zinc-500 uppercase font-bold">Default Delivery Address</label>
              <input
                type="text"
                value={config.meetingAddress}
                onChange={(e) => setConfig({ ...config, meetingAddress: e.target.value })}
                placeholder="e.g. Piata Unirii, Bucuresti"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <p className="text-[10px] text-zinc-600">This address will be used when "Request location confirmation" or "Autosend Delivery Info" is active.</p>
            </div>
          )}
        </section>

        {/* ── Blacklist ── */}
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

        {/* ── YOLO Mode ── */}
        <section className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Zap className="w-5 h-5 text-red-500" /> YOLO Mode Defaults
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-800/50 space-y-3">
              <p className="text-[10px] text-zinc-500 uppercase font-bold">🚗 Auto</p>
              <div className="space-y-1">
                <label className="text-[9px] text-zinc-600 uppercase">Prag Negociere (%)</label>
                <input
                  type="number"
                  value={config.yoloDefaults.autoNegThreshold}
                  onChange={(e) => setConfig({
                    ...config,
                    yoloDefaults: { ...config.yoloDefaults, autoNegThreshold: parseInt(e.target.value) }
                  })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
            </div>
            <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-800/50 space-y-3">
              <p className="text-[10px] text-zinc-500 uppercase font-bold">👕 Modă</p>
              <div className="space-y-1">
                <label className="text-[9px] text-zinc-600 uppercase">Branduri Excluse</label>
                <input
                  type="text"
                  value={config.yoloDefaults.modaExcludedBrands}
                  onChange={(e) => setConfig({
                    ...config,
                    yoloDefaults: { ...config.yoloDefaults, modaExcludedBrands: e.target.value }
                  })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
            </div>
            <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-800/50 space-y-3">
              <p className="text-[10px] text-zinc-500 uppercase font-bold">💻 Electronice</p>
              <div className="space-y-1">
                <label className="text-[9px] text-zinc-600 uppercase">Garanție Minimă (Luni)</label>
                <input
                  type="number"
                  value={config.yoloDefaults.electroniceMinWarrantyMonths}
                  onChange={(e) => setConfig({
                    ...config,
                    yoloDefaults: { ...config.yoloDefaults, electroniceMinWarrantyMonths: parseInt(e.target.value) }
                  })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
            </div>
          </div>
        </section>

        {!configLoaded && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400">Cannot save — server unreachable. Config not loaded.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
