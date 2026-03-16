import React, { useState, useEffect, useRef } from 'react';
import { Send, Zap, Bot, User, Loader2, Phone, ChevronDown, ChevronUp, ExternalLink, Wrench, StopCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatMessage, Config, OrchestratorTask } from '../types';
import { formatPhone } from '../helpers';

const WELCOME_MSG: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `**🤖 Bun venit în NegoApp AI Orchestrator!**

Pot să te ajut cu:
• **Extragere telefon** — trimite un URL de listing
• **Scanare categorie** — \`Scanează [URL]\`
• **Status sistem** — \`Status\`
• **Istoric misiuni** — \`Misiuni\`

Sau trimite orice URL de OLX și îl procesez automat.`,
  timestamp: new Date().toISOString(),
};

interface OrchestratorViewProps {
  config: Config;
  tasks: OrchestratorTask[];
  setTasks: React.Dispatch<React.SetStateAction<OrchestratorTask[]>>;
}

export default function OrchestratorView({ config, tasks, setTasks }: OrchestratorViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [activeMissions, setActiveMissions] = useState<any[]>([]);
  const [personality, setPersonality] = useState<'shark' | 'diplomat' | 'ghost'>(config.defaultPersonality || 'diplomat');
  
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync personality with config changes
  useEffect(() => {
    setPersonality(config.defaultPersonality);
  }, [config.defaultPersonality]);

  // Scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Poll active missions for updates
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/missions');
        const data = await res.json();
        const running = data.filter((m: any) => m.status === 'running');
        setActiveMissions(running);

        // Check for newly completed missions → add system message
        const justEnded = data.filter((m: any) =>
          (m.status === 'completed' || m.status === 'error' || m.status === 'aborted') &&
          new Date(m.updatedAt).getTime() > Date.now() - 5000
        );

        for (const m of justEnded) {
          setMessages(prev => {
            const id = `result-${m.id}`;
            if (prev.some(msg => msg.id === id)) return prev;
            
            const r = m.results?.[0];
            let content: string;
            if (m.status === 'completed' && r?.phone) {
              content = `✅ **Telefon extras cu succes!**\n\n📞 **${formatPhone(r.phone)}**\n\n${r.listing?.title ? `📋 ${r.listing.title}` : ''}${r.listing?.price ? `\n💰 ${r.listing.price}` : ''}${r.timing?.totalMs ? `\n⏱️ ${(r.timing.totalMs / 1000).toFixed(1)}s` : ''}`;
            } else if (m.status === 'completed') {
              content = `✅ Misiune finalizată: ${m.url}`;
            } else if (m.status === 'aborted') {
              content = `⛔ **Misiune oprită manual.**\n\n🔗 ${m.url}`;
            } else {
              content = `❌ Misiune eșuată: ${r?.error || 'Unknown error'}\n\n🔗 ${m.url}`;
            }
            
            const assistantMsg: any = {
              id,
              role: 'system',
              content,
              timestamp: new Date().toISOString(),
            };

            if (r?.phone) {
              assistantMsg.toolCall = {
                name: 'extract_phone',
                args: { url: m.url },
                result: r,
                status: m.status === 'completed' ? 'completed' : m.status === 'aborted' ? 'aborted' : 'error',
              };
            }
            
            return [...prev, assistantMsg];
          });
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function stopMission(id: string) {
    try {
      await fetch(`/api/mission/${id}/stop`, { method: 'POST' });
    } catch { /* ignore */ }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, personality }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `Server error (${res.status})`);
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.content,
        timestamp: new Date().toISOString(),
        toolCall: data.toolCall || undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `⚠️ ${err.message === 'Failed to fetch' ? 'Serverul API nu rulează. Pornește cu: npm run dev' : err.message}`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  }

  function quickSend(text: string) {
    setInput(text);
    setTimeout(() => {
      const form = document.getElementById('chat-form') as HTMLFormElement;
      if (form) form.requestSubmit();
    }, 50);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col overflow-hidden max-w-4xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {activeMissions.length > 0 && (
            <div className="flex sm:hidden items-center gap-1.5 px-2 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
              <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
              <span className="text-[9px] font-bold text-indigo-400">{activeMissions.length}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
          {activeMissions.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
              <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              <span className="text-[10px] font-bold text-indigo-400">{activeMissions.length} active</span>
            </div>
          )}
          
          <div className="flex items-center gap-1 p-0.5 sm:p-1 bg-zinc-800/50 border border-zinc-800 rounded-lg">
            {(['shark', 'diplomat', 'ghost'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPersonality(p)}
                className={`px-1.5 sm:px-2 py-1 rounded text-[8px] sm:text-[9px] font-black uppercase tracking-tighter transition-all ${
                  personality === p 
                  ? 'bg-indigo-600 text-white shadow-lg' 
                  : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => setDeployOpen(!deployOpen)}
            className="flex items-center gap-1.5 px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[9px] sm:text-[10px] text-zinc-400 transition-colors"
          >
            <Zap className="w-3 h-3" />
            <span>Deploy</span>
            {deployOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Active Missions Overlay (Floating) */}
      <AnimatePresence>
        {activeMissions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute left-4 right-4 sm:left-auto sm:right-0 top-32 sm:top-16 z-20 sm:w-80 max-h-[300px] overflow-y-auto glass-panel rounded-2xl p-4 shadow-xl border-indigo-500/20"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin text-indigo-400" /> Active Missions
            </p>
            <div className="space-y-3">
              {activeMissions.map((m: any) => (
                <div key={m.id} className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-zinc-300 truncate flex-1">{m.url}</p>
                    <button 
                      onClick={() => stopMission(m.id)}
                      className="p-1.5 hover:bg-amber-500/20 rounded text-amber-500 transition-colors"
                      title="Stop Mission"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-indigo-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${m.progress || 0}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono">
                    <span>{m.status.toUpperCase()}</span>
                    <span>{m.progress || 0}%</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsible Quick Deploy */}
      <AnimatePresence>
        {deployOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-4"
          >
            <QuickDeployPanel onSubmit={(url, mode) => {
              const text = mode === 'category'
                ? `Scanează ${url}`
                : url;
              // Pass personality through the API call in handleSend or orchestrate separately if needed
              // For now quickSend uses the currently selected personality
              quickSend(text);
              setDeployOpen(false);
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4 scrollbar-thin">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}

        {isTyping && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="glass-panel rounded-2xl rounded-tl-md px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggestion chips */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 pb-3">
          {[
            { label: '📊 Status', text: 'Status' },
            { label: '📋 Misiuni', text: 'Misiuni' },
            { label: '❓ Ajutor', text: 'Ce poți face?' },
          ].map(chip => (
            <button
              key={chip.text}
              onClick={() => quickSend(chip.text)}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-full text-xs text-zinc-400 transition-colors"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Input - Pinned Bottom */}
      <div className="flex-shrink-0 bg-[#0d0d0e] pt-2 pb-0 sm:pb-4 border-t border-zinc-800/50">
        <form id="chat-form" onSubmit={handleSend} className="flex items-center gap-2 sm:gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Trimite URL sau comandă..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 sm:py-3 px-3 sm:px-4 text-[13px] sm:text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-zinc-600"
            disabled={isTyping}
          />
          <button
            type="submit"
            disabled={isTyping || !input.trim()}
            className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </form>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────
// Chat Bubble Component
// ────────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: ChatMessage, key?: any }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-zinc-700' :
        isSystem ? 'bg-emerald-600/20' :
        'bg-gradient-to-br from-indigo-600 to-purple-600'
      }`}>
        {isUser ? <User className="w-4 h-4 text-zinc-300" /> :
         isSystem ? <Zap className="w-4 h-4 text-emerald-400" /> :
         <Bot className="w-4 h-4 text-white" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[85%] ${
        isUser
          ? 'bg-indigo-600/20 border border-indigo-500/20 rounded-2xl rounded-tr-md'
          : isSystem
            ? 'bg-zinc-800/80 border border-zinc-700/50 rounded-2xl rounded-tl-md'
            : 'glass-panel rounded-2xl rounded-tl-md'
      } px-3 sm:px-4 py-2 sm:py-3`}>
        {/* Tool call indicator */}
        {message.toolCall && (
          <div className={`flex items-center gap-2 mb-2 pb-2 border-b ${
            message.toolCall.status === 'running' ? 'border-indigo-500/30' :
            message.toolCall.status === 'completed' ? 'border-emerald-500/30' :
            'border-red-500/30'
          }`}>
            <Wrench className={`w-3.5 h-3.5 ${
              message.toolCall.status === 'running' ? 'text-indigo-400 animate-spin' :
              message.toolCall.status === 'completed' ? 'text-emerald-400' :
              'text-red-400'
            }`} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {message.toolCall.name.replace(/_/g, ' ')}
            </span>
            {message.toolCall.status === 'running' && (
              <Loader2 className="w-3 h-3 text-indigo-400 animate-spin ml-auto" />
            )}
          </div>
        )}

        {/* Phone result card */}
        {message.toolCall?.result?.phone && (
          <div className="mb-3 p-3 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-500/30 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <Phone className="w-4 h-4 text-emerald-400" />
              <span className="text-lg font-black text-emerald-400 tabular-nums tracking-wider">
                {formatPhone(message.toolCall.result.phone)}
              </span>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(message.toolCall!.result.phone)}
              className="text-[10px] text-emerald-400/70 hover:text-emerald-400 transition-colors"
            >
              Copiază
            </button>
          </div>
        )}

        {/* Content */}
        <div className="text-xs sm:text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed chat-content">
          {renderContent(message.content)}
        </div>

        {/* Timestamp */}
        <p className="text-[9px] text-zinc-600 mt-2">
          {new Date(message.timestamp).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

// Simple markdown-ish renderer
function renderContent(content: string) {
  if (!content) return null;
  return content.split('\n').map((line, i) => {
    // Bold
    let processed = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Inline code
    processed = processed.replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 bg-zinc-800 rounded text-[11px] text-indigo-300 font-mono">$1</code>');

    if (!processed.trim()) return <br key={i} />;
    return <span key={i} dangerouslySetInnerHTML={{ __html: processed }} />;
  }).reduce((acc: React.ReactNode[], el, i) => {
    if (i > 0) acc.push(<br key={`br-${i}`} />);
    acc.push(el);
    return acc;
  }, [] as React.ReactNode[]);
}

// ────────────────────────────────────────────────────────────────
// Quick Deploy Panel
// ────────────────────────────────────────────────────────────────

function QuickDeployPanel({ onSubmit }: { onSubmit: (url: string, mode: string) => void }) {
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<'single' | 'category'>('single');

  return (
    <div className="glass-panel rounded-2xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setMode('single')}
          className={`p-2.5 rounded-xl border text-left transition-all text-xs ${mode === 'single'
            ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-300'
            : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-500 hover:border-zinc-700'
          }`}
        >
          <span className="font-bold">🔗 Single Link</span>
          <span className="block text-[10px] mt-0.5 opacity-70">Extrage telefon</span>
        </button>
        <button
          onClick={() => setMode('category')}
          className={`p-2.5 rounded-xl border text-left transition-all text-xs ${mode === 'category'
            ? 'bg-purple-600/10 border-purple-500/30 text-purple-300'
            : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-500 hover:border-zinc-700'
          }`}
        >
          <span className="font-bold">📂 Category</span>
          <span className="block text-[10px] mt-0.5 opacity-70">Scan + batch reveal</span>
        </button>
      </div>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={mode === 'single' ? 'https://www.olx.ro/d/oferta/...' : 'https://www.olx.ro/imobiliare/'}
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-zinc-600"
        />
        <button
          onClick={() => { if (url.trim()) onSubmit(url.trim(), mode); }}
          disabled={!url.trim()}
          className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl font-bold text-xs transition-all disabled:opacity-40 shadow-lg shadow-indigo-600/20"
        >
          Deploy
        </button>
      </div>
    </div>
  );
}
