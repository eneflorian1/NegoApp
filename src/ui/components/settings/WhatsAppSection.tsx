import React, { useState, useEffect } from 'react';
import { MessageSquare, Wifi, WifiOff, Loader2, Phone, ChevronDown, RefreshCcw, QrCode } from 'lucide-react';
import { Config, ServiceStatus } from '../../types';
import { SCENARIOS } from '../../constants/scenarios';

interface Scenario {
  id: string;
  label: string;
  icon: string;
  whatsappPrompt: string;
  emailPrompt: string;
}

interface WhatsAppSectionProps {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
  serviceStatus?: ServiceStatus;
  allScenarios: Scenario[];
  onScenarioChange: (channel: 'whatsapp' | 'email', scenarioId: string) => void;
}

export default function WhatsAppSection({ config, setConfig, serviceStatus, allScenarios, onScenarioChange }: WhatsAppSectionProps) {
  const [waQR, setWaQR] = useState<string | null>(null);
  const [waConnecting, setWaConnecting] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);
  const [waPairPhone, setWaPairPhone] = useState('');
  const [waPairCode, setWaPairCode] = useState<string | null>(null);
  const [waPairing, setWaPairing] = useState(false);

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

  const handleWhatsAppConnect = async () => {
    setWaConnecting(true);
    setWaQR(null);
    setWaError(null);
    try {
      const res = await fetch('/api/whatsapp/connect', { credentials: 'include', method: 'POST' });
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
      await fetch('/api/whatsapp/disconnect', { credentials: 'include', method: 'POST' });
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

  const waStatus = serviceStatus?.whatsapp;
  const isWaConnected = waStatus?.connected || false;

  return (
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
                <p className="text-[10px] text-red-400 mt-1">{waError || waStatus!.error}</p>
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
              onChange={(e) => onScenarioChange('whatsapp', e.target.value)}
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
            onClick={() => onScenarioChange('whatsapp', config.whatsappScenario || 'universal')}
            className="absolute top-2 right-2 p-1.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg text-zinc-500 hover:text-indigo-400 transition-all opacity-0 group-hover:opacity-100"
            title="Reset to scenario template"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
