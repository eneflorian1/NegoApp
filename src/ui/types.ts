export interface Lead {
  id: string;
  url: string;
  title: string;
  initialPrice: string;
  price: string;
  sellerName: string;
  phoneNumber: string;
  isSaved: boolean;
  status: 'new' | 'contacted' | 'negotiating' | 'accepted' | 'closed' | 'autosend';
  lastContacted?: string;
  platform: 'olx';
  createdAt: string;
  marketValue?: string;
  finalPrice?: string;
  priceHistory?: { date: string; price: number; event?: string; eventType?: 'message' | 'accepted' | 'initial' }[];
  dealRating?: 'great' | 'fair' | 'poor';
  aiSuggestion?: string;
  lastMessage?: string;
  isBotActive?: boolean;
}

export interface Message {
  id: string;
  leadId: string;
  sender: 'me' | 'seller';
  text: string;
  timestamp: string;
  channel: 'whatsapp' | 'email';
}

export interface OrchestratorTask {
  id: string;
  mode: 'single' | 'category';
  platform: 'olx';
  url: string;
  query?: string;
  useProxy: boolean;
  status: 'running' | 'paused' | 'completed' | 'error';
  leadsFound: number;
  leadsContacted: number;
  progress: number;
  results: RevealResult[];
  createdAt: string;
}

export interface MarketStats {
  id: string;
  query: string;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  totalListings: number;
  priceDistribution: { range: string; count: number }[];
  topDeals: Lead[];
  lastUpdated: string;
}

export interface Config {
  agentMailApiKey: string;
  whatsappConnected: boolean;
  autoPilotEnabled: boolean;
  requestLocationConfirmation: boolean;
  meetingAddress: string;
  autosendAddress: boolean;
  defaultPersonality: 'shark' | 'diplomat' | 'ghost';
  yoloDefaults: {
    autoNegThreshold: number;
    modaExcludedBrands: string;
    electroniceMinWarrantyMonths: number;
  };
}

export interface RevealResult {
  success: boolean;
  phone?: string;
  error?: string;
  url?: string;
  listing?: {
    title?: string;
    price?: string;
    sellerName?: string;
    memberSince?: string;
    lastSeen?: string;
  };
  proxy?: string;
  timing?: {
    totalMs?: number;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCall?: {
    name: string;
    args: Record<string, any>;
    result?: any;
    status?: 'running' | 'completed' | 'error';
  };
}

export interface ServiceStatus {
  whatsapp: {
    connected: boolean;
    initializing: boolean;
    phone: string | null;
    name: string | null;
    hasQR: boolean;
    error: string | null;
  };
  agentmail: {
    connected: boolean;
    error: string | null;
  };
}
