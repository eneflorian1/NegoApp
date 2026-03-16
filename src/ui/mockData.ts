import { Lead, Message, MarketStats } from './types';

// --- Mock Data ---
export const MOCK_LEADS: Lead[] = [
  {
    id: '1',
    url: 'https://www.olx.ro/d/oferta/iphone-15-pro-max-IDkk',
    title: 'iPhone 15 Pro Max 256GB',
    initialPrice: '4800 lei',
    price: '4500 lei',
    sellerName: 'Andrei M.',
    phoneNumber: '0723 456 789',
    isSaved: true,
    status: 'accepted',
    lastContacted: '2026-03-15T12:30:00Z',
    platform: 'olx',
    createdAt: '2026-03-15T10:00:00Z',
    marketValue: '4800 lei',
    dealRating: 'great',
    priceHistory: [
      { date: '2026-03-10', price: 4800, eventType: 'initial' },
      { date: '2026-03-12', price: 4600, event: 'Prima oferta trimisa', eventType: 'message' },
      { date: '2026-03-14', price: 4500, event: 'A doua oferta trimisa', eventType: 'message' },
      { date: '2026-03-15', price: 4300, event: 'Oferta acceptata!', eventType: 'accepted' },
    ],
    aiSuggestion: 'Salut! Sunt interesat de iPhone. Arati foarte bine in poze. Accepti 4200 lei cash astazi?',
    lastMessage: 'Vanzatorul a acceptat oferta de 4300 lei. Astept confirmarea locatiei.',
    isBotActive: true
  },
  {
    id: '2',
    url: 'https://www.olx.ro/d/oferta/laptop-gaming-asus-IDjj',
    title: 'Laptop Gaming ASUS ROG Strix',
    initialPrice: '3500 lei',
    price: '3200 lei',
    sellerName: 'Elena P.',
    phoneNumber: '0744 112 233',
    isSaved: false,
    status: 'negotiating',
    platform: 'olx',
    createdAt: '2026-03-15T11:15:00Z',
    marketValue: '3100 lei',
    dealRating: 'fair',
    priceHistory: [
      { date: '2026-03-12', price: 3500, eventType: 'initial' },
      { date: '2026-03-14', price: 3300, event: 'Intrebare despre baterie', eventType: 'message' },
      { date: '2026-03-15', price: 3200, event: 'Negociere in curs', eventType: 'message' },
    ],
    aiSuggestion: 'Buna ziua! Mai este valabil laptopul? Se poate vedea in Bucuresti?',
    lastMessage: 'Am intrebat de starea bateriei. Astept raspuns.',
    isBotActive: true
  },
  {
    id: '3',
    url: 'https://www.olx.ro/d/oferta/sony-ps5-slim-IDzz',
    title: 'Sony PS5 Slim + 2 Jocuri',
    initialPrice: '2000 lei',
    price: '1900 lei',
    finalPrice: '1850 lei',
    sellerName: 'Marius T.',
    phoneNumber: '0722 999 888',
    isSaved: true,
    status: 'closed',
    platform: 'olx',
    createdAt: '2026-03-14T15:00:00Z',
    marketValue: '2100 lei',
    dealRating: 'great',
    priceHistory: [
      { date: '2026-03-08', price: 2000, eventType: 'initial' },
      { date: '2026-03-10', price: 1950, event: 'Discutie pret', eventType: 'message' },
      { date: '2026-03-12', price: 1900, event: 'Oferta acceptata', eventType: 'accepted' },
      { date: '2026-03-14', price: 1850, event: 'Pret final la ridicare', eventType: 'accepted' },
    ],
    lastMessage: 'Tranzactie finalizata cu succes la pretul de 1850 lei.',
    isBotActive: false
  },
  {
    id: '4',
    url: 'https://www.olx.ro/d/oferta/samsung-s24-ultra-IDxx',
    title: 'Samsung S24 Ultra 512GB Sigilat',
    initialPrice: '5200 lei',
    price: '5200 lei',
    sellerName: 'George L.',
    phoneNumber: '0755 333 444',
    isSaved: true,
    status: 'new',
    platform: 'olx',
    createdAt: '2026-03-15T14:20:00Z',
    marketValue: '5000 lei',
    dealRating: 'fair',
    aiSuggestion: 'Produs nou, pret fix. Merita incercat o negociere la 4900 lei.',
    lastMessage: 'Lead nou detectat. Nicio actiune intreprinsa inca.',
    isBotActive: true
  },
  {
    id: '5',
    url: 'https://www.olx.ro/d/oferta/ipad-pro-m2-IDyy',
    title: 'iPad Pro M2 11 inch + Pencil',
    initialPrice: '4200 lei',
    price: '4000 lei',
    sellerName: 'Cristina V.',
    phoneNumber: '0766 555 666',
    isSaved: false,
    status: 'contacted',
    platform: 'olx',
    createdAt: '2026-03-15T09:45:00Z',
    marketValue: '4100 lei',
    dealRating: 'great',
    aiSuggestion: 'Am trimis mesajul de salut si intrebarea despre garantie.',
    lastMessage: 'Mesaj trimis pe WhatsApp. Se asteapta citirea.',
    isBotActive: true
  },
  {
    id: '6',
    url: 'https://www.olx.ro/d/oferta/apple-watch-ultra-IDww',
    title: 'Apple Watch Ultra 2 - Ca Nou',
    initialPrice: '3200 lei',
    price: '3000 lei',
    sellerName: 'Alex S.',
    phoneNumber: '0733 444 555',
    isSaved: true,
    status: 'autosend',
    platform: 'olx',
    createdAt: '2026-03-15T08:30:00Z',
    marketValue: '3100 lei',
    dealRating: 'great',
    priceHistory: [
      { date: '2026-03-14', price: 3200, eventType: 'initial' },
      { date: '2026-03-15', price: 3000, event: 'Oferta acceptata automat', eventType: 'accepted' },
    ],
    aiSuggestion: 'Vanzatorul a fost de acord. Trimit detaliile de livrare.',
    lastMessage: 'Detaliile de livrare au fost trimise automat.',
    isBotActive: true
  }
];

export const MOCK_MESSAGES: Message[] = [
  { id: '1', leadId: '1', sender: 'me', text: 'Salut! Mai este valabil anuntul?', timestamp: '2026-03-15T12:00:00Z', channel: 'whatsapp' },
  { id: '2', leadId: '1', sender: 'seller', text: 'Salut! Da, este inca disponibil.', timestamp: '2026-03-15T12:05:00Z', channel: 'whatsapp' },
  { id: '3', leadId: '1', sender: 'me', text: 'Care este ultimul pret?', timestamp: '2026-03-15T12:10:00Z', channel: 'whatsapp' },
];

export const MOCK_MARKET_STATS: MarketStats[] = [
  {
    id: '1',
    query: 'Huawei P80',
    averagePrice: 3200,
    minPrice: 2800,
    maxPrice: 4500,
    totalListings: 142,
    priceDistribution: [
      { range: '2800-3000', count: 45 },
      { range: '3000-3500', count: 68 },
      { range: '3500-4000', count: 20 },
      { range: '4000+', count: 9 },
    ],
    topDeals: [MOCK_LEADS[0]],
    lastUpdated: new Date().toISOString()
  }
];

