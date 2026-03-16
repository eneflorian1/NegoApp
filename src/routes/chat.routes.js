/**
 * Chat Routes — /api/chat (AI chat orchestrator)
 */
import { Router } from 'express';
import MissionRepo from '../db/models/Mission.js';
import { autoContactSeller } from '../core/contact-service.js';

export default function createChatRoutes({ orchestrator, gemini, proxyManager, siteIntelligence, domainStrategy, whatsapp }) {
  const router = Router();

  router.post('/chat', async (req, res) => {
    const { message, history = [], personality = 'diplomat' } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const intent = detectIntent(message);
    console.log(`[Chat] Message: "${message}" → Intent: ${intent.action}`);

    try {
      let response;

      switch (intent.action) {
        case 'extract_phone': {
          const url = intent.url;
          if (!url) { response = { content: 'Am nevoie de un URL de listing. Ex: "Extrage telefonul din https://www.olx.ro/d/oferta/..."', toolCall: null }; break; }

          const domain = new URL(url).hostname.replace('www.', '');
          const mission = MissionRepo.create({
            mode: 'single', platform: domain.includes('olx') ? 'olx' : domain,
            url, useProxy: intent.useProxy || false, status: 'running', domain, strategy: domain,
          });

          (async () => {
            try {
              const result = await orchestrator.executeSingleReveal({ url, useProxy: intent.useProxy || false, personality });
              result.url = url;
              mission.results = [result];
              mission.leadsFound = 1;
              mission.leadsContacted = result.success ? 1 : 0;
              mission.progress = 100;
              mission.status = result.success ? 'completed' : 'error';
              mission.updatedAt = new Date().toISOString();
              MissionRepo.save();
              if (result.success) await autoContactSeller(result, { gemini, whatsapp });
            } catch (err) {
              mission.status = 'error';
              mission.results = [{ success: false, error: err.message, url }];
              mission.updatedAt = new Date().toISOString();
              MissionRepo.save();
            }
          })();

          response = {
            content: `Extrag telefonul din listing...\n\n🔗 ${url}\n\n_Misiune pornită: ${mission.id}_`,
            toolCall: { name: 'extract_phone', args: { url }, status: 'running' },
            missionId: mission.id,
          };
          break;
        }

        case 'scan_category': {
          const url = intent.url;
          if (!url) { response = { content: 'Am nevoie de un URL de categorie. Ex: "Scanează https://www.olx.ro/imobiliare/"', toolCall: null }; break; }

          const domain = new URL(url).hostname.replace('www.', '');
          const mission = MissionRepo.create({
            mode: 'category', platform: domain.includes('olx') ? 'olx' : domain,
            url, useProxy: intent.useProxy || false, status: 'running', domain, strategy: domain,
          });

          const maxListings = intent.maxListings || 50;
          const maxReveals = intent.maxReveals || 5;
          const maxPages = Math.max(1, Math.ceil(maxListings / 40));

          (async () => {
            try {
              const fullMission = await orchestrator.executeMission({
                url, query: '', domain, useProxy: intent.useProxy || false,
                maxPages, maxListings, maxReveals, personality,
                onPhoneRevealed: async (result) => {
                  mission.leadsContacted = (mission.leadsContacted || 0) + 1;
                  if (!mission.results) mission.results = [];
                  mission.results.push(result);
                  mission.updatedAt = new Date().toISOString();
                  MissionRepo.save();
                  if (result.phone) await autoContactSeller(result, { gemini, whatsapp });
                }
              });
              mission.results = fullMission.reveals || [];
              mission.leadsFound = fullMission.listings?.length || 0;
              mission.leadsContacted = fullMission.phones?.length || 0;
              mission.progress = 100;
              mission.status = 'completed';
              mission.summary = fullMission.summary;
              mission.updatedAt = new Date().toISOString();
              MissionRepo.save();
            } catch (err) {
              mission.status = 'error';
              mission.results = [{ success: false, error: err.message }];
              mission.updatedAt = new Date().toISOString();
              MissionRepo.save();
            }
          })();

          response = {
            content: `Pornesc scanarea categoriei...\n\n📂 ${url}\n📊 Filtru: ${maxListings} anunțuri, ${maxReveals} reveal-uri\n\n_Misiune pornită: ${mission.id}_`,
            toolCall: { name: 'scan_category', args: { url, maxPages, maxListings, maxReveals }, status: 'running' },
            missionId: mission.id,
          };
          break;
        }

        case 'analyze_listing': {
          if (!gemini.isAvailable) { response = { content: '⚠️ Gemini API nu este configurat. Setează GEMINI_API_KEY în .env', toolCall: null }; break; }
          const listingData = intent.data || message;
          const analysis = await gemini.analyzeListing({ description: listingData });
          response = { content: formatAnalysis(analysis), toolCall: { name: 'analyze_listing', args: { data: listingData }, result: analysis, status: 'completed' } };
          break;
        }

        case 'check_status': {
          const orchStats = orchestrator.getStats();
          const serverAll = MissionRepo.getAll();
          const running = serverAll.filter(m => m.status === 'running');
          let statusText = `**Status sistem:**\n`;
          statusText += `• Misiuni active: ${running.length + orchStats.running}\n`;
          statusText += `• Gemini AI: ${gemini.isAvailable ? '✅ Activ' : '❌ Dezactivat'}\n`;
          statusText += `• Proxy-uri: ${proxyManager.availableCount}/${proxyManager.totalCount}\n`;
          statusText += `• Total misiuni: ${serverAll.length + orchStats.total}\n`;
          if (running.length > 0) {
            statusText += `\n**Misiuni în curs:**\n`;
            running.forEach(m => { statusText += `• ${m.url} (${m.status})\n`; });
          }
          response = { content: statusText, toolCall: null };
          break;
        }

        case 'list_missions': {
          const allMissions = [
            ...orchestrator.getAllMissions(),
            ...MissionRepo.getAll(),
          ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          if (allMissions.length === 0) {
            response = { content: 'Nu ai nicio misiune. Trimite un URL pentru a începe o extracție.', toolCall: null };
          } else {
            let text = `**Ultimele ${Math.min(allMissions.length, 10)} misiuni:**\n\n`;
            allMissions.slice(0, 10).forEach((m, i) => {
              const phone = m.results?.[0]?.phone;
              const icon = m.status === 'completed' ? '✅' : m.status === 'error' ? '❌' : '🔄';
              text += `${i + 1}. ${icon} ${m.results?.[0]?.listing?.title || m.url}\n`;
              if (phone) text += `   📞 ${phone}\n`;
            });
            response = { content: text, toolCall: null };
          }
          break;
        }

        default: {
          if (gemini.isAvailable) {
            const systemPrompt = `Ești asistentul AI al NegoApp — o platformă de negociere automată pe marketplace-uri.\nPoți ajuta cu: extragerea telefoanelor, analiza anunțurilor, scanare categorii, sfaturi negociere.\nProfil negociere activ: ${personality.toUpperCase()}.\nRăspunde concis în română. Dacă user-ul trimite un URL, sugerează-i extracția.`;
            const prompt = `${systemPrompt}\n\nUser: ${message}`;
            const aiText = await gemini.generate(prompt, { temperature: 0.7, maxTokens: 1024 });
            response = { content: aiText, toolCall: null };
          } else {
            response = { content: detectHelpMessage(message), toolCall: null };
          }
        }
      }

      res.json(response);
    } catch (err) {
      console.error(`[Chat] Error:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectIntent(message) {
  const msg = message.toLowerCase().trim();
  const urlMatch = message.match(/(https?:\/\/[^\s]+)/);
  const url = urlMatch ? urlMatch[1] : null;
  const useProxy = msg.includes('proxy') || msg.includes('ipv6');
  const limitMatch = msg.match(/--limit=(\d+)/);
  const revealsMatch = msg.match(/--reveals=(\d+)/);
  const maxListings = limitMatch ? parseInt(limitMatch[1]) : undefined;
  const maxReveals = revealsMatch ? parseInt(revealsMatch[1]) : undefined;

  if (url && (msg.includes('extrage') || msg.includes('telefon') || msg.includes('reveal') || msg.includes('phone') || msg.includes('extract') || msg.includes('nr'))) {
    return { action: 'extract_phone', url, useProxy };
  }
  if (url && (msg.includes('scan') || msg.includes('categori') || msg.includes('batch') || msg.includes('scanea'))) {
    return { action: 'scan_category', url, useProxy, maxListings, maxReveals };
  }
  if (url && !msg.includes('analiz')) return { action: 'extract_phone', url, useProxy };
  if (msg.includes('analiz') || msg.includes('analyze') || msg.includes('valoare') || msg.includes('pret')) {
    return { action: 'analyze_listing', url, data: message };
  }
  if (msg.includes('status') || msg.includes('stare')) return { action: 'check_status' };
  if (msg.includes('misiuni') || msg.includes('missions') || msg.includes('istoric') || msg.includes('history')) return { action: 'list_missions' };
  return { action: 'general', url };
}

function formatAnalysis(analysis) {
  if (analysis.raw) return analysis.raw;
  let text = '**📊 Analiză listing:**\n\n';
  if (analysis.marketValue) text += `💰 Valoare piață: ~${analysis.marketValue} RON\n`;
  if (analysis.dealQuality) text += `${analysis.dealQuality === 'great' ? '🟢' : analysis.dealQuality === 'fair' ? '🟡' : '🔴'} Calitate deal: ${analysis.dealQuality}\n`;
  if (analysis.negotiationTip) text += `💡 Sfat: ${analysis.negotiationTip}\n`;
  if (analysis.category) text += `📦 Categorie: ${analysis.category}\n`;
  if (analysis.keyFeatures?.length) text += `\n**Caracteristici:**\n${analysis.keyFeatures.map(f => `• ${f}`).join('\n')}`;
  return text;
}

function detectHelpMessage() {
  return `**🤖 NegoApp AI Orchestrator**

Poți folosi următoarele comenzi:

• **Extrage telefon** — trimite un URL de listing
  Ex: \`https://www.olx.ro/d/oferta/...\`

• **Scanează categorie** — trimite un URL de categorie
  Ex: \`Scanează https://www.olx.ro/imobiliare/\`

• **Status** — verifică starea sistemului

• **Misiuni** — vezi istoricul misiunilor

• **Analizează** — analizează o descriere de produs

Gemini AI nu este configurat. Setează \`GEMINI_API_KEY\` în \`.env\` pentru conversație liberă.`;
}
