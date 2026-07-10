# Authorization Judge v2 — stato, canary e rollback

> Attivato il 2026-07-10 (F.2/F.3 del piano in `Docs/PROPOSAL_AUTH_JUDGE_V2.md`).
> Sostituisce di fatto la parte "come decide il Judge" di `policy-workspace-autoallow.md`
> (le preferenze utente lì documentate restano valide).

## Cosa è cambiato (v1 → v2)

- **P1 quote-masking:** i contenuti delle stringhe quotate sono placeholder: `grep
  "drizzle-kit\|db:push"`, `git commit -m "... .env ..."`, `grep "delete from"` NON
  chiedono più conferma (erano i FP principali).
- **P2 per segmento + max-severity:** un comando composito è safe se TUTTI i segmenti lo
  sono; `npx vitest | tail; curl localhost:5000` = safe, `npm test && git push` = ask.
- **P3 cwd effettivo:** `cd <path> && cmd` classifica `cmd` col cwd del `cd` (mai deny per forma).
- **P4 credenziali azione+target:** `.env` scatta come ARGOMENTO (cat/redirect/git add .env),
  non come testo citato. `cat ".env"` quotato scatta comunque (pathlike).
- **P5 rete per host:** curl/wget/iwr con TUTTI gli host locali (localhost/127.0.0.1/::1) =
  safe anche nei compositi; almeno un host remoto = ask; pipe verso shell = deny.
- **P6 scratchpad fidato:** `%LOCALAPPDATA%\Temp\claude\<progetto>\<sessione>\scratchpad` =
  read/write/exec/delete liberi come il workspace (vale anche per i tool file).
- **Giudice IA SPENTO (G-1a):** niente subprocess `claude -p`; l'ignoto è default-ask.
- **G-3b:** `npm ci` / `npm install` SENZA pacchetti (lockfile) = safe; con pacchetti = ask.
- **G-4a:** `git push --force/--force-with-lease/--delete/-f` = **deny**; push normale = ask.
- **G-5b:** `git add -A`/`git add .` = safe nel workspace SE il `.env` del cwd non esiste o è
  gitignorato; ask se esiste non ignorato O se il cwd non è verificabile (fail-closed).
- **D-3:** `rm`/`del`/`remove-item` con target su zone di sistema (drive root, Windows,
  Program Files, system32, root `C:\AI-LAB`, home utente) = **deny** deterministico.
- **Buchi chiusi:** `gh` ora ask (prima passava dal workspace-allow), `VAR=... npm run
  db:push` ora ask (il prefisso assegnazione non maschera più il comando), `bash -c "..."`
  ask (deny se il contenuto è distruttivo), `base64 -d | sh` deny.

## File e test

- I 3 file: `~/.claude/hooks/auth_common.py`, `~/.claude/hooks/authorization_judge.py`,
  `~/.claude/authorization_policy.json`. **Backup v1:** `~/.claude/hooks/backup/2026-07-07/`.
- Suite: `~/.claude/hooks/authorization_cases.jsonl` (50 casi) +
  `python ~/.claude/hooks/_selftest_v2.py --target v2` → deve dare 50/50.
  (`--baseline` fotografava la v1: non più significativo a v2 attiva. Il vecchio
  `_selftest.py` 35 casi è tarato sulla v1: superato.)
- Eseguire il selftest fa 1 ask (script dentro `~/.claude`): previsto, by design.
- NOTA: l'hook copre i tool `Bash|Edit|Write|MultiEdit|NotebookEdit`; i comandi lanciati
  col tool PowerShell NON passano dal Judge (era così anche in v1) — l'audit del log
  conta solo i primi.

## Canary F.4 (2026-07-10 → ~2026-07-13)

A fine giornata: `python _tmp_canary_audit.py` (ricrearlo al bisogno: filtra
`~/.claude/authorization_log.jsonl` per ts >= attivazione v2) e verificare:
1. **ask residue** tutte fondate (stop-condition o file protetti) — un FP va aggiunto come
   caso in `authorization_cases.jsonl` e corretto in policy;
2. **allow delle regole nuove** (source `safe-v2`, regole S6/S7/S9/S2, `safe-allow`)
   corretti a campione;
3. **zero** voci con source `ai-judge`;
4. **zero deny errati** (criterio assoluto).

## Esiti canary

- **2026-07-10 (giorno 1, primo giro):** 12 decisioni post-v2, tutte allow corrette
  (5 safe-allow read-only/test, 5 file-workspace, 1 memory-md, 1 safe-v2/S2); 0 ask,
  0 deny, 0 ai-judge. Rifinitura da valutare a FINE canary (costa 1 conferma sul judge):
  le allow con source `safe-allow`/`file-workspace` non loggano il `target` (ereditato
  dalla v1) → l'audit a campione delle allow è meno informativo.

## Rollback (criteri F.6)

Ripristinare i 3 file dal backup `2026-07-07` SE: una SAFE avrebbe dovuto essere ASK/DENY
(regressione di sicurezza → post-mortem del caso nella suite); crash/eccezioni dell'hook;
aumento anomalo di ask. Il ripristino = 3 scritture su file protetti (3 conferme).
