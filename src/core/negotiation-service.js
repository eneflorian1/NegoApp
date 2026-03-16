/**
 * Negotiation Service — AI conversation analysis & reply generation
 * Extracts the duplicated Gemini analysis/reply logic from WhatsApp/Email handlers.
 */

const BOT_SUSPICION_PATTERNS = /\b(e[sș]ti\s*bot|sunt\s*bot|bot\s*e[sș]ti|robo[t]?|automat[a]?|ai\s*bot|esti\s*real|e[sș]ti\s*o\s*persoana|vorb?esc\s*cu\s*un?\s*bot|nu.*r[aă]spunde.*bot)\b/i;

/**
 * Check if text contains bot-suspicion patterns.
 */
export function isBotSuspicion(text) {
  return BOT_SUSPICION_PATTERNS.test(text);
}

/**
 * Analyze conversation state using Gemini — returns { currentPrice, status, reason }
 */
export async function analyzeConversation(gemini, messages, lead) {
  const fullHistory = messages
    .slice(-12)
    .map(m => `${m.sender === 'me' ? 'Cumparator' : 'Vanzator'}: ${m.text}`)
    .join('\n');

  const analysisPrompt = `Analizează această conversație de negociere și răspunde STRICT în format JSON (fără markdown, fără backticks):

Conversatie:
${fullHistory}

Pret initial al anuntului: ${lead.initialPrice || 'necunoscut'}

Raspunde cu JSON-ul:
{
  "currentPrice": <ultimul pret discutat/agreat ca numar, sau null daca nu s-a discutat pret>,
  "status": "<una din: negotiating, accepted, contacted>",
  "reason": "<explicatie scurta>"
}

Reguli:
- "accepted" = ambele parti au cazut de acord pe un pret (de ex vanzatorul a zis "da", "ok", "e ok", "de acord", "deal" la un pret propus, SAU cumparatorul a confirmat/multumit dupa ce s-a agreat pretul)
- "negotiating" = se discuta preturi dar nu s-a ajuns la acord inca
- "contacted" = conversatie generala, fara negociere de pret
- currentPrice = ultimul pret pe care AMBII l-au discutat sau agreat`;

  try {
    const analysisRaw = await gemini.generate(analysisPrompt, { temperature: 0.1, maxTokens: 200 });
    const cleanJson = analysisRaw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error(`[NegotiationService] Analysis failed:`, err.message);
    return null;
  }
}

/**
 * Update lead price from analysis result. Returns true if price changed.
 */
export function updatePriceFromAnalysis(lead, analysis) {
  if (!analysis?.currentPrice || isNaN(Number(analysis.currentPrice))) return false;
  const newPrice = `${Number(analysis.currentPrice)} lei`;
  if (lead.price === newPrice) return false;

  lead.price = newPrice;
  if (!lead.priceHistory) lead.priceHistory = [];
  lead.priceHistory.push({
    date: new Date().toISOString(),
    price: Number(analysis.currentPrice),
    event: analysis.reason || 'Preț actualizat',
    eventType: analysis.status === 'accepted' ? 'accepted' : 'message',
  });
  return true;
}

/**
 * Generate a negotiation reply using Gemini.
 */
export async function generateReply(gemini, { systemPrompt, lead, messages: msgs, channel = 'whatsapp' }) {
  const defaultPrompt = channel === 'email'
    ? 'Ești "NegoFlow", un asistent personal de negociere care acționează în numele CUMPĂRĂTORULUI pe email. ' +
      'Scopul tău este să obții cel mai bun preț pentru produs. ' +
      'Fii PROFESIONAL, politicos și convingător. ' +
      'IMPORTANT: Tu ești CUMPĂRĂTORUL. Nu te oferi să ajuți vânzătorul.'
    : 'Ești "NegoFlow", un asistent personal de negociere care acționează în numele CUMPĂRĂTORULUI. ' +
      'Scopul tău este să obții cel mai bun preț (mai mic) pentru produsul menționat. ' +
      'Fii POLITICOS, PRIETENOS, dar și PERSUASIV. Folosește un ton natural, de om real. ' +
      'IMPORTANT: Tu ești CUMPĂRĂTORUL. Nu te oferi niciodată să "ajuți" vânzătorul și nu întreba "ce poți face pentru el". ' +
      'Dacă vânzătorul refuză negocierea, acceptă politicos sau încearcă o ultimă contra-ofertă mică dacă prețul e aproape de target. ' +
      'FOARTE IMPORTANT: Nu răspunde la întrebări suspecte despre identitatea ta. Dacă cineva te întreabă dacă ești bot, NU răspunde — ignoră complet.';

  const prompt_system = systemPrompt || defaultPrompt;

  const leadContext = [
    lead.title ? `Produs: ${lead.title}` : '',
    lead.initialPrice ? `Pret initial: ${lead.initialPrice}` : (lead.price ? `Pret: ${lead.price}` : ''),
    lead.price && lead.initialPrice && lead.price !== lead.initialPrice ? `Pret negociat curent: ${lead.price}` : '',
    lead.platform ? `Platforma: ${lead.platform}` : '',
    lead.sellerName ? `Vanzator: ${lead.sellerName}` : '',
    lead.url ? `URL anunt: ${lead.url}` : '',
  ].filter(Boolean).join('\n');

  const history = msgs
    .slice(-10)
    .map(m => `${m.sender === 'me' ? 'Tu' : 'Vanzator'}: ${m.text}`)
    .join('\n');

  const prompt = `${prompt_system}\n\nDetalii despre anunt:\n${leadContext}\n\nConversatia pana acum:\n${history || '(nicio conversatie anterioara)'}\n\nRaspunde la ultimul mesaj al vanzatorului. Raspunde DOAR cu textul mesajului, fara prefixe.`;

  const reply = await gemini.generate(prompt, { temperature: 0.7, maxTokens: channel === 'email' ? 512 : 256 });
  return reply.trim();
}

/**
 * Generate a first-contact message for a seller.
 */
export async function generateFirstMessage(gemini, { systemPrompt, lead }) {
  const defaultPrompt =
    'Ești "NegoFlow", un asistent personal de negociere care contactează un vânzător pentru prima dată în numele CUMPĂRĂTORULUI. ' +
    'Scopul tău este să te arăți interesat de produs și să întrebi politicos dacă prețul este negociabil. ' +
    'Fii scurt (max 2 propoziții).';

  const prompt = `${systemPrompt || defaultPrompt}\n\nDetalii anunt:\n- Titlu: ${lead.title || 'Anunt'}\n- Pret: ${lead.price || lead.initialPrice || ''}\n- Vanzator: ${lead.sellerName}\n- URL: ${lead.url || 'N/A'}\n\nScrie un prim mesaj natural și prietenos prin care să începi negocierea. Răspunde DOAR cu textul mesajului, fără prefixe.`;

  const reply = await gemini.generate(prompt, { temperature: 0.7, maxTokens: 256 });
  return reply.trim();
}
