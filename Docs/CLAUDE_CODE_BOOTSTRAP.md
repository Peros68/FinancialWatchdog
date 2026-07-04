CLAUDE_CODE_BOOTSTRAP.md
Versione

Versione: 2.0

Scopo: definire il modello operativo standard da utilizzare in tutti i progetti sviluppati con Claude Code.

Questo documento deve essere letto all'inizio di ogni nuova chat, nuova sessione Claude Code o nuovo progetto.

L'obiettivo è:

ridurre le interruzioni;
evitare la perdita di contesto;
garantire continuità tra sessioni;
standardizzare ruoli e responsabilità;
evitare di ripetere sempre le stesse istruzioni.
1. Workspace Standard

Tutti i progetti devono essere creati sotto:

C:\AI-LAB

Struttura consigliata:

C:\AI-LAB
├── NomeProgetto
│   ├── Docs
│   ├── Source
│   ├── Tests
│   ├── Assets
│   ├── Architecture
│   └── .claude
├── shared
└── templates

Regole:

un progetto = una cartella;
una finestra VS Code = un progetto;
una sessione Claude Code = un progetto;
non utilizzare la stessa sessione per progetti differenti.
2. Documenti di Autorità

All'avvio di una nuova sessione devono essere letti, in ordine:

CLAUDE_CODE_BOOTSTRAP.md
PROJECT_OPERATING_MODEL.md
PROJECT_STATUS.md
CHANGELOG_DECISIONS.md
WORK_LOG.md

Se presenti:

documenti architetturali
specifiche funzionali
documenti di handover

I documenti di autorità prevalgono sempre sulla memoria della chat.

3. Recovery di Sessione

All'apertura di una nuova chat:

leggere i documenti di autorità;
identificare l'ultimo incremento completato;
identificare il primo task incompleto;
riprendere da quel punto;
non rifare analisi già concluse.

È vietato chiedere all'utente informazioni già presenti nei documenti.

4. Organizzazione Agenti

I ruoli seguenti (Chief Architect, Developer, Test Engineer) sono un modello di
riferimento, NON una struttura obbligatoria. Ogni progetto puo' definire un team
piu' semplice o piu' complesso, con ruoli diversi o aggiuntivi secondo le proprie
necessita'.

4.1 Chief Architect

Ruolo:

coordinatore;
responsabile architettura;
responsabile roadmap;
filtro decisionale;
supervisore degli agenti.

Responsabilità:

definire gli incrementi;
verificare dipendenze;
consolidare decisioni aperte;
evitare interruzioni inutili;
aggiornare stato progetto.

Il Chief Architect svolge anche il ruolo normalmente ricoperto dall'assistente esterno.

Deve evitare che l'utente venga coinvolto in attività operative.

Può interrompere solo per:
nuove dipendenze;
modifiche schema DB;
modifiche irreversibili dati;
servizi esterni;
costi;
problemi di sicurezza;
decisioni funzionali non documentate.
4.2 Developer

Ruolo:

implementazione.

Responsabilità:

sviluppo;
bug fixing;
refactoring;
aggiornamento documentazione tecnica.

Workflow:

Analisi
→ Implementazione
→ Verifica locale
→ Passaggio al Tester

Non deve interrompersi per:

lettura file;
grep;
build;
test;
diagnostica;
analisi log.
4.3 Test Engineer

Ruolo:

validazione.

Responsabilità:

test automatici;
test regressione;
verifica acceptance criteria;
build;
verifica runtime.
Regola fondamentale

Il Test Engineer non deve modificare file in lavorazione dal Developer.

Workflow:

Developer completa
↓
Tester valida
↓
Tester segnala
↓
Developer corregge
↓
Tester conferma

Il Tester può lavorare in parallelo soltanto su componenti già stabilizzati.

Governance a due assi (sintesi)

Il lavoro segue due assi distinti (dettaglio completo in PROJECT_OPERATING_MODEL.md):

- Dubbi funzionali/tecnici: agente -> referente superiore del progetto (escalation
  nella gerarchia funzionale del team, variabile per progetto).
- Autorizzazioni operative: agente -> profilo autorizzativo locale del progetto ->
  claude_code globale / Authorization Judge -> utente solo se necessario.

Regola fondamentale: nessun agente deve chiedere direttamente all'utente una
conferma operativa o autorizzativa. Prima deve sempre passare da claude_code /
Authorization Judge, che decide se approvare, negare, applicare la policy
globale/locale o risalire all'utente.

Nota tecnica (cosa è claude_code, per non creare aspettative sbagliate): l'Authorization
Judge è, nell'implementazione, un hook PreToolUse che intercetta le chiamate ai tool
(Bash/Edit/Write) e restituisce allow/ask/deny. Agisce SOLO sul "canale tool". Due
conseguenze: (1) "ask" = chiedi all'UTENTE: quando l'hook restituisce ask, Claude Code
mostra il prompt all'utente; non c'è un claude_code intermedio che risponde al posto suo
— le interruzioni si riducono con policy/apprendimento (auto-allow del sicuro) e con la
dottrina di autonomia del CLAUDE.md, non con un claude_code che "media" le domande. (2)
Le decisioni NON-tool (il modello che sceglie di fermarsi per una domanda funzionale) non
passano dall'hook: le governa la dottrina di autonomia (CLAUDE.md) + la gerarchia
funzionale del team (canale decisionale). Asse 2 = hook sul canale tool; Asse 1 =
orchestratore/referenti sul canale decisionale.

5. Regole di Interruzione
Attività autonome

Claude Code deve procedere autonomamente per:

lettura file;
ricerca file;
lettura log;
lettura errori;
aggiornamento documentazione;
analisi codice;
test;
build;
lint;
diagnostica.
Attività che richiedono autorizzazione

Per queste categorie l'agente NON chiede direttamente all'utente: escala a
claude_code / Authorization Judge, che decide allow/deny o risale all'utente solo
se necessario:

nuove dipendenze;
modifiche DB;
servizi cloud;
servizi a pagamento;
cancellazione dati;
accesso esterno al progetto;
azioni rischiose o fuori policy;
decisioni business o autorizzative non risolvibili dal team.
6. Gestione Prompt "Yes / No"

Quando compare:

1. Yes
2. No

La decisione passa da claude_code / Authorization Judge, che deve:

verificare se l'azione rientra nelle autorizzazioni previste (policy globale +
profilo locale del progetto);
procedere autonomamente se consentita;
gestire l'escalation senza che sia l'agente a interpellare direttamente l'utente.

Per i casi sensibili (operazioni distruttive, costi, dipendenze, DB e simili)
claude_code applica la policy e risale all'utente solo se necessario.

Precisazione: il prompt "Yes/No" che eventualmente compare È già l'esito `ask`
dell'hook rivolto all'utente. L'hook non lo "intercetta" una seconda volta: lo si
evita a monte facendo rientrare l'azione tra quelle auto-approvate (policy globale +
profilo locale), oppure — se il comando è solo mal formato — riscrivendolo in forma
conforme prima di proporlo (vedi convenzione `_tmp_` e regole del CLAUDE.md). Nessun
agente deve aggirare il prompt chiedendo l'autorizzazione direttamente all'utente.
7. Gestione Decisioni Aperte

È vietato interrompere il flusso per una singola domanda.

Le decisioni devono essere accumulate.

Formato:

Decisioni Aperte

D1
D2
D3
...

L'utente deve ricevere un unico blocco consolidato.

8. Politica Autorizzazioni

Principio generale (technology-agnostic): claude_code auto-approva le operazioni
di sola lettura, diagnostica, test, build, lint e verifica ordinarie coerenti con
lo stack del progetto, e i comandi equivalenti.

Esempi NON vincolanti (dipendono dallo stack):

- ricerca/lettura: grep, find, Get-ChildItem, Select-String;
- progetti Flutter/Dart: flutter analyze, flutter test, flutter build, flutter pub deps.

Profilo autorizzativo locale: il settings.local.json del progetto (o file
equivalente) puo' dichiarare ulteriori azioni ordinarie e sicure specifiche di
quel progetto. Resta subordinato al claude_code globale e NON puo' ampliare i
permessi oltre i limiti globali: in caso di conflitto prevalgono le regole globali.

9. Gestione Notifiche

Quando possibile configurare:

[console]::beep(1000,500)

per:

stop operativo;
richiesta decisione;
fine task;
richiesta di intervento dell'utente, quando claude_code / Authorization Judge lo
ritiene necessario.
10. Gestione Storage

Documentare sempre:

file sorgente;
dati runtime;
dati utente;
artefatti generati.

Mai assumere che:

Web
Android
Windows

condividano lo stesso storage.

Esempio:

Web      → IndexedDB
Android  → Storage interno app
Windows  → Application Support Directory
11. Test Obbligatori

Prima di dichiarare completato un incremento vanno eseguiti i controlli
equivalenti dello stack tecnologico del progetto (analisi statica, test
automatici, build), che devono risultare tutti verdi.

Esempio NON vincolante (progetti Flutter): flutter analyze, flutter test,
flutter build web.

12. Test Manuali

I test manuali devono essere richiesti:

dopo implementazione;
dopo test automatici;
con checklist precisa;
uno scenario alla volta.
13. Documentazione Obbligatoria

Ogni progetto deve contenere:

Docs/
├── PROJECT_STATUS.md
├── WORK_LOG.md
├── CHANGELOG_DECISIONS.md
├── PROJECT_OPERATING_MODEL.md
├── CLAUDE_CODE_BOOTSTRAP.md
├── Architecture/
└── img/   (opzionale)

La cartella Docs/img/ è opzionale ed è riservata ai riferimenti visivi forniti
dall'utente (screenshot, mockup, esempi di UI, riferimenti di layout). Le immagini
in Docs/img/ sono contesto progettuale, non necessariamente asset runtime: gli
asset runtime vanno gestiti separatamente secondo lo stack tecnologico.

I nomi dei file sono convenzionali, non vincolanti: un progetto può usare varianti
(es. PROJECT_STATUS_2026_06.md al posto di PROJECT_STATUS.md). Conta il ruolo del
documento, non il nome esatto.
14. Cartella Agenti

Struttura consigliata (solo esempio di riferimento, NON obbligatoria):

.claude/agents/
├── chief-architect.md
├── developer.md
└── test-engineer.md

Ogni progetto può avere ruoli diversi, aggiuntivi o in numero minore, secondo la
propria complessità. Anche i **nomi dei file** sono esempi: un ruolo può chiamarsi
come serve al progetto (es. `flutter-developer.md` invece di `developer.md`).
chief-architect

Responsabile coordinamento.

developer

Responsabile implementazione.

test-engineer

Responsabile validazione.

15. Checklist Fine Incremento

Prima di chiudere un incremento:

implementazione completata;
documentazione aggiornata;
test verdi;
build verde;
backlog aggiornato;
problemi residui documentati.
16. Checklist Fine Task

Prima di dichiarare concluso un task:

acceptance criteria soddisfatti;
documentazione aggiornata;
nessun errore bloccante;
decisioni registrate.
17. Principio Finale

L'utente non deve svolgere il ruolo di:

build operator;
test runner;
coordinatore;
project manager operativo.

Gli agenti devono lavorare autonomamente.

L'utente resta sponsor e decision maker. Le verifiche funzionali e le decisioni di
business possono arrivare all'utente quando necessario. Le approvazioni
operative/autorizzative NON vengono richieste direttamente dagli agenti: passano
sempre prima da claude_code / Authorization Judge, che risale all'utente solo se
necessario.

L'utente interviene quindi per:

decisioni;
priorità;
verifiche funzionali;
approvazioni che claude_code escala come realmente necessarie.