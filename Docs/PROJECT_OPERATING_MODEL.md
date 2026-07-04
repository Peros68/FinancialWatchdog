# AI Project Operating Model

## Purpose

This document defines the standard operating model for any AI-assisted project.

It is project-agnostic and reusable across software, SAP, data, automation, documentation, research, and other initiatives.

Every new chat, agent, or session must read this document before starting work.

---

# Workspace Structure

Base workspace:

`C:\AI-LAB`

Recommended structure:

```text
C:\AI-LAB
├── project_name
│   ├── Docs
│   ├── Source
│   ├── Tests
│   ├── Assets
│   ├── Architecture
│   └── .claude
├── project_name_2
├── shared
└── templates
```

Rules:

* One project = one workspace.
* One VS Code window = one project.
* One Claude Code session = one project.
* Never mix multiple projects in the same session.

---

# Agent Organization

The roles below are a default reference model, not a mandatory structure.
Each project may define a simpler or more complex team according to its needs.
Additional, fewer, or different roles may be used when appropriate.

## Chief Architect

Responsibilities:

* requirements analysis
* architecture
* planning
* prioritization
* dependency evaluation
* risk analysis
* coordination between agents
* consolidation of open decisions
* operational supervision

The Chief Architect acts as project coordinator.

### Stop Conditions

The Chief Architect may stop execution only for:

* new dependencies
* database/schema changes
* irreversible data changes
* external APIs/services
* costs or subscriptions
* security concerns
* missing business decisions

All other activities must continue autonomously.

### Additional Responsibility

The Chief Architect must prevent unnecessary interruptions and consolidate decisions before presenting them to the user.

---

## Developer

Responsibilities:

* implementation
* bug fixing
* refactoring
* approved migrations
* technical documentation

Workflow:

Analyze
→ Implement
→ Self-check
→ Pass to Tester

Developer should not stop for:

* code reading
* diagnostics
* builds
* tests
* documentation updates

---

## Test Engineer

Responsibilities:

* automated testing
* regression testing
* acceptance validation
* build verification
* runtime validation

### Parallel Work Rule

Tester never works on files actively modified by Developer.

Workflow:

Developer completes feature
→ Tester validates
→ Tester reports
→ Developer fixes if needed
→ Tester confirms

This prevents collisions between implementation and validation.

---

# Governance a due assi: gerarchia funzionale del team e gerarchia autorizzativa

Questa sezione vale per **tutti** i progetti sotto `C:\AI-LAB`, di **qualunque
tipologia** (software, dati, automazione, documentazione, ricerca, integrazione,
ecc.) e con **qualunque composizione di team**. Definisce due assi distinti e
indipendenti: l'asse **funzionale/tecnico** (come si coordina il team) e l'asse
**autorizzativo** (chi può autorizzare azioni sul sistema). I due assi non vanno
mai confusi.

## Asse 1 — Gerarchia funzionale/tecnica del team (variabile per progetto)

- Ogni progetto definisce la **propria** struttura di team, con **uno o più
  livelli** gerarchici e i **ruoli** che gli servono. La composizione è libera e
  variabile: può essere semplice (pochi ruoli) o complessa (più livelli).
- I ruoli sono liberi. *Esempi non vincolanti:* Project Lead, Chief Architect,
  responsabili di area, ruoli funzionali, developer, tester, documentatori,
  analisti, agenti specialistici, o qualunque altro ruolo necessario. Nessun
  elenco di ruoli è obbligatorio o predefinito.
- **Regola di escalation funzionale:** ogni componente del team si rivolge al
  **proprio referente superiore** per chiarimenti funzionali, dubbi tecnici,
  scelte architetturali, priorità, interpretazione dei requisiti, coordinamento
  del lavoro e ogni decisione di progetto **non autorizzativa**. L'escalation
  prosegue verso l'alto nella gerarchia funzionale del progetto fino al referente
  competente.
- Questo asse riguarda **come si decide il lavoro**, non i permessi sul sistema.

## Asse 2 — Gerarchia autorizzativa (unica e globale)

- Per qualunque **autorizzazione operativa** — permessi, azioni rischiose,
  conferme allow/deny/ask, accessi a risorse sensibili, modifiche distruttive,
  comandi fuori policy, aggiornamenti di configurazione autorizzativa, o decisioni
  che normalmente richiederebbero l'intervento dell'utente — ogni componente del
  team deve passare **sempre** da `claude_code / Authorization Judge`.

- **Regola fondamentale:** **nessun agente** deve chiedere **direttamente**
  all'utente una conferma operativa o autorizzativa. Prima deve **sempre** passare
  da `claude_code`. L'agente formula l'intento; è `claude_code` a stabilire l'esito.

- Solo `claude_code` può:
  - approvare autonomamente un'azione;
  - negarla;
  - applicare la **policy globale**;
  - applicare il **profilo autorizzativo locale** del progetto;
  - usare la **memoria/configurazione autorizzativa**;
  - aggiornare l'**apprendimento** delle decisioni;
  - oppure, **solo se realmente necessario**, risalire all'utente.

- `claude_code` è **unico e globale**: è la stessa autorità autorizzativa per
  **tutti** i progetti sotto `C:\AI-LAB`. Non esiste un secondo giudice per
  progetto.

## Catena autorizzativa

```
Utente
   ↓
claude_code globale / Authorization Judge   (autorità autorizzativa unica)
   ↓
Profilo autorizzativo locale del progetto   (solo azioni ordinarie sicure e specifiche)
   ↓
Team del progetto, con la sua gerarchia funzionale specifica
```

## Regole globali vs profilo locale

- Le **regole globali** contengono i principi **sempre validi**, indipendenti dal
  progetto. *Esempi (non esaustivi):* protezione di `.env`, token, password,
  secrets; blocco di cancellazioni massive; controllo di deploy, push, accessi
  cloud, download/esecuzione di codice esterno; gestione di modifiche DB rischiose;
  apprendimento delle decisioni; distinzione allow/deny/ask; escalation all'utente
  solo se realmente necessaria.
- Il **profilo autorizzativo locale** del singolo progetto contiene **solo** ciò
  che è **ordinario e sicuro** per quello specifico progetto. *Esempi puramente
  illustrativi e non vincolanti:* un progetto basato su un dato stack può
  autorizzare i suoi comandi ordinari di analisi/test/build; un progetto di
  documentazione può autorizzare lettura/analisi/redazione di artefatti; un
  progetto con database può autorizzare **solo** operazioni locali/dev/test e
  reversibili. Questi esempi **non** sono modelli rigidi: ogni progetto definisce
  le proprie regole locali.
- **Non contaminazione:** le regole globali **non** devono contenere regole
  specifiche di un singolo progetto, e le regole di un progetto **non** devono
  filtrare in quelle globali o in altri progetti.
- **Subordinazione:** il profilo locale **non sostituisce** `claude_code` e non
  può ampliare i permessi oltre i limiti globali. È **subordinato** al giudice
  globale: può solo dichiarare azioni ordinarie sicure aggiuntive per quel
  progetto; in caso di conflitto, **prevalgono le regole globali**.

## Due flussi distinti (sintesi operativa)

- **Dubbi funzionali/tecnici:**
  `agente → referente superiore del progetto → eventuale escalation nella
  gerarchia funzionale`.
- **Autorizzazioni operative:**
  `agente → profilo autorizzativo locale del progetto → claude_code globale →
  utente solo se necessario`.

Questa governance vale per qualunque progetto, qualunque tipologia, qualunque
composizione del team e qualunque numero di livelli gerarchici, dai progetti più
semplici ai più complessi.

## Nota tecnica: cosa è (e cosa non è) `claude_code / Authorization Judge`

Per evitare aspettative sbagliate, va distinto **come è implementata** l'autorità
autorizzativa dal **modello concettuale** descritto sopra. I due assi corrispondono
a **due canali tecnici diversi**:

- **Canale tool (autorizzativo).** `claude_code / Authorization Judge` è,
  tecnicamente, un **hook `PreToolUse`** che intercetta le chiamate ai tool
  (`Bash/Edit/Write/…`) e restituisce **allow / ask / deny** (regole deterministiche
  della policy + giudice IA per la zona grigia, con apprendimento). Agisce **solo**
  su questo canale: valuta *comandi e scritture*, non i ragionamenti del modello.
  - **`ask` significa "chiedi all'utente".** Quando l'hook restituisce `ask`, Claude
    Code mostra il prompt **all'utente**: **non** esiste un'entità `claude_code`
    intermedia che risponde al posto suo. La riduzione delle interruzioni viene da
    (a) policy + apprendimento che **auto-approvano** le azioni ordinarie e sicure, e
    (b) la **dottrina di autonomia** nel `CLAUDE.md` auto-caricato — non da un
    `claude_code` che "media" le domande.

- **Canale decisionale (funzionale).** Le decisioni **non-tool** — quando il modello
  *sceglie di fermarsi e porre una domanda funzionale* — **non passano dall'hook**
  (nessun tool viene chiamato, quindi l'hook non scatta). Sono governate dalla
  **dottrina di autonomia** (`CLAUDE.md`: procedi sul prossimo micro-incremento non
  bloccato; dubbi funzionali → **referente funzionale** del progetto; non chiudere il
  turno con una domanda quando la decisione è ordinaria) e dalla **gerarchia
  funzionale** del team. Questo è l'Asse 1.

In sintesi: l'**Asse 2** (autorizzativo) è realizzato dall'hook sul canale tool;
l'**Asse 1** (funzionale) è realizzato dall'orchestratore e dai referenti sul canale
decisionale. Tenere separati i due canali è ciò che evita sia le interruzioni inutili
sia le aspettative errate su un "claude_code" che deciderebbe tutto.

---

# Operational Rules

## Autonomous Activities

Agents should proceed autonomously for:

* source code analysis
* document reading
* diagnostics
* logging
* builds
* tests
* static analysis
* documentation updates

## Authorization Escalation Required

These cases must not be sent directly to the user by project agents.

They must be escalated to `claude_code / Authorization Judge`, which will decide whether to allow, deny, apply global/local policy, or escalate to the user only if necessary:

1. new dependency
2. database change
3. external service
4. cloud integration
5. paid service
6. destructive action
7. business decision

---

# Decision Management

Open decisions must be grouped.

Bad:

* stop for D1
* stop for D2
* stop for D3

Good:

Present:

* D1
* D2
* D3

in a single consolidated review.

---

# Documentation Standards

Every project should maintain:

```text
Docs/
├── PROJECT_STATUS.md
├── WORK_LOG.md
├── CHANGELOG_DECISIONS.md
├── PROJECT_OPERATING_MODEL.md
└── Architecture/
```

I nomi qui sopra sono **convenzionali, non vincolanti**: un progetto può usare varianti
(es. `PROJECT_STATUS_2026_06.md` invece di `PROJECT_STATUS.md`). Conta il ruolo del
documento (stato, log, decisioni), non il nome esatto del file.

---

# Mandatory Validation

Before declaring a task completed:

* analyze
* tests
* build

must all succeed.

Equivalent commands depend on the technology stack.

---

# Storage Principles

Separate:

* source files
* runtime data
* generated artifacts
* user data

Document clearly where each platform stores data.

Never assume Web, Mobile and Desktop share the same storage.

---

# Manual Testing

Request manual tests only:

* after implementation
* after automated validation
* with a precise checklist

One scenario at a time.

---

# Session Recovery

When a new chat starts:

1. Read project documentation.
2. Read PROJECT_STATUS.
3. Read CHANGELOG_DECISIONS.
4. Read WORK_LOG.
5. Identify the first unfinished task.
6. Resume from that point.

Never restart analysis already completed.

---

# Final Objective

Maximize autonomous execution.

Minimize interruptions.

Escalate only genuine decisions.

The user should act as sponsor and decision maker, not as build operator, tester, or coordinator.
