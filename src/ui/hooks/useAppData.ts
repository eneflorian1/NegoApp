import { useState, useEffect } from 'react';
import { Lead, Config, ServiceStatus } from '../types';

const DEFAULT_CONFIG: Config = {
  geminiApiKey: '',
  agentMailApiKey: '',
  whatsappConnected: true,
  autoPilotEnabled: false,
  requestLocationConfirmation: true,
  meetingAddress: '',
  autosendAddress: false,
  defaultPersonality: 'diplomat',
  whatsappSystemPrompt: "Ești o persoană reală care vorbește pe WhatsApp cu o cunoștință.\n\nREGULI:\n- Răspunde cât mai natural, scurt și la obiect\n- Folosește un ton relaxat, prietenos\n- Nu menționa sub nicio formă că ești o inteligență artificială\n- Răspunde în limba în care ești abordat\n- Negociază prețuri cu diplomație și răbdare",
  emailSystemPrompt: "Ești un agent AI expert în negociere și cumpărare de produse/servicii.\n\nOBIECTIVE:\n- Negociază prețuri mai mici cu diplomație\n- Fii politicos dar ferm în negociere\n- Propune contra-oferte rezonabile (10-25% reducere)\n- Răspunde în limba în care ești abordat\n- Menține un ton profesional dar prietenos",
  whatsappScenario: 'universal',
  emailScenario: 'universal',
  yoloDefaults: {
    autoNegThreshold: 10,
    modaExcludedBrands: 'Zara, H&M',
    electroniceMinWarrantyMonths: 12
  }
};

const DEFAULT_SERVICE_STATUS: ServiceStatus = {
  whatsapp: { connected: false, initializing: false, phone: null, name: null, hasQR: false, error: null },
  agentmail: { connected: false, error: null },
};

export function useAppData() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>(DEFAULT_SERVICE_STATUS);

  // Poll leads
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const res = await fetch('/api/leads', { credentials: 'include' });
        if (res.ok) setLeads(await res.json());
      } catch { /* ignore */ }
    };
    fetchLeads();
    const interval = setInterval(fetchLeads, 5000);
    return () => clearInterval(interval);
  }, []);

  // Load config
  useEffect(() => {
    fetch('/api/config', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(saved => {
        if (saved && Object.keys(saved).length > 0) setConfig(prev => ({ ...prev, ...saved }));
        setConfigLoaded(true);
      })
      .catch(() => setConfigLoaded(false));
  }, []);

  // Poll service status
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/services/status', { credentials: 'include' });
        if (res.ok) setServiceStatus(await res.json());
      } catch { /* ignore */ }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleBotActive = async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const updated = !lead.isBotActive;
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, isBotActive: updated } : l));
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBotActive: updated }),
      });
    } catch { /* ignore */ }
  };

  const deleteLead = async (leadId: string) => {
    setLeads(prev => prev.filter(l => l.id !== leadId));
    try {
      await fetch(`/api/leads/${leadId}`, { method: 'DELETE', credentials: 'include' });
    } catch { /* ignore */ }
  };

  const deleteLeads = async (leadIds: string[]) => {
    setLeads(prev => prev.filter(l => !leadIds.includes(l.id)));
    try {
      await Promise.all(leadIds.map(id => 
        fetch(`/api/leads/${id}`, { method: 'DELETE', credentials: 'include' })
      ));
    } catch { /* ignore */ }
  };

  return {
    leads, setLeads,
    config, setConfig, configLoaded,
    serviceStatus,
    toggleBotActive, deleteLead, deleteLeads,
  };
}
