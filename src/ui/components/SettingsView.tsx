import React, { useState, useEffect } from 'react';
import { Settings, Zap, Phone, Mail, CheckCircle2, MessageSquare, TrendingUp, AlertCircle, Loader2, QrCode, Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Config, ServiceStatus } from '../types';

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
  const isFirstRender = React.useRef(true);

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
        const res = await fetch('/api/whatsapp/qr');
        const data = await res.json();
        if (data.qr) setWaQR(data.qr);
        if (data.status?.connected) {
          setWaConnecting(false);
          setWaQR(null);
          setWaError(null);
        }
        // Detect initialization failure
        if (data.status?.error && !data.status?.initializing && !data.status?.connected) {
          setWaConnecting(false);
          setWaQR(null);
          setWaError(data.status.error);
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [waConnecting]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/config', {
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
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
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
      await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      setWaQR(null);
      setWaConnecting(false);
    } catch (err) {
      console.error('WhatsApp disconnect error:', err);
    }
  };

  const waStatus = serviceStatus?.whatsapp;
  const isWaConnected = waStatus?.connected || false;

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
          <div className="space-y-2 mt-4">
            <label className="text-xs text-zinc-500 uppercase font-bold">Email Agent Instructions</label>
            <p className="text-[10px] text-zinc-600">Instruct the AI on how to respond to emails — tone, negotiation style, language preferences. The agent will follow these instructions when composing email replies.</p>
            <textarea
              value={config.emailSystemPrompt}
              onChange={(e) => setConfig({ ...config, emailSystemPrompt: e.target.value })}
              placeholder={"Ești un agent AI expert în negociere și cumpărare de produse/servicii.\n\nOBIECTIVE:\n- Negociază prețuri mai mici cu diplomație\n- Fii politicos dar ferm în negociere\n- Propune contra-oferte rezonabile (10-25% reducere)\n- Răspunde în limba în care ești abordat\n- Menține un ton profesional dar prietenos"}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 transition-colors text-sm min-h-[120px] resize-y"
            />
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
            <div className="p-6 bg-zinc-800/30 rounded-2xl border border-amber-500/20 space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                <div>
                  <p className="font-medium text-amber-400">Waiting for QR scan...</p>
                  <p className="text-xs text-zinc-500">Open WhatsApp on your phone → Linked Devices → Link a Device</p>
                </div>
              </div>
              {waQR ? (
                <div className="flex justify-center">
                  <div className="bg-white p-3 rounded-2xl">
                    <img src={waQR} alt="WhatsApp QR Code" className="w-48 h-48" />
                  </div>
                </div>
              ) : (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
                </div>
              )}
              <button
                onClick={() => { setWaConnecting(false); setWaQR(null); }}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-400 transition-colors"
              >
                Cancel
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

          <div className="space-y-2 mt-4">
            <label className="text-xs text-zinc-500 uppercase font-bold">WhatsApp Agent Instructions</label>
            <p className="text-[10px] text-zinc-600">Instruct the AI on how to respond to WhatsApp messages — persona, tone, behavior rules. The agent remembers the last 20 messages with each contact for context.</p>
            <textarea
              value={config.whatsappSystemPrompt}
              onChange={(e) => setConfig({ ...config, whatsappSystemPrompt: e.target.value })}
              placeholder={"Ești o persoană reală care vorbește pe WhatsApp cu o cunoștință.\n\nREGULI:\n- Răspunde cât mai natural, scurt și la obiect\n- Folosește un ton relaxat, prietenos\n- Nu menționa sub nicio formă că ești o inteligență artificială\n- Răspunde în limba în care ești abordat\n- Negociază prețuri cu diplomație și răbdare"}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 transition-colors text-sm min-h-[120px] resize-y"
            />
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
