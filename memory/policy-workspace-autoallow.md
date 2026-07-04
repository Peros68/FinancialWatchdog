---
name: policy-workspace-autoallow
description: Come funziona l'auto-allow di workspace del Judge e perche' editare la policy chiede sempre conferma
metadata:
  type: reference
---

# Auto-allow workspace nell'Authorization Judge (2026-07-04)

Aggiunto AUTO-ALLOW per i comandi Bash ordinari con `cwd` dentro
`C:\AI-LAB\FinancialWatchdog` (chiave `bash_autoallow_roots` nella policy).

## File toccati (sotto ~/.claude, protetti)
- `authorization_policy.json`: nuova chiave `bash_autoallow_roots`; aggiunte a
  `never_learn_patterns` (kill processi, `rm/del/remove-item` con wildcard `*`/`?`,
  `drizzle-kit`/`db:push`/`db:migrate`/`prisma migrate`); rimosso il bare `npm run`
  da `safe_allow_patterns` (cosi' `npm run db:push` non e' piu' read-only e ricade
  nella regola schema -> ask).
- `hooks/authorization_judge.py`: nuovo step **6b** (dopo ask_force, prima del giudice IA):
  se `cwd` e' in un `bash_autoallow_roots` e non e' un comando DB -> `allow`.

## Comportamento (verificato 17/17)
- Auto-allow (nessun prompt) dentro il progetto: `git add/commit`, `mkdir/mv/cp`,
  `node/tsx`, `npm run dev/build/test/check`, `rm -f <singolo file>`.
- Restano ASK: `git push/reset --hard/rebase`, cancellazioni massive (wildcard) o
  ricorsive, kill processi (`taskkill`/`Stop-Process`/`pkill`), schema DB
  (`db:push`/`drizzle-kit`), nuove dipendenze (`npm/pip/cargo install`), segreti
  (`.env`/token), deploy/cloud, e tutto cio' che sta FUORI dal root.

## PERCHE' editare la policy chiede sempre conferma
`authorization_policy.json` e i `.py` dell'hook sono in `protected_file_patterns`
= categoria `never_learn` (non promuovibile). Ogni scrittura su questi file forza
UN prompt, per design (proteggono la config di sicurezza stessa). Non e' Claude a
chiedere: e' l'hook. **Regola operativa:** quando servono piu' modifiche alla policy,
farle in UNA sola scrittura (Write dell'intero file), non a colpi di Edit multipli
-> un solo prompt invece di N. Vedi [[user-autonomia-workspace]].
