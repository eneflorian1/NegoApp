import React, { useState } from 'react';
import { Pencil, Plus, Trash2, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Config, CustomScenario } from '../../types';
import { SCENARIOS } from '../../constants/scenarios';

interface CustomScenariosSectionProps {
  config: Config;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
}

export default function CustomScenariosSection({ config, setConfig }: CustomScenariosSectionProps) {
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);
  const [newScenarioName, setNewScenarioName] = useState('');
  const [showAddScenario, setShowAddScenario] = useState(false);

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
  );
}
