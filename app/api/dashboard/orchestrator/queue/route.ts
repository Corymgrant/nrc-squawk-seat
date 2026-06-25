import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";

// Owner-only click-to-queue (card #161). Queues a 04-Working cook to the
// orchestrator via the audited cockpit /orchestrator/queue path (writes a
// @@QUEUE ledger row); the next Tick dispatches it to the Conductor.
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

export async function POST(req: Request) {
  const g = await gate();
  if (!g.ok) return g.err;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!String(body.cook || "").trim()) {
    return NextResponse.json({ error: "cook (path or Drive ref) required" }, { status: 422 });
  }
  try {
    const r = await fetch(`${BASE}/orchestrator/queue`, {
      method: "POST",
      headers: { "X-Tasks-Token": TOKEN!, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: `Cockpit unreachable: ${e}` }, { status: 502 });
  }
}
