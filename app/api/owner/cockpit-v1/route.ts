import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";

// job 2120 — THE COCKPIT DASHBOARD v1: proxies owner_dash.py's
// GET /api/owner/cockpit-v1 (Objectives Rail A-H, Autonomy Gauge, KPI tiles,
// Cook Queue strip, expired-default taps). Read-only; server-side token
// never reaches the browser bundle. Mirrors the existing inbox-needs-you /
// task-ledger proxy pattern.
const BASE = process.env.COCKPIT_OWNER_API_BASE;
const TOKEN = process.env.COCKPIT_TASKS_TOKEN;

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (profile.role !== "owner") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  if (!BASE || !TOKEN) return NextResponse.json({ error: "Owner API not configured" }, { status: 500 });
  try {
    const r = await fetch(`${BASE}/cockpit-v1`, {
      headers: { "X-Tasks-Token": TOKEN },
      cache: "no-store",
    });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: `Cockpit unreachable: ${e}` }, { status: 502 });
  }
}
