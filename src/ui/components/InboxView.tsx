import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { Lead, Message } from '../types';

import ThreadList from './inbox/ThreadList';
import ChatArea from './inbox/ChatArea';
import PriceChartModal from './inbox/PriceChartModal';

interface InboxViewProps {
  leads: Lead[];
  selectedLeadId: string | null;
  setSelectedLeadId: (id: string | null) => void;
  onToggleBot: (leadId: string) => void;
}

interface LeadMeta {
  unread: number;
  latestTs: string;
  lastSender: string;
}

export default function InboxView({ leads, selectedLeadId, setSelectedLeadId, onToggleBot }: InboxViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [leadMeta, setLeadMeta] = useState<Record<string, LeadMeta>>({});
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'email'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [startingConvoId, setStartingConvoId] = useState<string | null>(null);
  const [sendingAddressId, setSendingAddressId] = useState<string | null>(null);
  const [chartLeadId, setChartLeadId] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close filter dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilterDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Poll messages for selected lead
  useEffect(() => {
    if (!selectedLeadId) return;
    const fetchMsgs = async () => {
      try {
        const res = await fetch(`/api/leads/${selectedLeadId}/messages`, { credentials: 'include' });
        if (res.ok) setMessages(await res.json());
      } catch { /* ignore */ }
    };
    fetchMsgs();
    const interval = setInterval(fetchMsgs, 3000);
    return () => clearInterval(interval);
  }, [selectedLeadId]);

  // Poll lead metadata (unread counts, latest timestamps)
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await fetch('/api/leads/meta', { credentials: 'include' });
        if (res.ok) setLeadMeta(await res.json());
      } catch { /* ignore */ }
    };
    fetchMeta();
    const interval = setInterval(fetchMeta, 5000);
    return () => clearInterval(interval);
  }, []);

  // Mark as read when selecting a lead
  useEffect(() => {
    if (!selectedLeadId) return;
    fetch(`/api/leads/${selectedLeadId}/read`, { method: 'POST', credentials: 'include' }).catch(() => {});
  }, [selectedLeadId]);

  // Filter & sort leads
  const filteredLeads = useMemo(() => {
    let result = [...leads];
    if (channelFilter !== 'all') {
      result = result.filter(l => l.channel === channelFilter);
    }
    result.sort((a, b) => {
      const aTs = leadMeta[a.id]?.latestTs || a.createdAt;
      const bTs = leadMeta[b.id]?.latestTs || b.createdAt;
      return new Date(bTs).getTime() - new Date(aTs).getTime();
    });
    return result;
  }, [leads, channelFilter, leadMeta]);

  const selectedLead = leads.find(l => l.id === selectedLeadId);
  const chartLead = chartLeadId ? leads.find(l => l.id === chartLeadId) : null;

  const handleSelectLead = (id: string) => {
    setSelectedLeadId(id);
    setIsMobileChatOpen(true);
    setDeleteConfirmId(null);
  };

  const handleSend = async () => {
    if (!messageText.trim() || !selectedLeadId) return;
    const text = messageText.trim();
    setMessageText('');
    try {
      await fetch(`/api/leads/${selectedLeadId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const res = await fetch(`/api/leads/${selectedLeadId}/messages`, { credentials: 'include' });
      if (res.ok) setMessages(await res.json());
    } catch { /* ignore */ }
  };

  const handleDeleteConversation = async (leadId: string) => {
    try {
      await fetch(`/api/leads/${leadId}/messages`, { method: 'DELETE', credentials: 'include' });
      setDeleteConfirmId(null);
      if (selectedLeadId === leadId) {
        setMessages([]);
      }
    } catch { /* ignore */ }
  };

  const handleStartConversation = async (leadId: string) => {
    setStartingConvoId(leadId);
    try {
      await fetch(`/api/leads/${leadId}/start-conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: '{}',
      });
    } catch { /* ignore */ }
    finally { setStartingConvoId(null); }
  };

  const handleSendAddress = async (leadId: string) => {
    setSendingAddressId(leadId);
    try {
      await fetch(`/api/leads/${leadId}/send-address`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch { /* ignore */ }
    finally { setSendingAddressId(null); }
  };

  return (
    <div className="flex h-full -m-4 lg:-m-8 overflow-hidden">
      <ThreadList
        leads={filteredLeads}
        selectedLeadId={selectedLeadId}
        leadMeta={leadMeta}
        channelFilter={channelFilter}
        setChannelFilter={setChannelFilter}
        showFilterDropdown={showFilterDropdown}
        setShowFilterDropdown={setShowFilterDropdown}
        filterRef={filterRef}
        deleteConfirmId={deleteConfirmId}
        setDeleteConfirmId={setDeleteConfirmId}
        startingConvoId={startingConvoId}
        sendingAddressId={sendingAddressId}
        isMobileChatOpen={isMobileChatOpen}
        onSelectLead={handleSelectLead}
        onDeleteConversation={handleDeleteConversation}
        onToggleBot={onToggleBot}
        onStartConversation={handleStartConversation}
        onSendAddress={handleSendAddress}
        onChartOpen={(id) => setChartLeadId(id)}
      />

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col ${!isMobileChatOpen ? 'hidden lg:flex' : 'flex'}`}>
        {selectedLead ? (
          <ChatArea
            selectedLead={selectedLead}
            messages={messages}
            messageText={messageText}
            setMessageText={setMessageText}
            startingConvoId={startingConvoId}
            sendingAddressId={sendingAddressId}
            onSend={handleSend}
            onBack={() => setIsMobileChatOpen(false)}
            onToggleBot={onToggleBot}
            onStartConversation={handleStartConversation}
            onSendAddress={handleSendAddress}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <MessageSquare className="w-16 h-16 text-zinc-800 mx-auto" />
              <p className="text-zinc-500">Select a conversation</p>
            </div>
          </div>
        )}
      </div>

      {/* Price Chart Modal */}
      <AnimatePresence>
        {chartLead && chartLead.priceHistory && (
          <PriceChartModal lead={chartLead} onClose={() => setChartLeadId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
