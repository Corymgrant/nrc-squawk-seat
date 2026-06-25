import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";

// Owner-only orchestrator proxy (card #161 operator seat). Live queue view:
// queued / in-progress / blocked(parked) / done jobs from the task-ledger. The
// cockpit token lives in a SERVER env var and never reaches the browser bundle.
const BASE = process.env.COCKPIT_OWNER_API_BASE;
const TOKEN = process.env.COCKPIT_TASKS_TOKEN;

export const dynamic = "force-dynamic";

async function gate() {
  const profile = await getSessionProfile();
  if (!profile) return { err: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  if (profile.role !== "owner") return { err: NextResponse.json({ error: "Owner only" }, { status: 403 }) };
  if (!BASE || !TOKEN) return { err: NextResponse.json({ error: "Owner API not configured" }, { status: 500 }) };
  return { ok: true as const };
}

export async function GET() {
  const g = await gate();
  if (!g.ok) return g.err;
  try {
    const r = await fetch(`${BASE}/orchestrator`, {
      headers: { "X-Tasks-Token": TOKEN! },
      cache: "no-store",
    });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: `Cockpit unreachable: ${e}` }, { status: 502 });
  }
}
