import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Zap, CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Config, ServiceStatus, CustomScenario } from '../types';
import { SCENARIOS } from '../constants/scenarios';

import GeminiSection from './settings/GeminiSection';
import AgentMailSection from './settings/AgentMailSection';
import WhatsAppSection from './settings/WhatsAppSection';
import OlxSection from './settings/OlxSection';
import CustomScenariosSection from './settings/CustomScenariosSection';

interface SettingsViewProps {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
  serviceStatus?: ServiceStatus;
  configLoaded?: boolean;
}

export default function SettingsView({ config, setConfig, serviceStatus, configLoaded = true }: SettingsViewProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  // OLX Status (shared between OlxSection rendering)
  const [olxStatus, setOlxStatus] = useState<{ valid: boolean; cookieCount?: number; loginDate?: string; expiresAt?: string } | null>(null);

  const isFirstRender = useRef(true);

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

  // Load OLX Status
  useEffect(() => {
    fetch('/api/session/olx/status', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setOlxStatus(data))
      .catch(() => {});
  }, []);

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

        <GeminiSection config={config} setConfig={setConfig} />
        <AgentMailSection config={config} setConfig={setConfig} serviceStatus={serviceStatus} allScenarios={allScenarios} onScenarioChange={handleScenarioChange} />
        <WhatsAppSection config={config} setConfig={setConfig} serviceStatus={serviceStatus} allScenarios={allScenarios} onScenarioChange={handleScenarioChange} />
        <OlxSection olxStatus={olxStatus} setOlxStatus={setOlxStatus} />
        <CustomScenariosSection config={config} setConfig={setConfig} />

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
