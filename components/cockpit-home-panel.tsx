"use client";

// job 2120 — THE COCKPIT DASHBOARD v1. job 2157 — desktop-first Apple-HIG
// rebuild of the SAME surface (Cory ruling 2026-08-25: "I don't want a V1
// of the dashboard. I want THE dashboard"). Still one consolidated "Home"
// surface, modes-not-panes: a real 3-column grid at >=1440px (Cory's M1
// seat) — Needs-you as a sticky primary column, Objectives+KPIs in the
// middle, Squawk/Queue on the right — collapsing to the untouched mobile
// single-column stack below that breakpoint. Five sections per the
// row-2120/2157 cooks:
//   1. Needs-Cory to-do card  — merges Inbox Sentinel + open gate/notes cards
//      + expired-default objective taps into one sorted, tappable list.
//   2. Objectives Rail (A-H) + honest Autonomy Gauge.
//   3. KPI tiles — leads vs floor(80), spend pace vs glide, real CPL, Lane B
//      shadow count, batch-1 recovery (explicitly "no live source" if unwired).
//   4. Squawk + Page feed — reuses the same panels.squawk data the Squawk tab
//      already loads (no new plumbing).
//   5. Cook Queue strip — running/queued/parked/blocked with age, PLUS
//      (job 2357) a "Completed · last 24h" sub-section carrying each row's
//      actual deliverable link(s) and ack status — the durable backstop to
//      the WIN-lane completion notification, so a finished deliverable is
//      never invisible even if its ntfy page was missed (job 2332 incident).
//
// HALO freshness invariant: every section renders its own `stale` flag as a
// visible badge, PLUS a top-of-surface "as of" timestamp (job 2157) — a
// stale/old tile must SAY so rather than silently showing a possibly-old
// number. Every KPI also carries a one-line plain-English definition inline
// (job 2157) so a number is never presented without saying what it means.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const C = {
  card: "#14181A",
  text: "#EDEFEE",
  muted: "#7E8682",
  emerald: "#2FD79B",
  amber: "#F5B544",
  red: "#F2655A",
  line: "#222829",
};
const card: React.CSSProperties = {
  background: C.card,
  borderRadius: 18,
  padding: 16,
  marginBottom: 16,
  border: `1px solid ${C.line}`,
  boxShadow: "0 1px 2px rgba(0,0,0,.35), 0 8px 24px -16px rgba(0,0,0,.5)",
};
const label: React.CSSProperties = { color: C.muted, fontSize: 12.5, fontWeight: 500, letterSpacing: 0.2 };

// One-line plain-English definitions — every number on this surface must
// carry its meaning inline (job 2157 point 5), not just a data label.
const DEFINITIONS = {
  leads: "Count of new Close leads today vs the 80/day minimum floor (leads below this pace under-fund the funnel).",
  spend: "Meta account spend over the trailing-30-day window vs the registered monthly budget line — refreshed nightly by the job1974 spend-pace invariant (on the 31st that window IS the month-to-date).",
  cpl: "Close-side cost-per-lead: today's Meta spend ÷ Close leads actually created today.",
  lpCvr: "Visitor → lead conversion rate on the landing pages — no per-visitor analytics source wired yet.",
  batch1: "Recovery sends completed against the batch-1 phone-migration cohort — no live send-count tracker wired yet.",
  laneB: "Real (non-synthetic) autoresponder drafts logged in Lane B, counted toward the 10-draft graduation threshold.",
  unwatched: "Estate graph nodes (workflows, credentials, cron, ads, invariants…) with zero incoming 'watches' edge from any invariant — a green heartbeat doesn't count as watched. This number rising is itself an alarm.",
  objectives: "A–H progress on the standing objectives registry; the bar fills toward 100% as each objective's own milestones close.",
  cookQueue: "Age = hours since the row was last picked up; 'waiting on' names the exact blocker keeping it from moving.",
  squawk: "Rep-reported problems from the Squawk Box, last 48h, with their current triage status.",
  completed24h: "job2357: every row that finished in the last 24h, with the actual deliverable link(s) it shipped and whether the completion page was acknowledged. A row with no link here shipped without a recorded deliverable notice — that's a gap, not a blank.",
} as const;

function fmtAsOf(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function StaleBadge({ stale, reason }: { stale?: boolean; reason?: string | null }) {
  if (!stale) return null;
  return (
    <span
      title={reason || "data may be out of date"}
      style={{
        fontSize: 10,
        color: C.amber,
        border: `1px solid ${C.amber}66`,
        borderRadius: 5,
        padding: "1px 5px",
        fontWeight: 700,
        letterSpacing: 0.3,
      }}
    >
      STALE
    </span>
  );
}

function Definition({ children }: { children: React.ReactNode }) {
  return <div className="cx-def">{children}</div>;
}

function money(n: number | null | undefined) {
  if (n == null || isNaN(Number(n))) return "—";
  return "$" + Math.round(Number(n)).toLocaleString();
}

// job 2366 polish (Cory 2026-08-31, pre-demo): synthetic/test entries must not
// appear on the default Home view — they remain visible on the full Squawk tab
// (squawk-feed.tsx / squawk-console are untouched). Matches a TEST token in
// brackets ([TEST], [test], [ TEST ]) or the phrase "synthetic test",
// case-insensitive, anywhere in the entry title/body.
const TEST_ENTRY_RE = /\[\s*test\s*\]|synthetic test/i;
function isTestEntry(title?: string | null): boolean {
  return !!title && TEST_ENTRY_RE.test(title);
}

// ── types (mirrors cockpit_v1.py's assemble() shape) ─────────────────────────
type InboxItem = {
  id: string; from: string; subject: string; age_hours: number | null;
  aged: boolean; thread_url: string; counterpart: string | null;
};
type NoteLike = {
  id: number; item_type: string; item_ref: string | null; item_label: string | null;
  body: string; status: string; created_at: string;
};
type ExpiredDefault = {
  key: string; objective: string; action: string; reason: string; deadline: string;
};
type NotifyPage = {
  id: number; ts: string; title: string; body: string; category: string | null;
  job_ref: string | null; row_ref: string | null; source: string | null; dedupe_key: string;
};
type ObjectiveItem = {
  key: string; name: string; progress_pct: number | null; status: string;
  next_step: string | null; blocker: string | null; last_advanced_date: string | null;
};
type CookQueueItem = {
  id: number; title: string; status: string; priority: string | null;
  owner: string | null; age_hours: number | null; waiting_on: string | null;
};
type CompletedItem = {
  id: number; title: string; age_hours: number | null; urls: string[];
  has_deliverable: boolean; acknowledged: boolean | null; resurface_count: number;
};
type CockpitV1 = {
  generated_at: string;
  objectives: { items: ObjectiveItem[]; stale?: boolean; stale_reason?: string | null; no_data?: boolean };
  autonomy_gauge: {
    autonomy_pct: number | null; n_auto_resolved: number; n_cory_input: number;
    n_ambiguous: number; n_touched_total: number; sample_size_ok: boolean;
    window_days: number; definition: string; no_data?: boolean;
  };
  kpi_tiles: {
    leads: { leads_today?: number; leads_yesterday?: number; floor?: number; today_vs_floor?: string; no_data?: boolean };
    spend_pace: { budget_line_glide?: number; spend?: number; pace_pct?: number; verdict?: string; stale?: boolean; no_data?: boolean; date?: string };
    cpl_cvr: { real_cpl_usd?: number | null; close_rate_pct?: number | null; quote_rate_pct?: number | null; lp_cvr_no_source?: boolean; stale?: boolean; no_data?: boolean };
    unwatched_nodes: { unwatched_count?: number | null; unwatched_count_prev?: number | null; rising?: boolean | null; node_count?: number | null; orphan_count?: number | null; stale?: boolean; no_data?: boolean; reason?: string };
    batch1_recovery_sends: { no_data?: boolean; reason?: string };
    lane_b_shadow: { real_drafts?: number; total_drafts?: number; graduation_threshold?: number; stale?: boolean; no_data?: boolean };
  };
  cook_queue: { items: CookQueueItem[]; by_status: Record<string, number>; completed_24h?: { items: CompletedItem[]; no_data?: boolean }; no_data?: boolean };
  expired_defaults: { items: ExpiredDefault[]; no_data?: boolean };
  notify_pages: { items: NotifyPage[]; stale?: boolean; no_data?: boolean };
  error?: string;
};

function statusColor(s: string) {
  if (s === "blocked" || s === "failed") return C.red;
  if (s === "parked" || s === "needs-decision" || s === "queued") return C.amber;
  if (s === "in-progress") return C.emerald;
  return C.muted;
}
function objStatusColor(s: string) {
  if (s === "blocked_on_cory") return C.amber;
  if (s === "gated") return C.muted;
  return C.emerald;
}

// ── Needs-Cory unified card ───────────────────────────────────────────────────
function NeedsCoryCard({
  inboxItems,
  onInboxAction,
  gateNotes,
  onAckNote,
  expired,
  notifyPages,
  onResolvePage,
}: {
  inboxItems: InboxItem[];
  onInboxAction: (id: string, action: "dismiss" | "snooze") => void;
  gateNotes: NoteLike[];
  onAckNote: (id: number) => void;
  expired: ExpiredDefault[];
  notifyPages: NotifyPage[];
  onResolvePage: (id: number) => void;
}) {
  const [pressed, setPressed] = useState<string | null>(null);
  const total = inboxItems.length + gateNotes.length + expired.length + notifyPages.length;
  const INBOX_CAP = 8;
  const shownInbox = inboxItems.slice(0, INBOX_CAP);
  const hiddenInboxCount = inboxItems.length - shownInbox.length;
  const PAGES_CAP = 10;
  const shownPages = notifyPages.slice(0, PAGES_CAP);
  const hiddenPagesCount = notifyPages.length - shownPages.length;

  return (
    <div style={{ ...card, borderColor: total > 0 ? C.amber : C.line }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="cx-title" style={{ color: C.text }}>Needs you</span>
        <span className="cx-headline" style={{ color: total > 0 ? C.amber : C.emerald }}>{total} open</span>
      </div>

      {total === 0 && <div style={{ color: C.emerald, fontSize: 13, marginTop: 8 }}>clean — nothing waiting on you</div>}

      {expired.map((e) => (
        <div key={`exp-${e.key}`} style={{ padding: "10px 0", borderTop: `1px solid ${C.line}`, marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span className="cx-eyebrow" style={{ color: C.amber }}>⏰ EXPIRED DEFAULT</span>
            <span style={{ color: C.muted, fontSize: 10.5 }}>{e.key} · was due {e.deadline}</span>
          </div>
          <div className="cx-body" style={{ color: C.text, marginTop: 3 }}>{e.action}</div>
        </div>
      ))}

      {shownPages.map((p) => (
        <div key={`page-${p.id}`} style={{ padding: "10px 0", borderTop: `1px solid ${C.line}`, marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <span className="cx-eyebrow" style={{ color: C.amber }}>
                📟 PAGE{p.category ? ` · ${p.category.toUpperCase()}` : ""}
              </span>
              {(p.job_ref || p.row_ref) && (
                <span style={{ color: C.muted, fontSize: 10.5 }}>
                  {" "}· {p.job_ref ? `job${p.job_ref}` : ""}{p.row_ref ? ` #${p.row_ref}` : ""}
                </span>
              )}
              <div className="cx-body" style={{ color: C.text, marginTop: 2, fontWeight: 600 }}>{p.title}</div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{p.body.slice(0, 220)}</div>
            </div>
            <button
              className="cx-btn"
              onMouseDown={() => setPressed(`page-${p.id}`)}
              onMouseUp={() => setPressed(null)}
              onTouchStart={() => setPressed(`page-${p.id}`)}
              onTouchEnd={() => setPressed(null)}
              onClick={() => onResolvePage(p.id)}
              style={{
                background: "transparent", border: `1px solid ${C.emerald}`, color: C.emerald,
                borderRadius: 8, padding: "4px 9px", fontSize: 11, flexShrink: 0,
                transform: pressed === `page-${p.id}` ? "scale(0.94)" : undefined,
              }}
            >
              ✓ resolved
            </button>
          </div>
        </div>
      ))}
      {hiddenPagesCount > 0 && (
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 11.5, color: C.muted }}>
          +{hiddenPagesCount} more page(s) — see cockpit_pages
        </div>
      )}

      {gateNotes.map((n) => (
        <div key={`note-${n.id}`} style={{ padding: "10px 0", borderTop: `1px solid ${C.line}`, marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ color: C.muted, fontSize: 10.5 }}>gate · {n.item_label || n.item_type}</span>
              <div className="cx-body" style={{ color: C.text, marginTop: 2 }}>{n.body.slice(0, 140)}</div>
            </div>
            <button
              className="cx-btn"
              onMouseDown={() => setPressed(`note-${n.id}`)}
              onMouseUp={() => setPressed(null)}
              onTouchStart={() => setPressed(`note-${n.id}`)}
              onTouchEnd={() => setPressed(null)}
              onClick={() => onAckNote(n.id)}
              style={{
                background: "transparent", border: `1px solid ${C.emerald}`, color: C.emerald,
                borderRadius: 8, padding: "4px 9px", fontSize: 11, flexShrink: 0,
                transform: pressed === `note-${n.id}` ? "scale(0.94)" : undefined,
              }}
            >
              ✓ handled
            </button>
          </div>
        </div>
      ))}

      {shownInbox.map((i) => (
        <div key={`inbox-${i.id}`} style={{ padding: "10px 0", borderTop: `1px solid ${C.line}`, marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <a href={i.thread_url} target="_blank" rel="noreferrer" style={{ minWidth: 0, textDecoration: "none", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                {i.aged && <span style={{ color: C.red, fontSize: 10.5 }}>⚠️ AGED</span>}
                <span style={{ color: C.muted, fontSize: 10.5 }}>email</span>
              </div>
              <div className="cx-body" style={{ color: C.text, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {i.subject || "(no subject)"}
              </div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>
                {i.from} · {i.age_hours != null ? `${Math.round(i.age_hours)}h ago` : ""}
              </div>
            </a>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button className="cx-btn" onClick={() => onInboxAction(i.id, "snooze")} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 8, padding: "4px 9px", fontSize: 11 }}>snooze</button>
              <button className="cx-btn" onClick={() => onInboxAction(i.id, "dismiss")} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 8, padding: "4px 9px", fontSize: 11 }}>dismiss</button>
            </div>
          </div>
        </div>
      ))}
      {hiddenInboxCount > 0 && (
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 11.5, color: C.muted }}>
          +{hiddenInboxCount} more in Inbox — see full list on the Ops tab
        </div>
      )}
    </div>
  );
}

// ── Objectives Rail + Autonomy Gauge ─────────────────────────────────────────
function ObjectivesRail({ data }: { data: CockpitV1["objectives"] }) {
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="cx-title" style={{ color: C.text }}>Objectives · A–H</span>
        <StaleBadge stale={data.stale} reason={data.stale_reason} />
      </div>
      <Definition>{DEFINITIONS.objectives}</Definition>
      {data.no_data && <div style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>—</div>}
      {(data.items || []).map((o) => (
        <div key={o.key} style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="cx-headline" style={{ color: C.text }}>{o.key} · {o.name}</span>
            <span className="cx-number" style={{ fontSize: 13, color: objStatusColor(o.status) }}>{o.progress_pct != null ? `${Math.round(o.progress_pct)}%` : "—"}</span>
          </div>
          <div style={{ height: 5, background: "#0c0f10", borderRadius: 4, marginTop: 6, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, Number(o.progress_pct) || 0)}%`, height: "100%", background: objStatusColor(o.status), transition: "width .3s var(--cx-ease)" }} />
          </div>
          {o.blocker && <div style={{ fontSize: 11, color: C.amber, marginTop: 4 }}>blocked: {o.blocker}</div>}
        </div>
      ))}
    </div>
  );
}

function AutonomyGauge({ data }: { data: CockpitV1["autonomy_gauge"] }) {
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="cx-headline" style={{ color: C.muted }}>Autonomy gauge · {data.window_days ?? 7}d</span>
        {!data.sample_size_ok && !data.no_data && <span className="cx-caption" style={{ color: C.muted }}>small-n</span>}
      </div>
      {data.no_data ? (
        <div style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>—</div>
      ) : (
        <>
          <div className="cx-number" style={{ color: C.text, fontSize: 40, marginTop: 6 }}>
            {data.autonomy_pct != null ? `${data.autonomy_pct}%` : "—"}
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 400, letterSpacing: 0 }}> resolved without you</span>
          </div>
          <div style={{ ...label, marginTop: 8 }}>
            {data.n_auto_resolved} auto-resolved · {data.n_cory_input} needed you · {data.n_ambiguous} unclassified
          </div>
          <Definition>{data.definition}</Definition>
        </>
      )}
    </div>
  );
}

// ── KPI tiles ─────────────────────────────────────────────────────────────────
function KpiTile({ title, definition, children, stale, noData, reason }: { title: string; definition: string; children?: React.ReactNode; stale?: boolean; noData?: boolean; reason?: string }) {
  return (
    <div className="cx-card--tap" style={{ ...card, marginBottom: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="cx-caption" style={{ color: C.muted }}>{title}</span>
        <StaleBadge stale={stale} />
      </div>
      {noData ? (
        <div style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>no live source{reason ? ` — ${reason.slice(0, 60)}` : ""}</div>
      ) : (
        <div style={{ marginTop: 8 }}>{children}</div>
      )}
      <Definition>{definition}</Definition>
    </div>
  );
}

function KpiTiles({ data }: { data: CockpitV1["kpi_tiles"] }) {
  const leads = data.leads || {};
  const spend = data.spend_pace || {};
  const cpl = data.cpl_cvr || {};
  const unwatched = data.unwatched_nodes || {};
  const laneB = data.lane_b_shadow || {};
  const batch1 = data.batch1_recovery_sends || {};
  const belowFloor = leads.today_vs_floor === "below";

  // job 2366 polish: name the spend tile's ACTUAL data window instead of the
  // old "today's spend" implication. The job1974 invariant reads Meta's
  // last_30d preset at run time; the state's own date_start/date_stop for run
  // date D are [D-30d … D-1d] — derive the same window here from spend.date so
  // the label can never drift from the number. When that window starts on the
  // 1st it IS the month-to-date, so say so (Cory's 2026-08-31 wording).
  function spendWindowLabel(dateStr?: string): string {
    if (!dateStr) return "30-day spend";
    const d = new Date(dateStr + "T12:00:00Z");
    if (isNaN(d.getTime())) return "30-day spend";
    const stop = new Date(d.getTime() - 86400000);
    const start = new Date(stop.getTime() - 29 * 86400000);
    const fmt = (x: Date) => x.toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });
    const isMtd = start.getUTCDate() === 1 && start.getUTCMonth() === stop.getUTCMonth();
    return isMtd ? `month-to-date (${fmt(start)}–${fmt(stop)})` : `${fmt(start)}–${fmt(stop)} spend`;
  }

  return (
    <div className="cx-kpi-grid">
      <KpiTile title="Leads today vs floor(80)" definition={DEFINITIONS.leads} noData={leads.no_data}>
        <div className="cx-number" style={{ fontSize: 28, color: belowFloor ? C.amber : C.emerald }}>{leads.leads_today ?? "—"}</div>
        <div style={label}>yesterday {leads.leads_yesterday ?? "—"} · floor {leads.floor ?? 80}</div>
      </KpiTile>
      <KpiTile title="Spend pace vs monthly line" definition={DEFINITIONS.spend} stale={spend.stale} noData={spend.no_data}>
        <div className="cx-number" style={{ fontSize: 28, color: spend.verdict === "breach" ? C.red : C.emerald }}>
          {spend.pace_pct != null ? `${spend.pace_pct}%` : "—"}
        </div>
        <div style={label}>{money(spend.spend)} {spendWindowLabel(spend.date)} · {money(spend.budget_line_glide)}/mo line</div>
      </KpiTile>
      <KpiTile title="Real CPL · Close-side" definition={DEFINITIONS.cpl} stale={cpl.stale} noData={cpl.no_data}>
        <div className="cx-number" style={{ fontSize: 28, color: C.text }}>{cpl.real_cpl_usd != null ? `$${cpl.real_cpl_usd}` : "—"}</div>
        <div style={label}>close rate {cpl.close_rate_pct != null ? `${cpl.close_rate_pct}%` : "—"}</div>
      </KpiTile>
      {/* job2321/job2341 — THE GRAPH LAYER headline number: nodes with zero
          watching invariant. Rising = alarm, surfaced here so Cory sees the
          same number the nightly sweep pages on, without opening the Graph tab. */}
      <KpiTile title="Unwatched estate nodes" definition={DEFINITIONS.unwatched} stale={unwatched.stale} noData={unwatched.no_data} reason={unwatched.reason}>
        <div className="cx-number" style={{ fontSize: 28, color: unwatched.rising ? C.amber : C.text }}>
          {unwatched.unwatched_count ?? "—"}
          {unwatched.rising != null && (
            <span style={{ fontSize: 13, color: unwatched.rising ? C.amber : C.emerald, fontWeight: 600, letterSpacing: 0 }}>
              {" "}{unwatched.rising ? "▲ rising" : "flat/falling"}
            </span>
          )}
        </div>
        <div style={label}>
          of {unwatched.node_count ?? "—"} nodes · {unwatched.orphan_count ?? "—"} fully orphaned
          {unwatched.unwatched_count_prev != null ? ` · was ${unwatched.unwatched_count_prev}` : ""}
        </div>
      </KpiTile>
      <KpiTile title="LP CVR" definition={DEFINITIONS.lpCvr} noData reason="no visitor-level LP conversion source wired for v1">
        <span />
      </KpiTile>
      <KpiTile title="Batch-1 recovery sends" definition={DEFINITIONS.batch1} noData={batch1.no_data} reason={batch1.reason}>
        <span />
      </KpiTile>
      <KpiTile title="Lane B shadow drafts" definition={DEFINITIONS.laneB} stale={laneB.stale} noData={laneB.no_data}>
        <div className="cx-number" style={{ fontSize: 28, color: C.text }}>{laneB.real_drafts ?? "—"} <span style={{ fontSize: 13, color: C.muted, fontWeight: 400, letterSpacing: 0 }}>/ {laneB.graduation_threshold ?? 10}</span></div>
        <div style={label}>{laneB.total_drafts ?? 0} total drafts</div>
      </KpiTile>
    </div>
  );
}

// ── Cook Queue strip ───────────────────────────────────────────────────────────
function CookQueueStrip({ data }: { data: CockpitV1["cook_queue"] }) {
  const items = data.items || [];
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="cx-title" style={{ color: C.text, fontSize: 15 }}>Cook queue · why we&apos;re waiting</span>
      </div>
      <Definition>{DEFINITIONS.cookQueue}</Definition>
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {Object.entries(data.by_status || {}).map(([s, n]) => (
          <span key={s} style={{ fontSize: 11, color: statusColor(s), border: `1px solid ${statusColor(s)}55`, borderRadius: 999, padding: "2px 9px" }}>
            {s} {n}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 10, maxHeight: 320, overflowY: "auto" }}>
        {items.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>—</div>}
        {items.map((it, i) => (
          <div key={it.id} style={{ padding: "6px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 12.5, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                #{it.id} {it.title}
              </span>
              <span style={{ fontSize: 11, color: statusColor(it.status), whiteSpace: "nowrap" }}>
                {it.status} · {it.age_hours != null ? `${it.age_hours}h` : "—"}
              </span>
            </div>
            {it.waiting_on && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>waiting on: {it.waiting_on}</div>}
          </div>
        ))}
      </div>
      <CompletedLast24h data={data.completed_24h} />
    </div>
  );
}

// job2357: completed-in-last-24h with deliverable links, one tap. Root
// incident: job 2332's NAARVA completion (2 live URLs) was ACCEPTED rc=200
// by the notify router and never reached Cory — this panel is the durable
// backstop the notification is only the interrupt for (row2357 instruction
// SIX: "the dashboard is the durable answer — the notification is the
// interrupt. Both must carry the artifact, not just the status.").
function CompletedLast24h({ data }: { data?: CockpitV1["cook_queue"]["completed_24h"] }) {
  const items = data?.items || [];
  if (!data || data.no_data) return null;
  return (
    <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
      <span className="cx-title" style={{ color: C.text, fontSize: 13 }}>Completed · last 24h</span>
      <Definition>{DEFINITIONS.completed24h}</Definition>
      <div style={{ marginTop: 8, maxHeight: 260, overflowY: "auto" }}>
        {items.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>—</div>}
        {items.map((it, i) => (
          <div key={it.id} style={{ padding: "6px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 12.5, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                #{it.id} {it.title}
              </span>
              <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{it.age_hours != null ? `${it.age_hours}h ago` : "—"}</span>
            </div>
            {it.has_deliverable ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 3, alignItems: "center" }}>
                {it.urls.map((u, j) => (
                  <a key={j} href={u} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: C.emerald, textDecoration: "underline" }}>
                    {u.replace(/^https?:\/\//, "")}
                  </a>
                ))}
                <span style={{ fontSize: 10.5, color: it.acknowledged ? C.emerald : C.amber }}>
                  {it.acknowledged ? "✓ seen" : it.resurface_count > 0 ? `pending · resurfaced ${it.resurface_count}x` : "pending"}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>no deliverable link recorded</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Squawk + Page feed (reuses panels.squawk already fetched by dashboard-client) ─
function SquawkPageFeed({ squawk }: { squawk: { count?: number; activity?: Array<{ timestamp: number; sanitized_problem: string; tier: string; status: string }> } }) {
  const activity = (squawk?.activity ?? []).slice(0, 10);
  const cutoff = Date.now() / 1000 - 48 * 3600;
  // job 2366: hide [TEST]/synthetic-test entries on the demo front page only
  const recent = activity.filter((a) => (!a.timestamp || a.timestamp >= cutoff) && !isTestEntry(a.sanitized_problem));
  function color(s?: string) {
    if (s === "resolved" || s === "auto-fixed") return C.emerald;
    if (s === "failed") return C.red;
    if (s === "pending-approval") return C.amber;
    return C.muted;
  }
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="cx-title" style={{ color: C.text, fontSize: 15 }}>Squawk + page feed · 48h</span>
        <span className="cx-number" style={{ fontSize: 13, color: C.muted }}>{squawk?.count ?? 0}</span>
      </div>
      <Definition>{DEFINITIONS.squawk}</Definition>
      <div style={{ marginTop: 10 }}>
        {recent.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>—</div>}
        {recent.map((a, i) => (
          <div key={i} style={{ padding: "6px 0", borderTop: i ? `1px solid ${C.line}` : "none", display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 13, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {(a.sanitized_problem || "(activity)").slice(0, 70)}
            </span>
            <span style={{ fontSize: 11, color: color(a.status), whiteSpace: "nowrap" }}>{a.status}</span>
          </div>
        ))}
      </div>
      <Link href="#" className="cx-fade" onClick={(e) => { e.preventDefault(); document.querySelector<HTMLButtonElement>('[data-tab-btn="squawk"]')?.click(); }}
        style={{ display: "block", marginTop: 10, textAlign: "center", color: C.emerald, fontSize: 12.5, textDecoration: "none" }}>
        full Squawk tab →
      </Link>
    </div>
  );
}

// ── main ───────────────────────────────────────────────────────────────────────
export function CockpitHomePanel({
  squawk,
  notes,
  loadNotes,
}: {
  squawk: { count?: number; activity?: Array<{ timestamp: number; sanitized_problem: string; tier: string; status: string }> };
  notes: NoteLike[];
  loadNotes: () => void;
}) {
  const [v1, setV1] = useState<CockpitV1 | null>(null);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [v1Err, setV1Err] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/owner/cockpit-v1", { cache: "no-store" });
      const j = await r.json();
      if (r.ok && !j.error) {
        setV1(j);
        setV1Err(null);
      } else {
        setV1Err(j.error || "could not load cockpit-v1");
      }
    } catch (e) {
      setV1Err(String(e));
    }
    try {
      const ri = await fetch("/api/owner/inbox-needs-you", { cache: "no-store" });
      const ji = await ri.json();
      if (ri.ok && !ji.error) setInbox(ji.items ?? []);
    } catch {
      /* keep last */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, [load]);

  const inboxAction = useCallback(
    async (id: string, action: "dismiss" | "snooze") => {
      setInbox((s) => s.filter((i) => i.id !== id));
      try {
        await fetch("/api/owner/inbox-needs-you", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action, hours: 24 }),
        });
      } finally {
        load();
      }
    },
    [load]
  );

  const ackNote = useCallback(
    async (id: number) => {
      try {
        await fetch("/api/dashboard/notes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      } finally {
        loadNotes();
      }
    },
    [loadNotes]
  );

  const resolvePage = useCallback(
    async (id: number) => {
      // optimistic remove — refresh on next 45s poll reconciles with the server
      setV1((s) => (s ? { ...s, notify_pages: { ...s.notify_pages, items: s.notify_pages.items.filter((p) => p.id !== id) } } : s));
      try {
        await fetch(`/api/owner/notify-pages/${id}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: "resolved from dashboard" }),
        });
      } finally {
        load();
      }
    },
    [load]
  );

  const gateNotes = notes.filter((n) => n.status === "open" && n.item_ref !== "freeform-inbox");
  const expired = v1?.expired_defaults?.items ?? [];
  // job 2366: hide [TEST]/synthetic-test pages on the demo front page only
  const notifyPages = (v1?.notify_pages?.items ?? []).filter((p) => !isTestEntry(p.title) && !isTestEntry(p.body));

  return (
    <div>
      {v1Err && (
        <div style={{ ...card, borderColor: C.red, color: C.red, fontSize: 13 }}>
          Couldn&apos;t reach Cockpit v1: {v1Err}
        </div>
      )}

      {v1 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <span className="cx-caption" style={{ color: C.muted }} title="Server-side ledger read time — this whole surface's freshness stamp">
            data as of {fmtAsOf(v1.generated_at)}
          </span>
        </div>
      )}

      <div className="cx-home-shell">
        <div className="cx-col-primary">
          <NeedsCoryCard
            inboxItems={inbox}
            onInboxAction={inboxAction}
            gateNotes={gateNotes}
            onAckNote={ackNote}
            expired={expired}
            notifyPages={notifyPages}
            onResolvePage={resolvePage}
          />
        </div>

        <div className="cx-col-secondary">
          {v1 && <AutonomyGauge data={v1.autonomy_gauge} />}
          {v1 && <ObjectivesRail data={v1.objectives} />}
          {v1 && <KpiTiles data={v1.kpi_tiles} />}
        </div>

        <div className="cx-col-tertiary">
          <SquawkPageFeed squawk={squawk} />
          {v1 && <CookQueueStrip data={v1.cook_queue} />}
        </div>
      </div>
    </div>
  );
}
