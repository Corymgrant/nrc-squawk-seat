import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";

// Owner-only THE CORE (card #161): answer a parked job's unlock-question. The
// cockpit endpoint writes @@ANSWER {"a": <answer>} onto the board row (preserving
// the existing @@QUEUE directive), flips status -> queued and clears waiting_on;
// the Tick then passes the answer to the Conductor so it resumes WITH it.
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
  const id = body.id ?? body.job_id;
  if (id === undefined || id === null || String(id) === "" || !String(body.answer || "").trim()) {
    return NextResponse.json({ error: "id and answer required" }, { status: 422 });
  }
  try {
    const r = await fetch(`${BASE}/orchestrator/answer`, {
      method: "POST",
      headers: { "X-Tasks-Token": TOKEN!, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: `Cockpit unreachable: ${e}` }, { status: 502 });
  }
}
