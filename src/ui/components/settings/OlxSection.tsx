import React, { useState, useRef } from 'react';
import { ShoppingBag, CheckCircle2, AlertCircle, Loader2, Monitor, ExternalLink, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OlxSectionProps {
  olxStatus: { valid: boolean; cookieCount?: number; loginDate?: string; expiresAt?: string } | null;
  setOlxStatus: React.Dispatch<React.SetStateAction<any>>;
}

export default function OlxSection({ olxStatus, setOlxStatus }: OlxSectionProps) {
  // OLX Credentials
  const [olxEmail, setOlxEmail] = useState(() => localStorage.getItem('olx_email') || '');
  const [olxPassword, setOlxPassword] = useState(() => localStorage.getItem('olx_password') || '');
  const [olxCredsSaved, setOlxCredsSaved] = useState(false);
  const [olxConnecting, setOlxConnecting] = useState(false);
  const [olxError, setOlxError] = useState<string | null>(null);
  const [olxCookieInput, setOlxCookieInput] = useState('');
  const [olxImporting, setOlxImporting] = useState(false);
  const [olxShowImport, setOlxShowImport] = useState(false);

  // Browser Login
  const [browserLoginOpen, setBrowserLoginOpen] = useState(false);

  // Virtual Browser
  const [vbOpen, setVbOpen] = useState(false);
  const [vbSessionId, setVbSessionId] = useState<string | null>(null);
  const [vbScreenshot, setVbScreenshot] = useState<string | null>(null);
  const [vbStatus, setVbStatus] = useState<'starting' | 'ready' | 'loggedIn' | 'closed' | null>(null);
  const [vbLoading, setVbLoading] = useState(false);
  const [vbTypeText, setVbTypeText] = useState('');
  const [vbError, setVbError] = useState<string | null>(null);
  const vbPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vbImgRef = useRef<HTMLImageElement | null>(null);

  // ── Handlers ──

  const handleSaveOlxCreds = () => {
    localStorage.setItem('olx_email', olxEmail);
    localStorage.setItem('olx_password', olxPassword);
    setOlxCredsSaved(true);
    setTimeout(() => setOlxCredsSaved(false), 2000);
  };

  const handleOlxImport = async () => {
    if (!olxCookieInput.trim()) return;
    setOlxImporting(true);
    setOlxError(null);
    try {
      const res = await fetch('/api/session/olx/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: olxCookieInput.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setOlxError(data.error || 'Import eșuat');
      } else {
        const statusRes = await fetch('/api/session/olx/status', { credentials: 'include' });
        setOlxStatus(await statusRes.json());
        setOlxCookieInput('');
        setOlxShowImport(false);
      }
    } catch (err: any) {
      setOlxError(err.message || 'Eroare de rețea.');
    } finally {
      setOlxImporting(false);
    }
  };

  // ── Virtual Browser helpers ──

  const vbStopPolling = () => {
    if (vbPollRef.current) { clearInterval(vbPollRef.current); vbPollRef.current = null; }
  };

  const vbApplyResponse = async (data: any) => {
    if (data.screenshot) setVbScreenshot(data.screenshot);
    if (data.status) setVbStatus(data.status as any);
    if (data.status === 'loggedIn') {
      vbStopPolling();
      const statusRes = await fetch('/api/session/olx/status', { credentials: 'include' });
      setOlxStatus(await statusRes.json());
      setTimeout(() => { setVbOpen(false); setVbSessionId(null); setVbScreenshot(null); setVbStatus(null); }, 2500);
    }
  };

  const vbStartPolling = (sessionId: string) => {
    vbStopPolling();
    vbPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/session/olx/vb/${sessionId}/screenshot`, { credentials: 'include' });
        if (!res.ok) { vbStopPolling(); return; }
        await vbApplyResponse(await res.json());
      } catch {}
    }, 1200);
  };

  const handleVbOpen = async () => {
    if (!olxEmail || !olxPassword) {
      setOlxError('Completează email-ul și parola înainte de conectare.');
      return;
    }
    setVbOpen(true);
    setVbError(null);
    setVbScreenshot(null);
    setVbStatus('starting');
    setVbLoading(true);
    const email = olxEmail;
    const password = olxPassword;
    try {
      const res = await fetch('/api/session/olx/vb/start', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nu am putut porni browserul');
      const sessionId = data.sessionId;
      setVbSessionId(sessionId);
      setVbStatus(data.status);
      if (data.screenshot) setVbScreenshot(data.screenshot);
      vbStartPolling(sessionId);
      setVbLoading(true);
      const fillRes = await fetch(`/api/session/olx/vb/${sessionId}/autofill`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const fillData = await fillRes.json();
      await vbApplyResponse(fillData);
      if (!fillData.ok && fillData.error) setVbError(fillData.error);
    } catch (err: any) {
      setVbError(err.message);
      setVbStatus(null);
    } finally {
      setVbLoading(false);
    }
  };

  const handleVbClose = async () => {
    vbStopPolling();
    if (vbSessionId) {
      fetch(`/api/session/olx/vb/${vbSessionId}/close`, { method: 'POST', credentials: 'include' }).catch(() => {});
    }
    setVbOpen(false);
    setVbSessionId(null);
    setVbScreenshot(null);
    setVbStatus(null);
    setVbError(null);
    setVbTypeText('');
  };

  const handleVbClick = async (e: React.MouseEvent<HTMLImageElement> | React.TouchEvent<HTMLImageElement>) => {
    if (!vbSessionId || vbStatus !== 'ready') return;
    const img = vbImgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    let cx: number, cy: number;
    if ('touches' in e) {
      cx = e.touches[0].clientX - rect.left;
      cy = e.touches[0].clientY - rect.top;
    } else {
      cx = (e as React.MouseEvent).clientX - rect.left;
      cy = (e as React.MouseEvent).clientY - rect.top;
    }
    try {
      const res = await fetch(`/api/session/olx/vb/${vbSessionId}/click`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: cx, y: cy, displayW: rect.width, displayH: rect.height }),
      });
      await vbApplyResponse(await res.json());
    } catch {}
  };

  const handleVbType = async () => {
    if (!vbSessionId || !vbTypeText.trim()) return;
    const text = vbTypeText;
    setVbTypeText('');
    try {
      const res = await fetch(`/api/session/olx/vb/${vbSessionId}/type`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      await vbApplyResponse(await res.json());
    } catch {}
  };

  const handleVbKey = async (key: string) => {
    if (!vbSessionId) return;
    try {
      const res = await fetch(`/api/session/olx/vb/${vbSessionId}/key`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      await vbApplyResponse(await res.json());
    } catch {}
  };

  const handleVbScroll = async (deltaY: number) => {
    if (!vbSessionId) return;
    try {
      const res = await fetch(`/api/session/olx/vb/${vbSessionId}/scroll`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deltaY }),
      });
      await vbApplyResponse(await res.json());
    } catch {}
  };

  return (
    <>
      <section className="space-y-4">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-blue-400" /> OLX Integration
          <div className={`ml-auto w-2.5 h-2.5 rounded-full ${olxStatus?.valid ? 'bg-emerald-500 animate-pulse' : olxConnecting ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
        </h3>

        {olxStatus?.valid ? (
          <div className="p-6 bg-zinc-800/30 rounded-2xl border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="font-medium text-emerald-400">Autentificat (Sesiune Activă)</p>
                <p className="text-xs text-zinc-500">
                  {olxStatus.cookieCount} cookies · {new Date(olxStatus.loginDate || Date.now()).toLocaleDateString()}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-zinc-400 max-w-[200px] text-left md:text-right leading-tight">
              100% numere vizibile. Sesiunea este folosită automat.
            </p>
          </div>
        ) : (
          <div className="p-6 bg-zinc-800/30 rounded-2xl border border-zinc-800/50 space-y-4">
            <div className="flex items-start gap-4 mb-2">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
                <ShoppingBag className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-zinc-300">Autentificare OLX</p>
                <p className="text-[11px] text-zinc-500 leading-snug">
                  Necesară o singură dată pentru extragerea 100% a numerelor de telefon.
                </p>
              </div>
            </div>

            {/* Credentials */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold">Email Cont OLX</label>
                <input
                  type="email"
                  value={olxEmail}
                  onChange={(e) => { setOlxEmail(e.target.value); setOlxCredsSaved(false); }}
                  placeholder="email@example.com"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold">Parolă</label>
                <input
                  type="password"
                  value={olxPassword}
                  onChange={(e) => { setOlxPassword(e.target.value); setOlxCredsSaved(false); }}
                  placeholder="••••••••"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveOlxCreds()}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <button
                onClick={handleSaveOlxCreds}
                disabled={!olxEmail || !olxPassword}
                className="w-full py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-700/50 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-zinc-200 transition-colors flex items-center justify-center gap-2"
              >
                {olxCredsSaved ? <><Check className="w-4 h-4 text-emerald-400" /> Salvat</> : 'Salvează datele'}
              </button>
            </div>

            {olxError && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-[11px] text-red-400">{olxError}</p>
              </div>
            )}

            {/* Connect buttons */}
            <div className="space-y-3">
              <button
                onClick={() => { window.open('https://www.olx.ro/cont/', '_blank'); setBrowserLoginOpen(true); }}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-900/30"
              >
                <ExternalLink className="w-4 h-4" />
                Deschide OLX (login din browserul tău)
              </button>

              {browserLoginOpen && (
                <div className="space-y-3 p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    1. Loghează-te pe OLX în tab-ul deschis<br/>
                    2. După login, copiază cookie-urile (F12 → Console → scrie <code className="px-1 py-0.5 bg-zinc-800 rounded text-[10px] font-mono">document.cookie</code> → Enter → copiază rezultatul)<br/>
                    3. Lipește cookie-urile aici:
                  </p>
                  <textarea
                    value={olxCookieInput}
                    onChange={(e) => setOlxCookieInput(e.target.value)}
                    placeholder='Lipește cookie-urile aici...'
                    rows={4}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-3 text-xs font-mono text-zinc-300 resize-none focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    onClick={handleOlxImport}
                    disabled={!olxCookieInput.trim() || olxImporting}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/40 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
                  >
                    {olxImporting ? <><Loader2 className="w-4 h-4 animate-spin" /> Se importă...</> : 'Salvează Cookie-urile'}
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-[10px] text-zinc-600 uppercase">sau</span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              <button
                onClick={handleVbOpen}
                disabled={!olxEmail || !olxPassword}
                className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-800 disabled:bg-zinc-700/40 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-zinc-300 transition-colors flex items-center justify-center gap-2.5"
              >
                <Monitor className="w-4 h-4" />
                Conectează via Server (Virtual Browser)
              </button>
              <p className="text-center text-[10px] text-zinc-600">
                Serverul completează datele automat (poate fi detectat ca bot)
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Virtual Browser Modal */}
      <AnimatePresence>
        {vbOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-zinc-950"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-blue-400" />
                <span className="font-medium text-sm">Login OLX</span>
                {vbStatus === 'starting' && <span className="text-[10px] text-amber-400 animate-pulse ml-1">pornire...</span>}
                {vbStatus === 'ready' && <span className="text-[10px] text-emerald-400 ml-1">● activ</span>}
                {vbStatus === 'loggedIn' && <span className="text-[10px] text-emerald-400 animate-pulse ml-1">✓ autentificat!</span>}
              </div>
              <button onClick={handleVbClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error */}
            {vbError && (
              <div className="mx-3 mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-xs text-red-400">{vbError}</p>
              </div>
            )}

            {/* Screenshot area */}
            <div className="flex-1 flex items-center justify-center overflow-hidden min-h-0 relative">
              {vbLoading && !vbScreenshot ? (
                <div className="flex flex-col items-center gap-3 text-zinc-500">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                  <p className="text-sm">Se deschide browserul...</p>
                  <p className="text-xs text-zinc-600">Poate dura 15-25 secunde</p>
                </div>
              ) : vbStatus === 'loggedIn' ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-9 h-9 text-emerald-500" />
                  </div>
                  <p className="font-semibold text-emerald-400">Autentificat cu succes!</p>
                  <p className="text-xs text-zinc-500">Sesiunea OLX a fost salvată automat.</p>
                </div>
              ) : vbScreenshot ? (
                <>
                  <img
                    ref={vbImgRef}
                    src={`data:image/jpeg;base64,${vbScreenshot}`}
                    alt="OLX browser"
                    className="max-w-full max-h-full object-contain cursor-crosshair select-none"
                    style={{ touchAction: 'none' }}
                    onClick={handleVbClick}
                    onTouchStart={handleVbClick}
                    draggable={false}
                  />
                  {vbStatus === 'ready' && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1">
                      <button onClick={() => handleVbScroll(-300)} className="p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg text-zinc-400 text-xs">▲</button>
                      <button onClick={() => handleVbScroll(300)} className="p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg text-zinc-400 text-xs">▼</button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-zinc-600">
                  <Monitor className="w-8 h-8" />
                  <p className="text-sm">Așteptare browser...</p>
                </div>
              )}
            </div>

            {/* Bottom bar */}
            {vbStatus === 'ready' && (
              <div className="flex-shrink-0 border-t border-zinc-800 px-3 py-2 space-y-1.5">
                <p className="text-[10px] text-zinc-600 text-center">Interacțiune manuală (pentru CAPTCHA)</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={vbTypeText}
                    onChange={(e) => setVbTypeText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleVbType(); }}
                    placeholder="Text manual..."
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button onClick={handleVbType} disabled={!vbTypeText.trim()} className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 rounded-xl text-sm text-zinc-200 transition-colors">Trimite</button>
                </div>
                <div className="flex gap-1.5">
                  {(['Tab', 'Enter', 'Backspace', 'Escape'] as const).map(k => (
                    <button key={k} onClick={() => handleVbKey(k)}
                      className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[11px] text-zinc-400 transition-colors">
                      {k === 'Backspace' ? '⌫' : k}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
