import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";

// job 2415 — AUTORESPONDER GRADUATION panel. Same owner-only token-gated
// proxy pattern as every other /api/owner/* route in this app. Backend
// (cockpit/owner_dash.py:owner_graduation_scoreboard) is a read-only
// passthrough of job2370's nightly scorer snapshot — this route adds no
// logic of its own.
const BASE = process.env.COCKPIT_OWNER_API_BASE;
const TOKEN = process.env.COCKPIT_TASKS_TOKEN;

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (profile.role !== "owner") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  if (!BASE || !TOKEN) return NextResponse.json({ error: "Owner API not configured" }, { status: 500 });
  try {
    const r = await fetch(`${BASE}/graduation-scoreboard`, {
      headers: { "X-Tasks-Token": TOKEN },
      cache: "no-store",
    });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: `Cockpit unreachable: ${e}` }, { status: 502 });
  }
}
