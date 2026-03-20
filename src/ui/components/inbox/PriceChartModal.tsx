import React from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Lead } from '../../types';

interface PriceChartModalProps {
  lead: Lead;
  onClose: () => void;
}

export default function PriceChartModal({ lead, onClose }: PriceChartModalProps) {
  if (!lead.priceHistory || lead.priceHistory.length === 0) return null;
  const marketAvg = lead.marketValue ? parseInt(lead.marketValue) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="glass-panel rounded-3xl p-6 w-full max-w-lg relative z-10 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold">{lead.title}</h3>
            <p className="text-xs text-zinc-500">{lead.sellerName} • Price History</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ReLineChart data={lead.priceHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 10 }} domain={['dataMin - 200', 'dataMax + 200']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', fontSize: '12px' }}
                labelStyle={{ color: '#a1a1aa' }}
              />
              {marketAvg && (
                <ReferenceLine
                  y={marketAvg}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  label={{ value: 'Preț Mediu Piață', fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }}
                />
              )}
              <Line
                type="monotone"
                dataKey="price"
                stroke="#6366f1"
                strokeWidth={3}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload.eventType === 'accepted') {
                    return <circle cx={cx} cy={cy} r={6} fill="#10b981" stroke="#fff" strokeWidth={2} />;
                  }
                  if (payload.eventType === 'message') {
                    return <circle cx={cx} cy={cy} r={4} fill="#6366f1" stroke="#fff" strokeWidth={2} />;
                  }
                  return <circle cx={cx} cy={cy} r={3} fill="#6366f1" />;
                }}
              />
            </ReLineChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {lead.priceHistory.filter(p => p.event).map((p, i) => (
            <div key={i} className="flex items-center gap-3 text-xs">
              <div className={`w-2 h-2 rounded-full ${p.eventType === 'accepted' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
              <span className="text-zinc-500">{p.date}</span>
              <span className="text-zinc-300">{p.event}</span>
              <span className="ml-auto font-bold">{p.price} lei</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
