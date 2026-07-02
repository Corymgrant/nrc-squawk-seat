import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";

// Systems-status for Michael's seat (job 335). TOP line = what customers actually
// complain about: is the public website up and is the quote form taking
// submissions. Both are REAL synthetic checks run from Vercel (i.e. from the
// public internet, the customer's vantage point):
//   - website:   GET the live homepage
//   - quote form: GET /get-quote/ (form markup present) + a non-polluting OPTIONS
//     CORS probe of the live n8n lead webhook — the same reachability proof the
//     get-quote canary uses. Creates ZERO leads/emails/pixel events.
// Internal rows derive from the Cockpit health poller snapshot (:7000 via the
// funnel), the same ground truth as Cory's owner dashboard.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SITE_URL = "https://www.norepaircost.com/";
const QUOTE_PAGE_URL = "https://www.norepaircost.com/get-quote/";
const QUOTE_WEBHOOK_URL = "https://n8n.nrc-cortex-link.com/webhook/nrc-get-quote";
const COCKPIT_BASE = process.env.COCKPIT_OWNER_API_BASE;
const COCKPIT_TOKEN = process.env.COCKPIT_TASKS_TOKEN;

type Light = "green" | "amber" | "red";
type Row = { key: string; label: string; light: Light; detail: string };

const worst = (lights: Light[]): Light =>
  lights.includes("red") ? "red" : lights.includes("amber") ? "amber" : "green";

async function checkWebsite(): Promise<Row> {
  try {
    const r = await fetch(SITE_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "NRC-SquawkSeat-StatusCheck" },
    });
    if (r.ok) {
      return { key: "website", label: "Website (norepaircost.com)", light: "green", detail: "Live — loads from the public internet" };
    }
    return { key: "website", label: "Website (norepaircost.com)", light: "red", detail: `Homepage returned HTTP ${r.status}` };
  } catch (e) {
    return { key: "website", label: "Website (norepaircost.com)", light: "red", detail: `Unreachable: ${e instanceof Error ? e.message : e}` };
  }
}

async function checkQuoteForm(): Promise<Row> {
  const label = "Quote form (get-quote)";
  let pageOk = false;
  let pageDetail = "";
  try {
    const r = await fetch(QUOTE_PAGE_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "NRC-SquawkSeat-StatusCheck" },
    });
    if (r.ok) {
      const html = await r.text();
      pageOk = html.includes("first_name") || html.includes("get-quote");
      pageDetail = pageOk ? "" : "Page loads but the form markup is missing";
    } else {
      pageDetail = `Quote page returned HTTP ${r.status}`;
    }
  } catch (e) {
    pageDetail = `Quote page unreachable: ${e instanceof Error ? e.message : e}`;
  }

  // Non-polluting submit-path probe: OPTIONS preflight against the live lead
  // webhook with the site's Origin. A browser submit only succeeds if this does.
  let hookOk = false;
  let hookDetail = "";
  try {
    const p = await fetch(QUOTE_WEBHOOK_URL, {
      method: "OPTIONS",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Origin: "https://www.norepaircost.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    const acao = p.headers.get("access-control-allow-origin") || "";
    if ((p.ok || p.status === 204) && (acao.includes("norepaircost.com") || acao === "*")) {
      hookOk = true;
    } else {
      hookDetail = `Submit endpoint probe: HTTP ${p.status}, CORS "${acao}"`;
    }
  } catch (e) {
    hookDetail = `Submit endpoint unreachable: ${e instanceof Error ? e.message : e}`;
  }

  if (pageOk && hookOk) {
    return { key: "quote_form", label, light: "green", detail: "Form page loads and the submit endpoint is accepting" };
  }
  return {
    key: "quote_form",
    label,
    light: pageOk || hookOk ? "amber" : "red",
    detail: [pageDetail, hookDetail].filter(Boolean).join(" · ") || "Partial failure",
  };
}

// Internal rows ← Cockpit poller snapshot. Each row maps to named live workflows.
type SnapItem = { name?: string; platform?: string; health?: string; status?: string; last_run?: string | null };

const healthToLight = (h?: string): Light =>
  h === "ok" ? "green" : h === "warn" ? "amber" : h ? "red" : "amber";

function rowFromItems(key: string, label: string, items: SnapItem[], needles: string[], okDetail: string): Row {
  const matched = needles.map((n) => ({
    needle: n,
    item: items.find((it) => (it.name || "").includes(n)),
  }));
  const missing = matched.filter((m) => !m.item).map((m) => m.needle);
  const bad = matched.filter((m) => m.item && m.item.health !== "ok");
  const lights = matched.map((m) => (m.item ? healthToLight(m.item.health) : "amber" as Light));
  const light = worst(lights);
  let detail = okDetail;
  if (bad.length || missing.length) {
    detail = [
      ...bad.map((m) => `${m.item!.name}: ${m.item!.health}${m.item!.status && m.item!.status !== "active" ? ` (${m.item!.status})` : ""}`),
      ...missing.map((n) => `${n}: not in health snapshot`),
    ].join(" · ");
  }
  return { key, label, light, detail };
}

async function internalRows(): Promise<{ rows: Row[]; snapshotTs: string | null }> {
  const fallback = (detail: string): { rows: Row[]; snapshotTs: string | null } => ({
    rows: [
      { key: "internal", label: "Internal systems", light: "amber", detail },
    ],
    snapshotTs: null,
  });
  if (!COCKPIT_BASE || !COCKPIT_TOKEN) return fallback("Cockpit health source not configured");
  try {
    const r = await fetch(`${COCKPIT_BASE}/health-snapshot`, {
      headers: { "X-Tasks-Token": COCKPIT_TOKEN },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return fallback(`Cockpit health source returned HTTP ${r.status}`);
    const j = await r.json();
    const items: SnapItem[] = Array.isArray(j.items) ? j.items : [];
    if (!items.length) return fallback(j.error || "No health snapshot available yet");

    const rows: Row[] = [
      rowFromItems("autoresponder", "Autoresponder (email drafts)", items,
        ["Auto-Reply Michael", "Auto-Reply Erika"], "Michael + Erika drafters running"),
      rowFromItems("lead_pipeline", "Lead pipeline", items,
        ["Lead-Flow Watchdog", "Flywheel Ledger Capture"], "Leads flowing, watchdog on duty"),
      rowFromItems("quote_pipeline", "Quote pipeline", items,
        ["NOR-9 Port", "Quote Page Proxy v1 (n8n)", "Quote Safety Net Watcher"], "Quote delivery + view-quote page running"),
      (() => {
        const close = items.filter((it) => it.platform === "close");
        if (!close.length) {
          return { key: "close", label: "Close (CRM)", light: "amber" as Light, detail: "No Close data in health snapshot" };
        }
        const bad = close.filter((it) => it.health !== "ok");
        return {
          key: "close",
          label: "Close (CRM)",
          light: bad.length ? worst(bad.map((b) => healthToLight(b.health))) : ("green" as Light),
          detail: bad.length
            ? bad.map((b) => `${b.name}: ${b.health}`).join(" · ")
            : `Reachable — ${close.length} automations monitored`,
        };
      })(),
      rowFromItems("sms", "SMS", items,
        ["SMS Send Gate", "SMS STOP"], "Send gate + opt-out listener running"),
    ];

    // Stale snapshot → don't show confident green off old data.
    const ts = typeof j.ts === "string" ? j.ts : null;
    if (ts) {
      const ageMin = (Date.now() - Date.parse(ts)) / 60_000;
      if (Number.isFinite(ageMin) && ageMin > 120) {
        rows.forEach((row) => {
          if (row.light === "green") {
            row.light = "amber";
            row.detail += ` · health data is ${Math.round(ageMin)} min old`;
          }
        });
      }
    }
    return { rows, snapshotTs: ts };
  } catch (e) {
    return fallback(`Cockpit health source unreachable: ${e instanceof Error ? e.message : e}`);
  }
}

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [website, quoteForm, internal] = await Promise.all([
    checkWebsite(),
    checkQuoteForm(),
    internalRows(),
  ]);

  const publicRows = [website, quoteForm];
  const rows = [...publicRows, ...internal.rows];
  const overall = worst(rows.map((r) => r.light));
  const publicOk = worst(publicRows.map((r) => r.light)) === "green";

  return NextResponse.json({
    ok: true,
    checked_at: new Date().toISOString(),
    overall,
    verdict: publicOk
      ? "Site is up and the quote form is accepting — a “site is down” complaint is almost certainly on the customer's end (their device/connection)."
      : "The public site or quote form is NOT healthy — this one may be real. Flag Cory.",
    public: publicRows,
    internal: internal.rows,
    snapshot_ts: internal.snapshotTs,
  });
}
