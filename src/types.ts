export interface Lead {
  id: string;
  url: string;
  title: string;
  price: string;
  sellerName: string;
  phoneNumber: string;
  isSaved: boolean;
  status: 'new' | 'contacted' | 'negotiating' | 'closed';
  lastContacted?: string;
  platform: 'olx';
  createdAt: string;
  marketValue?: string;
  dealRating?: 'great' | 'fair' | 'poor';
  aiSuggestion?: string;
  lastMessage?: string;
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
  categoryUrl: string;
  status: 'running' | 'paused' | 'completed' | 'error';
  leadsFound: number;
  leadsContacted: number;
  progress: number;
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
}
