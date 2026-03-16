# NegoFlow - Production Blueprint & Architecture

Acest document descrie viziunea completă a proiectului **NegoFlow**, un orchestrator AI pentru automatizarea proceselor de marketplace (OLX, Publi24, etc.), de la extracția datelor până la negocierea automată a prețurilor.

---

## 1. Viziunea Proiectului
NegoFlow este conceput ca un sistem "Hands-Off" și **Global-Ready**. Spre deosebire de un scraper clasic, acesta nu este limitat la designul unui singur site. Arhitectura permite adaptarea instantanee la:
- **Marketplace-uri Locale**: OLX.ro, Publi24, Lajumate.
- **Platforme Internaționale**: **Craigslist.org**, Facebook Marketplace, Gumtree.
- **Logica Agnostică**: Sistemul tratează Craigslist (care are un HTML minimalist și arhaic) folosind aceleași principii de AI Pattern Recognition ca pe OLX (care este modern și complex). AI-ul identifică butoanele de "Reply" sau "Show Phone" indiferent de limbă sau de framework-ul frontend folosit.

Sistemul se ocupă de:
1.  **Analiza Site-ului**: Descoperă structura paginii folosind Inteligența Artificială.
2.  **Extracția în Batch**: Rulează sute de căutări simultan prin proxy-uri IPv6.
3.  **Reveal Inteligent**: Extrage numerele de telefon simulând comportamentul uman.
4.  **Negociere Automată**: Trimite mesaje (WhatsApp/Email) și negociază prețul folosind un agent AI specializat.

---

## 2. Arhitectura Tab-urilor (Front-End)

### **A. Orchestrator (Comandamentul Central)**
Este inima aplicației, un chat-bot AI capabil să execute comenzi complexe.
- **Funcționalitate**: User-ul scrie mesaje naturale (ex: "Scanează imobiliare în Cluj sub 100k euro").
- **Intent Detection**: Backend-ul detectează dacă cererea este pentru o singură postare, o categorie sau o cerere de status.
- **Mission Tracking**: Afișează în timp real misiunile active într-un panou plutitor cu bare de progres și butoane de STOP.
- **Feed System**: Primește notificări instant când un telefon a fost extras cu succes.

### **B. Database (Lead Hub)**
Locul unde sunt stocate și organizate toate datele extrase.
- **Logic de Grupare**: Lead-urile nu sunt afișate haotic. Ele sunt grupate sub "Misiuni" (ex: un scan de categorie cu 500 de anunțuri apare ca o singură entitate expandabilă).
- **Nested Table**: La expandare, utilizatorul vede tabelul detaliat cu: Miniatură, Titlu, Preț, Status (Success/Fail) și numărul de telefon.
- **Acțiuni Rapide**: 
  - Buton WhatsApp (deschide chat-ul direct cu numărul extras).
  - Buton Copy Phone.
  - Sincronizare live (auto-refresh la 5s pentru date noi).

### **C. Inbox (Negociere - În Dezvoltare)**
Interfața de chat pentru gestionarea conversațiilor automate.
- **Agent Chat**: Conversațiile purtate de AI (pe WhatsApp/Email) apar aici.
- **Distincție Mesaje**: Role-based (User vs Assistant vs Seller).
- **Status Negociere**: Fiecare thread are un status (Pending, Bargaining, Won, Lost).
- **Intervenție Umană**: Utilizatorul poate prelua controlul chat-ului în orice moment.

### **D. Dashboard (Analytics)**
O privire de ansamblu asupra performanței.
- **KPIs**: Număr total de lead-uri, rata de succes a extracției, telefoane găsite.
- **Cost Tracking**: Afișează consumul de proxy-uri și costurile estimate de API AI.
- **Trends**: Grafice cu evoluția prețurilor în categoriile scanate frecvent.

### **E. Settings (Configurare Sistem)**
- **Proxy Manager**: Configurare IP-uri IPv6, rotație și limite pe domeniu.
- **AI Config**: Chei API (Gemini/OpenAI) și setarea "personalității" agentului de negociere (agresiv, prietenos, etc.).
- **Selectors Cache**: Vizualizarea tehnicilor de scraping învățate de sistem pentru fiecare site în parte.

---

## 3. Logica Backend & Orchestrazie

### **AgentOrchestrator & Site Intelligence**
Este creierul sistemului, responsabil pentru logica de **Self-Learning (Discovery)**. Atunci când sistemul întâlnește un domeniu nou sau o strategie veche care nu mai funcționează, urmează acest flux riguros:

1.  **Stealth Fetch & DOM Cleaning**: 
    *   Folosește `StealthBrowser` cu proxy-uri rotative pentru a accesa sample-uri de pagini (Listing + Categorie).
    *   **Curățare**: Înainte de analiza AI, elimină zgomotul (scripturi, reclame, trackere, imagini, CSS inline) pentru a reduce consumul de tokens și a evidenția structura semantică pură.
2.  **AI Pattern Recognition (Gemini Integration)**:
    *   AI-ul primește HTML-ul curățat și caută tipare: "Unde este butonul care declanșează un eveniment XHR pentru telefon?", "Care este pattern-ul de repetiție al cardurilor de produs?".
    *   **Prioritate Stabilitate**: Instruiește AI-ul să prefere atribute stabile precum `data-testid` sau `data-cy` în detrimentul claselor CSS dinamice (hash-uri).
3.  **Real-Time Validation (The "Double Check")**:
    *   Strategia generată **nu este salvată imediat**. Orchestratorul rulează un test de validare automat pe o pagină reală folosind noii selectori.
    *   Dacă selectorii de bază (Titlu, Preț, Buton Reveal) nu sunt găsiți, sistemul intră într-o buclă de **Retry** cu o temperatură AI mai ridicată pentru a găsi soluții alternative.
4.  **Strategy Persistence & Degradation Handling**:
    *   Doar strategiile care trec validarea sunt stocate în `data/strategies/[domain].json`.
    *   **Degradare**: Dacă rata de succes a unei misiuni scade sub un anumit prag, strategia este marcată ca "degradată" și sistemul declanșează automat o nouă sesiune de Discovery pentru a se adapta la noul update al site-ului (Self-Correction).

### **BatchProcessor & Scrapers**
- **Concurrency Control**: Folosește cozi (queues) pentru a nu supraîncărca site-urile țintă.
- **Anti-Detection**: Implementează întârzieri randomizate (45s-90s), rotație de User-Agents și rotație de proxy-uri.
- **Graceful Abort**: Orice misiune poate fi oprită instantaneu (`AbortSignal`), eliberând resursele Puppeteer fără a lăsa procese "zombie".

---

## 4. Roadmap pentru Producție

### **Faza 5: Integrare WhatsApp (API/Web)**
- Implementarea unui bridge pentru trimiterea automată a primului mesaj de salut imediat ce un telefon este extras.

### **Faza 6: AI Negotiation Engine**
- Agentul AI va primi un "Maximum Price" și un "Goal Price" și va folosi strategii de negociere (Small Talk, Finding Flaws, Time Pressure) pentru a obține oferta ideală.

### **Faza 7: Export & CRM**
- Posibilitatea de a exporta lead-urile în Google Sheets sau Excel pentru campanii masive de marketing.

### **Faza 8: Mobile App Integration**
- Aplicație mobilă care trimite Push Notifications când AI-ul a "bătut palma" pe un preț cerut de utilizator.

---
> [!IMPORTANT]
> Proiectul este construit modular. Orice tab nou adăugat în `Sidebar.tsx` trebuie să urmeze logica de `Mission` pentru a menține consistența datelor între Orchestrator și Database.
