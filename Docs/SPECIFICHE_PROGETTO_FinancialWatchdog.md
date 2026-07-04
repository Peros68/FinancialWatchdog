# FinancialWatchdog — Specifiche di progetto

## Percorso progetto

Il progetto deve risiedere in:

```text
C:\AI-LAB\FinancialWatchdog
```


---

## 1. Obiettivo del progetto

FinancialWatchdog è una web app per monitorare titoli azionari, watchlist, grafici e alert di prezzo.

L'obiettivo è partire dal progetto già esportato da Replit e importato in:

```text
C:\AI-LAB\FinancialWatchdog
```

senza riscrivere l'app da zero.

L'app attuale ha già un frontend funzionante.  
La priorità è trasformarla gradualmente in una web app fullstack ordinata, con backend e database persistente.

---

## 2. Stato iniziale noto

Il progetto importato contiene una struttura simile a:

```text
client/
server/
shared/
attached_assets/
package.json
package-lock.json
drizzle.config.ts
vite.config.ts
tailwind.config.ts
tsconfig.json
components.json
postcss.config.js
replit.md
.replit
```

File tecnici rilevanti già presenti:

```text
server/db.ts
server/index.ts
server/routes.ts
server/storage.ts
server/vite.ts
shared/schema.ts
client/src
```

Il progetto proviene da Replit.

---

## 3. Stack tecnico attuale

Stack rilevato o atteso:

- Frontend: React
- Build tool: Vite
- Linguaggio: TypeScript
- Styling: Tailwind CSS
- UI: componenti compatibili con shadcn/ui
- Backend: Node/TypeScript
- ORM/schema: Drizzle ORM
- Schema condiviso: `shared/schema.ts`

Claude Code deve verificare questi elementi dai file reali prima di modificare qualunque cosa.

---

## 4. Funzionalità principali desiderate

L'app deve consentire di:

1. cercare titoli azionari per nome o simbolo;
2. visualizzare risultati di ricerca;
3. visualizzare prezzo corrente e variazione;
4. visualizzare grafici del titolo;
5. gestire watchlist;
6. aggiungere titoli a una watchlist;
7. rimuovere titoli da una watchlist;
8. creare alert di prezzo;
9. visualizzare alert attivi;
10. ricevere segnalazioni visive e, se già previste dalla UI, sonore;
11. mantenere l'interfaccia attuale il più possibile invariata.

---

## 5. Vincolo fondamentale

Il frontend esistente non deve essere riscritto.

Claude Code deve:

- analizzare prima il codice esistente;
- capire dove sono definiti dati statici, watchlist, alert e storage;
- preservare UI e flussi funzionanti;
- sostituire gradualmente lo storage statico/in memoria con backend/database;
- procedere per micro-step testabili.

---

## 6. Dati statici e database

Attualmente il frontend/progetto usa o ha usato dati statici o memoria applicativa per watchlist e alert.

Obiettivo:

- migrare watchlist e alert in un database persistente;
- mantenere eventuali dati statici solo come seed iniziale;
- non perdere le watchlist già definite nel progetto;
- creare uno script di seed idempotente, cioè eseguibile più volte senza duplicare dati.

---

## 7. Entità dati principali

Il dominio minimo dell'app comprende:

### users

Utenti dell'app.

Nella prima fase può bastare un utente demo.

Campi logici:

```text
id
username
password / password_hash
created_at
```

Note:

- evitare password in chiaro in una versione reale;
- la login reale può essere rimandata se non già implementata.

---

### watchlists

Liste di titoli.

Campi logici:

```text
id
user_id
name
created_at
updated_at
```

Esempi:

```text
Tech USA
Semiconduttori
Energia
Banche
Preferiti
Titoli monitorati
```

I nomi reali devono essere recuperati dal progetto esistente se sono già definiti.

---

### watchlist_items

Titoli contenuti in una watchlist.

Campi logici:

```text
id
watchlist_id
symbol
name
exchange
currency
created_at
```

Regole:

- uno stesso simbolo non deve essere duplicato nella stessa watchlist;
- lo stesso simbolo può comparire in watchlist diverse;
- il frontend deve poter mostrare simbolo, nome e mercato.

---

### alerts

Alert impostati sui titoli.

Campi logici:

```text
id
user_id
symbol
target_price
alert_type
is_active
created_at
triggered_at
```

Regole:

```text
alert_type = above | below
```

- `above`: avvisa se il prezzo sale sopra la soglia;
- `below`: avvisa se il prezzo scende sotto la soglia;
- `is_active` indica se l'alert è ancora valido;
- `triggered_at` registra l'eventuale attivazione.

---

## 8. Database: decisione da formalizzare

La scelta definitiva tra SQLite e PostgreSQL deve essere trattata come decisione architetturale.

Opzioni:

### SQLite

Adatto per:

- prototipo locale;
- semplicità;
- sviluppo rapido.

Criticità:

- su Render richiede persistent disk;
- meno adatto a uso multiutente reale;
- attenzione a perdita dati se il filesystem non è persistente.

### PostgreSQL

Adatto per:

- deploy cloud;
- persistenza robusta;
- futura multiutenza;
- maggiore coerenza con eventuale schema Drizzle già basato su `pgTable`.

Criticità:

- richiede configurazione `DATABASE_URL`;
- richiede DB esterno o Render PostgreSQL.

Claude Code non deve scegliere autonomamente senza presentare pro/contro e chiedere conferma.

---

## 9. API backend desiderate

Il backend dovrà esporre API REST sotto prefisso `/api`.

Endpoint target:

```text
GET    /api/health

GET    /api/watchlists
POST   /api/watchlists
DELETE /api/watchlists/:id

GET    /api/watchlists/:id/items
POST   /api/watchlists/:id/items
DELETE /api/watchlist-items/:id

GET    /api/alerts
POST   /api/alerts
PATCH  /api/alerts/:id
DELETE /api/alerts/:id
```

Questi endpoint rappresentano la direzione target.  
Claude Code deve prima confrontarli con quelli già presenti in `server/routes.ts`.

---

## 10. Layer backend

La logica backend deve essere separata in modo ordinato.

### `server/routes.ts`

Responsabilità:

- ricevere richieste HTTP;
- validare input;
- chiamare lo storage layer;
- restituire JSON;
- gestire errori HTTP.

Non deve contenere query complesse direttamente se esiste uno storage layer.

### `server/storage.ts`

Responsabilità:

- funzioni CRUD;
- accesso a watchlist;
- accesso a watchlist items;
- accesso ad alert;
- isolamento della persistenza dal layer route.

Funzioni attese, se coerenti con il progetto:

```text
getWatchlists(userId)
createWatchlist(userId, name)
deleteWatchlist(id)
getWatchlistItems(watchlistId)
addWatchlistItem(watchlistId, item)
removeWatchlistItem(id)
getAlerts(userId)
createAlert(userId, alert)
updateAlert(id, data)
deleteAlert(id)
```

### `server/db.ts`

Responsabilità:

- inizializzare connessione DB;
- esportare client/istanza ORM;
- non contenere logica applicativa.

### `shared/schema.ts`

Responsabilità:

- definire schema Drizzle;
- esportare tipi TypeScript;
- esportare schema di validazione se presente;
- mantenere coerenza frontend/backend.

---

## 11. Frontend

Il frontend deve restare l'interfaccia principale già realizzata.

Obiettivi frontend:

- mantenere layout attuale;
- mantenere pagina Search;
- mantenere pagina Watchlists;
- mantenere pagina Alerts;
- mantenere grafici e timeframe già presenti;
- sostituire lettura dati statici con chiamate API solo quando il backend è pronto.

È preferibile introdurre un client API centralizzato:

```text
client/src/lib/api.ts
```

Responsabilità:

- base URL backend;
- funzioni fetch per watchlist;
- funzioni fetch per alert;
- gestione errori;
- separazione da componenti UI.

Variabile ambiente prevista:

```text
VITE_API_BASE_URL
```

Esempi:

```text
http://localhost:5000
https://nome-servizio-render.onrender.com
```

---

## 12. Dati finanziari dinamici

L'app può usare provider esterni per dati dinamici, ad esempio:

- Finnhub;
- Yahoo Finance/proxy;
- Twelve Data;
- Alpha Vantage;
- altro provider.

Regole:

- non introdurre nuovi provider senza conferma;
- non esporre API key nel frontend;
- usare variabili ambiente per segreti;
- distinguere dati persistenti e dati dinamici.

Dati persistenti:

```text
users
watchlists
watchlist_items
alerts
preferences
```

Dati dinamici:

```text
quote
current price
chart data
historical candles
news
market status
```

Nella prima fase non serve salvare ogni quotazione nel database.

---

## 13. Alert

Prima versione accettabile:

- alert salvati nel database;
- frontend recupera alert;
- frontend confronta prezzo corrente e soglia;
- frontend mostra avviso visivo.

Versione successiva:

- backend controlla periodicamente gli alert;
- backend aggiorna `triggered_at`;
- eventuale notifica lato app.

La scelta tra controllo frontend e controllo backend deve essere trattata come decisione progettuale.

---

## 14. Deployment target

Il deploy previsto è Render, ma non deve essere eseguito subito.

Prima servono:

1. backend funzionante localmente;
2. database deciso;
3. script di seed;
4. API validate;
5. frontend collegato al backend;
6. build locale riuscita.

Solo dopo si potrà configurare Render.

---

## 15. Comandi da verificare

Claude Code deve verificare gli script reali in `package.json`.

Comandi possibili:

```powershell
npm install
npm run dev
npm run build
npm run check
npm start
npm run db:push
npm run db:seed
```

Non deve dare per scontato che esistano tutti.

---

## 16. Criteri di accettazione

Una modifica è completata solo se:

1. i file modificati sono elencati;
2. il comportamento atteso è descritto;
3. il comando di verifica è stato eseguito;
4. l'esito è riportato;
5. eventuali limiti o test mancanti sono dichiarati.

Esempio di report richiesto:

```text
File modificati:
- ...

Verifiche eseguite:
- npm run check
- npm run build

Esito:
- ...

Non verificato:
- runtime manuale nel browser
```

---

## 17. Primo lavoro richiesto a Claude Code

Il primo lavoro deve essere solo analisi, senza modifiche.

Richiesta iniziale da eseguire:

```text
Analizza il progetto esistente senza modificare file.

Controlla:
- package.json
- server/index.ts
- server/routes.ts
- server/storage.ts
- server/db.ts
- shared/schema.ts
- client/src

Obiettivo:
- capire dove sono definite oggi watchlist e alert;
- capire se sono hardcoded, in memoria o su database;
- identificare endpoint già esistenti;
- identificare configurazione DB reale;
- identificare provider dati usato;
- proporre il primo micro-step successivo.

Non modificare file.
Non installare dipendenze.
Non cambiare database.
Non creare nuovi file.
```

---

## 18. Output atteso dal primo lavoro

Il primo report deve contenere:

```text
1. Architettura attuale rilevata
2. File analizzati
3. Storage attuale watchlist
4. Storage attuale alert
5. API endpoint esistenti
6. Database configurato
7. Dati statici trovati
8. Rischi
9. Decisioni aperte
10. Primo step consigliato
```

---

## 19. Regola finale

FinancialWatchdog non deve essere trattato come un nuovo progetto vuoto.

È un progetto esistente importato da Replit dentro:

```text
C:\AI-LAB\FinancialWatchdog
```

La strategia corretta è:

```text
analizzare → documentare → decidere → modificare poco → testare → proseguire
```

Non:

```text
riscrivere → rompere → correggere dopo
```
