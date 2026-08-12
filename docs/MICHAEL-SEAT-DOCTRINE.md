# MICHAEL-SEAT DESIGN DOCTRINE (v2)

**Source:** Cory, 2026-07-09 ~01:00 — *"Michael should see what the robot is doing but I don't want him to try and shut this down."*
**Status:** BINDING on the v2 Michael-seat build (`/protected`) and on every squawk-triage answer / FYI that reaches Michael. Job 512.

> The sale-activity tile on Michael's seat is a **WINDOW, NEVER A SWITCH.**

Michael's commission is aligned with closing hot leads. The whole adoption strategy is to
position the machine as the thing that works the *cold* pile so Michael's time goes to
*closes*. He gets to see the value flowing to him — he never gets a lever to stop it.

---

## The five rules (verbatim intent)

### 1. OUTCOMES framing, not worker framing
State results, not the machinery that produced them.
- **Do:** `Sale: 14 replies in · 9 quotes sent · 3 hot leads routed to you`
- **Never:** "AI drafted", draft-vs-edit ratios, autonomy-ladder status, model/tool names,
  job numbers, "the robot did X". The system did it — full stop. No mechanism is ever
  named to Michael, and **no autonomy status is EVER visible to him.**

### 2. ZERO control surfaces on any lane
No pause / disable / settings / opt-out / "turn off" affordance anywhere on his seat, for
any lane. His **only input channel is the squawk box** (quality feedback → flywheel).
Squawk answers must **never imply he can veto a lane** — gates + Cory decide, period.

### 3. The tile LEADS with what the machine feeds HIM
Top of the tile = **hot buying-intent leads routed to his queue, with context.** Frame the
robot as the worker of the cold pile; his time goes to the closes it hands him. His
commission alignment IS the adoption strategy — lead with it.

### 4. Compartmentalization (extends the existing owner/rep split)
**None of these ever appear in his seat:** spend, strategy, lane configs, system
architecture, business metrics, other reps' pipelines. (The engine already enforces this
at intake via `METRICS_GUARD` → owner-lane queries are refused, not answered.)

### 5. Same framing on ALL Michael-facing prose
Every squawk **resolution summary** and **FYI email** to Michael uses the same
outcomes-not-mechanism framing. A resolution tells him the customer/lead outcome
("Kevin's quote is back out to him"), never the fix mechanism, and never implies a veto.

---

## How this is enforced in code (job 512)

| Surface | Where | Enforcement |
|---|---|---|
| FYI / resolution email to Michael | `squawk-box/squawk_engine.py` → `build_michael_email()` | `cause` line scrubbed by `frame_for_michael()` |
| Seat lifecycle notes / resolution summary | `squawk_engine.py` → `sync_seat_status()` | every `note` scrubbed by `frame_for_michael()` |
| Owner-lane / metrics questions | `squawk_engine.py` → `classify()` `METRICS_GUARD` | refused, compartmentalized (pre-existing) |
| Auto-queued squawk-fix answers | `conductor/squawk_authority.py` → `write_cook()` step 4 | doctrine instruction + engine backstop |

`frame_for_michael(s)` is a sentence-level scrub (same shape as the coverage/banned
guards): it drops any sentence leaking mechanism / worker-framing / veto language and
keeps clean outcome sentences; if nothing survives it falls back to a safe outcome line.
Pure and fail-open.

## Binding on the v2 sale-activity tile build (not yet built)
When the tile is built it MUST:
- render outcome counters only (`replies in`, `quotes sent`, `hot leads routed to you`) —
  no per-draft attribution, no edit ratios, no autonomy state;
- **lead** with the hot-leads-routed-to-you list + context;
- expose **zero** lane controls (no pause/disable/settings/opt-out);
- pull from a Michael-scoped sales-outcomes source only — **never** spend / strategy /
  lane-config / architecture / cross-rep data.

> **OPEN (human decision, not a guess):** the exact data source for the outcome counters
> and the hot-leads-routed feed is not yet specified. That is the first question for the
> tile-build cook — it was deliberately NOT invented here (park-don't-guess).
