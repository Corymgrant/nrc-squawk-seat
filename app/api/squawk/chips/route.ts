import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";

// job 1966: STATUS CHIP bridge for the rep's own Squawk Box feed (/protected).
// Proxies owner_dash.py's new GET /api/owner/squawk/chips?reporter=michael (same
// Tailscale-bridged Cockpit surface the owner Task Ledger panel already uses,
// token-gated server-side only — the browser never sees COCKPIT_TASKS_TOKEN).
// Read-only end to end: this route makes no writes, and neither does anything
// downstream of it (squawk_engine.py's chip_for()/lookup_ledger_row() are pure
// reads against the engine's own flywheel + approvals + the Orchestrator ledger).
// reporter is NOT client-controlled -- always the caller's own seat, so one rep
// session can never pull another reporter's squawk detail through this route.
const BASE = process.env.COCKPIT_OWNER_API_BASE;
const TOKEN = process.env.COCKPIT_TASKS_TOKEN;

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!BASE || !TOKEN) return NextResponse.json({ error: "Owner API not configured" }, { status: 500 });

  // Only Michael's (sales_rep) seat renders these chips today; an owner session
  // hitting this route directly gets refused rather than silently guessing which
  // reporter they meant.
  if (profile.role !== "sales_rep") {
    return NextResponse.json({ error: "This bridge is scoped to the rep seat" }, { status: 403 });
  }

  try {
    const r = await fetch(`${BASE}/squawk/chips?reporter=michael`, {
      headers: { "X-Tasks-Token": TOKEN },
      cache: "no-store",
    });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: `Cockpit unreachable: ${e}` }, { status: 502 });
  }
}
