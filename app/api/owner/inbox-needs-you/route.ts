import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";

// job 2007: Inbox Sentinel dashboard card -- proxies owner_dash.py's
// GET /api/owner/inbox-needs-you (read-only snapshot of cory@norepaircost.com
// needs-Cory-reply items) + the per-item dismiss/snooze write-backs. All
// scan/classify logic lives in conductor/inbox_watch_cory.py; this bridge
// never touches Gmail, only the local snapshot + dismiss/snooze state.
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
    const r = await fetch(`${BASE}/inbox-needs-you`, {
      headers: { "X-Tasks-Token": TOKEN! },
      cache: "no-store",
    });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: `Cockpit unreachable: ${e}` }, { status: 502 });
  }
}

// Dismiss/snooze write-back. Body: {id, action: "dismiss"|"snooze", hours?}.
// LOCAL state only on the cockpit side (inbox_watch_panel.py) -- never
// touches Gmail. Caller re-fetches GET after this resolves.
export async function POST(req: Request) {
  const g = await gate();
  if (!g.ok) return g.err;
  let body: { id?: string; action?: "dismiss" | "snooze"; hours?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!body.id || (body.action !== "dismiss" && body.action !== "snooze")) {
    return NextResponse.json({ error: "id and action (dismiss|snooze) required" }, { status: 422 });
  }
  try {
    const r = await fetch(`${BASE}/inbox-needs-you/${encodeURIComponent(body.id)}/${body.action}`, {
      method: "POST",
      headers: { "X-Tasks-Token": TOKEN!, "Content-Type": "application/json" },
      body: JSON.stringify({ hours: body.hours ?? 24 }),
    });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: `Cockpit unreachable: ${e}` }, { status: 502 });
  }
}
