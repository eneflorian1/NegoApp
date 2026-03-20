import React from 'react';
import { Mail, ChevronDown, RefreshCcw } from 'lucide-react';
import { Config, ServiceStatus, CustomScenario } from '../../types';
import { SCENARIOS } from '../../constants/scenarios';

interface Scenario {
  id: string;
  label: string;
  icon: string;
  whatsappPrompt: string;
  emailPrompt: string;
}

interface AgentMailSectionProps {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
  serviceStatus?: ServiceStatus;
  allScenarios: Scenario[];
  onScenarioChange: (channel: 'whatsapp' | 'email', scenarioId: string) => void;
}

export default function AgentMailSection({ config, setConfig, serviceStatus, allScenarios, onScenarioChange }: AgentMailSectionProps) {
  return (
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
              onChange={(e) => onScenarioChange('email', e.target.value)}
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
            onClick={() => onScenarioChange('email', config.emailScenario || 'universal')}
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
