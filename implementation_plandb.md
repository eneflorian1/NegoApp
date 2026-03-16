# Migrare de la JSON la MongoDB

Pentru a rezolva problema leak-ului de API key (care se salvează în `data/config.json`) și pentru a face aplicația mai scalabilă, propun migrarea întregii baze de date (Config, Leads, Messages, Missions) către MongoDB folosind Mongoose.

## User Review Required

> [!IMPORTANT]
> - Ai deja un cluster de MongoDB (ex: MongoDB Atlas) sau vrei să instalăm MongoDB local? Dacă ai unul pregătit, te rog să furnizezi string-ul de conexiune (URL-ul pe care îl vom pune în `.env`). În caz contrar, o să setez temporar un URI local `mongodb://localhost:27017/negoapp`.
> - Mai sunt date importante în fișierele curente JSON (`data/*.json`) pe care dorești să le scriem un script pentru a le migra în MongoDB automat, sau putem porni de la zero cu baza de date nouă?

## Proposed Changes

### Dependințe
Se vor rula următoarele comenzi:
`npm install mongoose dotenv`

---

### `server.js` și Modele (componente noi)
Vom arhitecturaliza baza de date prin crearea de structuri pentru date.

#### [NEW] `src/db/models/Config.js`
Schema pentru setări globale, incluzând `geminiApiKey`, `meetingAddress`, etc.

#### [NEW] `src/db/models/Lead.js`
Schema pentru Leads cu referințe, înlocuind array-ul din memorie.

#### [NEW] `src/db/models/Message.js`
Schema pentru mesaje, ce păstrează istoricul pentru bot.

#### [NEW] `src/db/models/Mission.js`
Schema pentru misiunile de scrapare.

#### [MODIFY] `server.js`
- Ștergerea funcțiilor `loadConfig`, `saveConfig`, `loadLeads`, `saveLeads`, etc.
- Conectarea la MongoDB pe linia de pornire a serverului.
- Refactorizarea rutelor Express (`app.get`, `app.post`) pentru a face fetch din MongoDB (ex: `await Lead.find()`).
- Schimbarea clienților (WhatsApp, AgentMail) pentru a interacționa cu Mongoose în locul manipulării unor array-uri globale cu funcții sincrone.

#### [MODIFY] `.gitignore`
Asigurarea faptului că folderul `data/` (dacă râmâne) și fișierul `.env` sunt excluse în mod expres pentru a preîntâmpina încărcarea din greșeală.

## Verification Plan

### Manual Verification
1. Pornirea serverului (`npm run dev`) confirmă conexiunea cu succes la MongoDB.
2. Interfața web (Settings) salvează API token-ul în MongoDB (fără scrieri de JSON).
3. Sosirea unui mesaj pe WhatsApp folosește Gemini și interoghează baza MongoDB.
