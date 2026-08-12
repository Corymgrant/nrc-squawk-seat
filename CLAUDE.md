# CLAUDE.md — squawk-seat (NRC owner dashboard) repo rules

Concise repo rules. Global standing rules (cook mount path, report-or-yell, verify-before-done, key IDs) live in `~/.claude/CLAUDE.md` — read that too.

## What this is
Internal **owner-only** dashboard (Next.js, Vercel). Surfaces freshness, Finished Creatives, Opportunities board. NOT a customer-facing or sales-rep-facing app.

## Build / deploy discipline
- **Build GREEN before any push.** `npm run build` (or the repo's typecheck/build) must pass locally first — never push red.
- **Auto-deploy on push to `main` → Vercel production.** A push to `main` ships to the live owner dashboard. Treat pushing `main` as a human-gated publish; build-green + a quick read-back of the change first.
- **Owner-only proxy pattern.** The Cockpit token stays **server-side** (proxy/route handler) — never shipped to the client. A `sales_rep` (or any non-owner) request MUST `403`. Verify scoping with a real multi-role test, not assertion.

## Branch / clone discipline
- **Two-clone gotcha.** Both `/home/cory/nrc/squawk-seat` and `/home/cory/nrc/nrc-squawk-seat` track the same GitHub repo (`Corymgrant/nrc-squawk-seat`). **The deploy source is the clone tracking `main` — currently `/home/cory/nrc/squawk-seat`.** Know which clone/branch you are in before committing.
- **Quarantine branches are NOT prod-ready.** Branches like `wip/opportunity-engine-*` / `wip/orchestrator-a3-preserve-*` must pass a security review before merging to `main`. Do not push a quarantine branch to `main` without it.

## Michael-seat doctrine (BINDING — job 512)
The Michael seat (`/protected`) and every Michael-facing answer obey
`docs/MICHAEL-SEAT-DOCTRINE.md`: the sale-activity tile is a **WINDOW, NEVER A SWITCH**.
Outcomes framing (no worker/mechanism/autonomy labels), **zero lane control surfaces**
(no pause/disable/settings/opt-out — squawk box is his only input), lead with hot leads
routed to him, and full compartmentalization (no spend/strategy/lane-configs/architecture).
Read that doc before touching `/protected`, the sale-activity tile, or any squawk answer.

## Definition of done
Build green + change read-back + (if shipped) handoff/registry append. See `~/.claude/CLAUDE.md` ❸.
