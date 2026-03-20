import React from 'react';
import { Send, Phone, Mail, ChevronLeft, MoreVertical, AlertCircle, MessageSquare, Zap, Users, CheckCircle2, PlayCircle, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { Lead, Message } from '../../types';

interface ChatAreaProps {
  selectedLead: Lead;
  messages: Message[];
  messageText: string;
  setMessageText: (text: string) => void;
  startingConvoId: string | null;
  sendingAddressId: string | null;
  onSend: () => void;
  onBack: () => void;
  onToggleBot: (id: string) => void;
  onStartConversation: (id: string) => void;
  onSendAddress: (id: string) => void;
}

export default function ChatArea({
  selectedLead, messages, messageText, setMessageText,
  startingConvoId, sendingAddressId,
  onSend, onBack, onToggleBot, onStartConversation, onSendAddress,
}: ChatAreaProps) {
  return (
    <>
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-[#0D0D0E]/50">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="lg:hidden p-2 -ml-2 hover:bg-zinc-800 rounded-lg text-zinc-400"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-indigo-400 font-bold">
            {selectedLead.sellerName[0]}
          </div>
          <div>
            <h3 className="font-medium">{selectedLead.sellerName}</h3>
            <div className="text-xs text-zinc-500 flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Online
              </div>
              <span className="text-zinc-700">|</span>
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter ${selectedLead.isBotActive ? 'bg-indigo-500/10 text-indigo-400' : 'bg-amber-500/10 text-amber-500'
                }`}>
                {selectedLead.isBotActive ? (
                  <><Zap className="w-2.5 h-2.5 fill-indigo-400" /> Bot Active</>
                ) : (
                  <><Users className="w-2.5 h-2.5" /> Manual Mode</>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedLead.isBotActive && (
            <button
              onClick={() => onToggleBot(selectedLead.id)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-600/20"
            >
              Take Over
            </button>
          )}
          {!selectedLead.isBotActive && (
            <button
              onClick={() => onToggleBot(selectedLead.id)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-bold text-zinc-300 transition-all"
            >
              Re-activate Bot
            </button>
          )}
          <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400"><Phone className="w-5 h-5" /></button>
          <button className="hidden sm:block p-2 hover:bg-zinc-800 rounded-lg text-zinc-400"><Mail className="w-5 h-5" /></button>
          <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400"><MoreVertical className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6 space-y-4">
        {/* Consensus Banner */}
        {selectedLead.status === 'accepted' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-3 mb-4"
          >
            <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Consens Atins!</p>
              <p className="text-[10px] text-emerald-500/70">S-a ajuns la un acord pe preț. Trimite adresa de livrare pentru a finaliza.</p>
            </div>
            <button
              onClick={() => onSendAddress(selectedLead.id)}
              disabled={sendingAddressId === selectedLead.id}
              className="px-4 py-2 bg-emerald-500 text-black text-[10px] font-bold rounded-lg hover:bg-emerald-400 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <MapPin className="w-3 h-3" />
              {sendingAddressId === selectedLead.id ? 'Se trimite...' : 'Trimite Adresa'}
            </button>
          </motion.div>
        )}
        {!selectedLead.isBotActive && selectedLead.status !== 'accepted' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-3 mb-4"
          >
            <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-500 uppercase tracking-widest">Manual Mode Active</p>
              <p className="text-[10px] text-amber-500/70">The bot has been deactivated for this conversation. You are in full control.</p>
            </div>
            <button
              onClick={() => onToggleBot(selectedLead.id)}
              className="ml-auto px-3 py-1 bg-amber-500 text-black text-[10px] font-bold rounded-lg hover:bg-amber-400 transition-colors"
            >
              Re-activate
            </button>
          </motion.div>
        )}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
            <MessageSquare className="w-10 h-10 text-zinc-700 mb-1 opacity-30" />
            <p className="text-sm text-zinc-600">Niciun mesaj încă</p>
            {selectedLead.phoneNumber && selectedLead.status === 'new' && (
              <button
                onClick={() => onStartConversation(selectedLead.id)}
                disabled={startingConvoId === selectedLead.id}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50"
              >
                <PlayCircle className="w-5 h-5" />
                {startingConvoId === selectedLead.id ? 'Se trimite mesajul...' : 'Pornește Conversația'}
              </button>
            )}
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] lg:max-w-[70%] p-4 rounded-2xl ${msg.sender === 'me'
                ? 'bg-indigo-600 text-white rounded-tr-none'
                : 'bg-zinc-800 text-zinc-200 rounded-tl-none'
              }`}>
              {msg.channel === 'email' && msg.subject && (
                <p className={`text-xs font-semibold mb-1 ${msg.sender === 'me' ? 'text-indigo-100' : 'text-zinc-400'}`}>
                  {msg.subject}
                </p>
              )}
              <p className="text-sm">{msg.text || (msg.channel === 'email' && msg.subject ? '' : '(mesaj gol)')}</p>
              <div className={`flex items-center gap-1.5 mt-2 ${msg.sender === 'me' ? 'text-indigo-200' : 'text-zinc-500'}`}>
                {msg.channel === 'whatsapp' ? <MessageSquare className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                <span className="text-[10px]">
                  {new Date(msg.timestamp).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-zinc-800 bg-[#0D0D0E]/50 space-y-3">
        {selectedLead.aiSuggestion && selectedLead.isBotActive && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMessageText(selectedLead.aiSuggestion || '')}
              className="flex-1 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 py-2 px-4 rounded-xl text-xs font-medium flex items-center justify-center gap-2 hover:bg-indigo-600/20 transition-colors"
            >
              <Zap className="w-3 h-3 fill-indigo-400" /> <span className="truncate">Use AI: "{selectedLead.aiSuggestion.substring(0, 30)}..."</span>
            </button>
          </div>
        )}
        {!selectedLead.isBotActive && selectedLead.aiSuggestion && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 py-2 px-4 rounded-xl text-[10px] italic flex items-center gap-2">
              <AlertCircle className="w-3 h-3" /> AI suggestions are disabled in manual mode.
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
            placeholder="Type a message..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button onClick={onSend} className="p-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white transition-colors">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </>
  );
}
