/**
 * NegoApp MCP Bridge Client
 * 
 * Connects to usa-app's WebSocket endpoint and exposes NegoApp's
 * capabilities as tools that usa-app's AI orchestrator can invoke.
 * 
 * Usage:
 *   node mcp-bridge-client.js
 *   
 * Environment:
 *   BRIDGE_URL  — WebSocket URL (default: ws://localhost:5000/ws/mcp-bridge)
 *   NEGO_API    — NegoApp API base URL (default: http://localhost:3001)
 */

import WebSocket from 'ws';

const BRIDGE_URL = process.env.BRIDGE_URL || 'ws://localhost:5000/ws/mcp-bridge';
const NEGO_API = process.env.NEGO_API || 'http://localhost:3001';
const NEGO_USER = process.env.NEGO_USER || 'a';
const NEGO_PASS = process.env.NEGO_PASS || '123456';

// Auth token (obtained on startup via /api/auth/login)
let authToken = null;

// ─── Tool Definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'nego_get_leads',
    description: 'Get all negotiation leads from NegoApp',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max leads to return (default 100)' },
      },
    },
  },
  {
    name: 'nego_get_lead',
    description: 'Get a specific lead by ID',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'The lead ID' },
      },
      required: ['leadId'],
    },
  },
  {
    name: 'nego_create_lead',
    description: 'Create a new negotiation lead',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Listing URL' },
        title: { type: 'string', description: 'Product title' },
        price: { type: 'string', description: 'Listed price' },
        sellerName: { type: 'string', description: 'Seller name' },
        phoneNumber: { type: 'string', description: 'Phone number' },
      },
      required: ['url', 'title'],
    },
  },
  {
    name: 'nego_start_mission',
    description: 'Start a full scraping mission — discovers strategy, scrapes category, reveals phones',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Category URL to scrape (e.g. OLX category page)' },
        query: { type: 'string', description: 'Search query context' },
        maxPages: { type: 'number', description: 'Max pages to scrape (default 2)' },
        maxListings: { type: 'number', description: 'Max listings (default 50)' },
        maxReveals: { type: 'number', description: 'Max phone reveals (default 5)' },
        useProxy: { type: 'boolean', description: 'Use proxy rotation (default false)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'nego_get_missions',
    description: 'Get all missions with status',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'nego_get_mission',
    description: 'Get a specific mission by ID',
    parameters: {
      type: 'object',
      properties: {
        missionId: { type: 'string', description: 'The mission ID' },
      },
      required: ['missionId'],
    },
  },
  {
    name: 'nego_stop_mission',
    description: 'Stop a running mission',
    parameters: {
      type: 'object',
      properties: {
        missionId: { type: 'string', description: 'The mission ID to stop' },
      },
      required: ['missionId'],
    },
  },
  {
    name: 'nego_reveal_phone',
    description: 'Reveal phone number for a single listing URL',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Listing URL to reveal phone for' },
        useProxy: { type: 'boolean', description: 'Use proxy (default false)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'nego_get_conversations',
    description: 'Get conversation messages for a lead',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'The lead ID' },
      },
      required: ['leadId'],
    },
  },
  {
    name: 'nego_chat_reply',
    description: 'Generate an AI negotiation reply for a lead conversation',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'The lead ID' },
        channel: { type: 'string', description: 'Channel: whatsapp or email (default whatsapp)' },
      },
      required: ['leadId'],
    },
  },
  {
    name: 'nego_whatsapp_status',
    description: 'Check WhatsApp connection status for a user',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID (default: first user)' },
      },
    },
  },
  {
    name: 'nego_send_whatsapp',
    description: 'Send a WhatsApp message to a phone number',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        chatId: { type: 'string', description: 'Phone number or chat ID' },
        message: { type: 'string', description: 'Message text to send' },
      },
      required: ['chatId', 'message'],
    },
  },
  {
    name: 'nego_get_config',
    description: 'Get NegoApp configuration',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'nego_get_stats',
    description: 'Get NegoApp dashboard statistics (leads count, missions stats)',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'nego_health',
    description: 'Check if NegoApp backend is running',
    parameters: { type: 'object', properties: {} },
  },
];

// ─── Auth ────────────────────────────────────────────────────────────────────

async function login() {
  console.log(`[Bridge] Logging in to NegoApp as "${NEGO_USER}"...`);
  try {
    const res = await fetch(`${NEGO_API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: NEGO_USER, password: NEGO_PASS }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Login failed (${res.status}): ${text}`);
    }

    // Extract token from Set-Cookie header (works on all Node.js versions)
    const setCookie = res.headers.get('set-cookie') || '';
    const tokenMatch = setCookie.match(/token=([^;]+)/);
    if (tokenMatch) {
      authToken = tokenMatch[1];
      console.log('[Bridge] ✅ Authenticated (token from cookie)');
      // Consume body to avoid leak
      await res.text().catch(() => {});
      return;
    }

    // Fallback: check response body for token
    const body = await res.json().catch(() => null);
    if (body?.token) {
      authToken = body.token;
      console.log('[Bridge] ✅ Authenticated (token from body)');
      return;
    }

    console.warn('[Bridge] ⚠️ Login succeeded but no token found — API calls may fail');
  } catch (err) {
    console.error('[Bridge] ❌ Auth failed:', err.message);
    console.log('[Bridge] Continuing without auth — some endpoints may fail');
  }
}

// ─── Tool Handlers ───────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const url = `${NEGO_API}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
    headers['Cookie'] = `token=${authToken}`;
  }
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${options.method || 'GET'} ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

const TOOL_HANDLERS = {
  nego_health: async () => apiFetch('/api/health').catch(() => ({ ok: false })),
  
  nego_get_leads: async ({ limit = 100 }) => {
    const leads = await apiFetch('/api/leads');
    return Array.isArray(leads) ? leads.slice(0, limit) : leads;
  },
  
  nego_get_lead: async ({ leadId }) => apiFetch(`/api/leads/${leadId}`),
  
  nego_create_lead: async (params) => apiFetch('/api/leads', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
  
  nego_start_mission: async (params) => apiFetch('/api/missions', {
    method: 'POST',
    body: JSON.stringify({
      url: params.url,
      query: params.query || '',
      maxPages: params.maxPages || 2,
      maxListings: params.maxListings || 50,
      maxReveals: params.maxReveals || 5,
      useProxy: params.useProxy || false,
    }),
  }),
  
  nego_get_missions: async () => apiFetch('/api/missions'),
  
  nego_get_mission: async ({ missionId }) => apiFetch(`/api/missions/${missionId}`),
  
  nego_stop_mission: async ({ missionId }) => apiFetch(`/api/missions/${missionId}/stop`, {
    method: 'POST',
  }),
  
  nego_reveal_phone: async ({ url, useProxy = false }) => apiFetch('/api/reveal', {
    method: 'POST',
    body: JSON.stringify({ url, useProxy }),
  }),
  
  nego_get_conversations: async ({ leadId }) => apiFetch(`/api/messages/${leadId}`),
  
  nego_chat_reply: async ({ leadId, channel = 'whatsapp' }) => apiFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ leadId, channel }),
  }),
  
  nego_whatsapp_status: async ({ userId } = {}) => {
    // NegoApp uses session-based multi-user WhatsApp
    // Try to get status from session routes
    try {
      return await apiFetch(`/api/session/${userId || 'default'}/whatsapp/status`);
    } catch {
      return { connected: false, error: 'Could not reach WhatsApp status endpoint' };
    }
  },
  
  nego_send_whatsapp: async ({ userId, chatId, message }) => {
    return apiFetch(`/api/session/${userId || 'default'}/whatsapp/send`, {
      method: 'POST',
      body: JSON.stringify({ chatId, message }),
    });
  },
  
  nego_get_config: async () => apiFetch('/api/config'),
  
  nego_get_stats: async () => {
    const [leadsRes, missionsRes] = await Promise.allSettled([
      apiFetch('/api/leads'),
      apiFetch('/api/missions'),
    ]);
    
    const leads = leadsRes.status === 'fulfilled' ? leadsRes.value : [];
    const missions = missionsRes.status === 'fulfilled' ? missionsRes.value : [];
    
    const leadsArray = Array.isArray(leads) ? leads : [];
    const missionsArray = Array.isArray(missions) ? missions : [];
    
    return {
      totalLeads: leadsArray.length,
      byStatus: leadsArray.reduce((acc, l) => {
        acc[l.status || 'unknown'] = (acc[l.status || 'unknown'] || 0) + 1;
        return acc;
      }, {}),
      totalMissions: missionsArray.length,
      completedMissions: missionsArray.filter(m => m.status === 'completed').length,
      runningMissions: missionsArray.filter(m => ['scraping', 'revealing', 'discovering'].includes(m.status)).length,
    };
  },
};

// ─── WebSocket Bridge Connection ─────────────────────────────────────────────

let ws = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  console.log(`[Bridge] Connecting to ${BRIDGE_URL}...`);
  ws = new WebSocket(BRIDGE_URL);

  ws.on('open', () => {
    console.log('[Bridge] ✅ Connected to usa-app');
    reconnectAttempts = 0;

    // Register with agent name and tools
    ws.send(JSON.stringify({
      type: 'register',
      agent: 'negoapp',
      tools: TOOLS,
    }));
    console.log(`[Bridge] Registered as "negoapp" with ${TOOLS.length} tools`);
  });

  ws.on('message', async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      console.error('[Bridge] Invalid JSON from server');
      return;
    }

    // Handle ping/pong
    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
      return;
    }

    // Handle tool call
    if (msg.id && msg.tool) {
      console.log(`[Bridge] 📥 Tool call: ${msg.tool} (id: ${msg.id})`);
      
      const handler = TOOL_HANDLERS[msg.tool];
      if (!handler) {
        ws.send(JSON.stringify({
          id: msg.id,
          error: `Unknown tool: ${msg.tool}`,
        }));
        return;
      }

      try {
        const result = await handler(msg.params || {});
        ws.send(JSON.stringify({ id: msg.id, result }));
        console.log(`[Bridge] ✅ ${msg.tool} completed`);
      } catch (err) {
        console.error(`[Bridge] ❌ ${msg.tool} failed:`, err.message);
        ws.send(JSON.stringify({
          id: msg.id,
          error: err.message,
        }));
      }
    }
  });

  ws.on('close', () => {
    console.log('[Bridge] Disconnected from usa-app');
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error('[Bridge] WebSocket error:', err.message);
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  
  const delay = Math.min(2000 * Math.pow(1.5, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  
  console.log(`[Bridge] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${reconnectAttempts})...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

// ─── Start ───────────────────────────────────────────────────────────────────

console.log(`
╔══════════════════════════════════════════╗
║  NegoApp MCP Bridge Client              ║
║  Bridge URL: ${BRIDGE_URL.padEnd(27)}║
║  NegoApp API: ${NEGO_API.padEnd(26)}║
║  User: ${NEGO_USER.padEnd(34)}║
║  Tools: ${String(TOOLS.length).padEnd(33)}║
╚══════════════════════════════════════════╝
`);

// Login first, then connect bridge
login().then(() => connect());

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[Bridge] Shutting down...');
  if (ws) ws.close();
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('[Bridge] Shutting down...');
  if (ws) ws.close();
  process.exit(0);
});
