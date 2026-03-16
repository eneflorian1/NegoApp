/**
 * Script to extract components from App.tsx into separate files.
 * Run with: node scripts/split-components.js
 */
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('src/ui/App.tsx', 'utf-8');
const lines = content.split(/\r?\n/);

// Find component boundaries
function findLine(pattern) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(pattern)) return i;
  }
  throw new Error(`Pattern not found: ${pattern}`);
}

function findClosingBrace(startLine) {
  let depth = 0;
  for (let i = startLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
    }
    if (depth === 0) return i;
  }
  throw new Error(`No closing brace found from line ${startLine}`);
}

// Find all component starts
const components = {};
const starts = {
  'DashboardView': findLine('function DashboardView('),
  'InboxView': findLine('function InboxView('),
  'OrchestratorView': findLine('function OrchestratorView('),
  'DatabaseView': findLine('function DatabaseView('),
  'LeadsView': findLine('function LeadsView('),
  'SettingsView': findLine('function SettingsView('),
};

// Find ends (closing brace at depth 0)
for (const [name, start] of Object.entries(starts)) {
  const end = findClosingBrace(start);
  components[name] = { start, end };
  console.log(`${name}: lines ${start + 1}-${end + 1} (${end - start + 1} lines)`);
}

// Find helpers
const getStatusStyleLine = findLine('const getStatusStyle =');
const getStatusStyleEnd = findClosingBrace(getStatusStyleLine);
const parsePriceLine = findLine('const parsePrice =');
const parsePriceEnd = findClosingBrace(parsePriceLine);
const formatPhoneLine = findLine('function formatPhone(');
const formatPhoneEnd = findClosingBrace(formatPhoneLine);
const navItemLine = findLine('function NavItem(');
const navItemEnd = findClosingBrace(navItemLine);

console.log(`\nNavItem: lines ${navItemLine + 1}-${navItemEnd + 1}`);
console.log(`getStatusStyle: lines ${getStatusStyleLine + 1}-${getStatusStyleEnd + 1}`);
console.log(`parsePrice: lines ${parsePriceLine + 1}-${parsePriceEnd + 1}`);
console.log(`formatPhone: lines ${formatPhoneLine + 1}-${formatPhoneEnd + 1}`);

// Create components directory
const compDir = 'src/ui/components';
if (!fs.existsSync(compDir)) fs.mkdirSync(compDir, { recursive: true });

// Extract helpers file
const helpersContent = `import { Lead } from '../types';

export ${lines.slice(getStatusStyleLine, getStatusStyleEnd + 1).join('\n')}

export ${lines.slice(parsePriceLine, parsePriceEnd + 1).join('\n')}

export ${lines.slice(formatPhoneLine, formatPhoneEnd + 1).join('\n')}
`;
fs.writeFileSync('src/ui/helpers.ts', helpersContent);
console.log('\nWrote src/ui/helpers.ts');

// Extract mock data
const mockDataStart = findLine('// --- Mock Data ---');
const mockDataEnd = starts['DashboardView'] - 2; // just before first component
// we also need the App function start, so mock data goes up to export default function App
const appFnLine = findLine('export default function App()');
const mockLines = lines.slice(mockDataStart, appFnLine);
const mockContent = `import { Lead, Message, MarketStats } from './types';

${mockLines.join('\n')}
`;
fs.writeFileSync('src/ui/mockData.ts', mockContent);
console.log('Wrote src/ui/mockData.ts');

// Extract each view component
const viewImports = {
  DashboardView: {
    lucide: ['TrendingUp', 'CheckCircle2', 'Clock', 'BarChart3', 'PieChart'],
    recharts: true,
    motion: true,
    helpers: ['parsePrice'],
    types: ['Lead', 'Config'],
  },
  InboxView: {
    lucide: ['Send', 'Phone', 'Mail', 'ExternalLink', 'CheckCircle2', 'ChevronLeft', 'MoreVertical', 'AlertCircle', 'X', 'MessageSquare'],
    recharts: true,
    motion: true,
    helpers: ['getStatusStyle', 'parsePrice'],
    types: ['Lead', 'Message'],
    needsMockMessages: true,
  },
  OrchestratorView: {
    lucide: ['Zap', 'CheckCircle2', 'BarChart3', 'MessageSquare', 'X'],
    motion: true,
    helpers: ['formatPhone'],
    types: ['OrchestratorTask', 'RevealResult'],
  },
  DatabaseView: {
    lucide: ['Search', 'Filter', 'ExternalLink', 'Phone'],
    motion: true,
    helpers: ['getStatusStyle'],
    types: ['Lead'],
  },
  LeadsView: {
    lucide: ['Search', 'Filter', 'ExternalLink', 'Phone', 'TrendingUp', 'ChevronLeft', 'ArrowRight', 'X'],
    recharts: true,
    motion: true,
    helpers: ['getStatusStyle', 'parsePrice'],
    types: ['Lead', 'MarketStats'],
  },
  SettingsView: {
    lucide: ['Settings', 'Zap', 'Phone', 'Mail', 'CheckCircle2'],
    motion: true,
    types: ['Config'],
  },
};

for (const [name, { start, end }] of Object.entries(components)) {
  const info = viewImports[name];
  const bodyLines = lines.slice(start, end + 1);

  // Build imports
  let imports = `import React, { useState, useEffect, useRef } from 'react';\n`;

  if (info.lucide && info.lucide.length > 0) {
    imports += `import { ${info.lucide.join(', ')} } from 'lucide-react';\n`;
  }

  if (info.recharts) {
    imports += `import { LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';\n`;
  }

  if (info.motion) {
    imports += `import { motion, AnimatePresence } from 'motion/react';\n`;
  }

  if (info.types && info.types.length > 0) {
    imports += `import { ${info.types.join(', ')} } from '../types';\n`;
  }

  if (info.helpers && info.helpers.length > 0) {
    imports += `import { ${info.helpers.join(', ')} } from '../helpers';\n`;
  }

  // Check if component uses MOCK_MESSAGES
  const bodyText = bodyLines.join('\n');
  if (bodyText.includes('MOCK_MESSAGES')) {
    // Inline mock messages — find them in the component body
  }

  // Convert function declaration to export
  let bodyStr = bodyLines.join('\n');
  bodyStr = bodyStr.replace(`function ${name}(`, `export default function ${name}(`);

  const fileContent = `${imports}\n${bodyStr}\n`;
  const filePath = path.join(compDir, `${name}.tsx`);
  fs.writeFileSync(filePath, fileContent);
  console.log(`Wrote ${filePath} (${bodyLines.length} lines)`);
}

console.log('\n✅ All components extracted. Now rewrite App.tsx.');
