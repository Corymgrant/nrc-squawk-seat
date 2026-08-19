import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";

// job 1941: Build Queue / Task Ledger (ADR-479 gap-panel #9) + tap-to-ack
// target (a) "Cockpit board row status (done/ack)". Proxies owner_dash.py's
// new /api/owner/task-ledger (GET) and /api/owner/task-ledger/{id} (PATCH) —
// same underlying data.get_task_ledger / data.update_task the Orchestrator's
// own /api/tasks uses, just token-gated for this Vercel-side bridge.
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
    const r = await fetch(`${BASE}/task-ledger`, {
      headers: { "X-Tasks-Token": TOKEN! },
      cache: "no-store",
    });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: `Cockpit unreachable: ${e}` }, { status: 502 });
  }
}

// Ack write-back: PATCH straight to the source of truth (the Orchestrator
// ledger row), never optimistic-UI-only. Caller re-fetches GET after this
// resolves to render the confirmed state (source-of-truth re-read).
export async function PATCH(req: Request) {
  const g = await gate();
  if (!g.ok) return g.err;
  let body: { id?: number; status?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "Task id required" }, { status: 422 });
  const { id, ...fields } = body;
  try {
    const r = await fetch(`${BASE}/task-ledger/${id}`, {
      method: "PATCH",
      headers: { "X-Tasks-Token": TOKEN!, "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: `Cockpit unreachable: ${e}` }, { status: 502 });
  }
}
