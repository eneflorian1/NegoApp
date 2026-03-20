import React from 'react';
import { Zap } from 'lucide-react';
import { Config } from '../../types';

interface GeminiSectionProps {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
}

export default function GeminiSection({ config, setConfig }: GeminiSectionProps) {
  return (
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
  );
}
