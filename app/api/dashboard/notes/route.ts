import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";

// Owner-only notes proxy. WRITE side of the two-way loop: the app posts a note on
// any item; chat-Claude reads + answers it via the cockpit_dashboard_notes MCP tool.
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

// List notes (optionally filtered by item_ref or status) — for rendering on cards
// and the "Notes / Ask" inbox.
export async function GET(req: Request) {
  const g = await gate();
  if (!g.ok) return g.err;
  const url = new URL(req.url);
  const qs = new URLSearchParams();
  const itemRef = url.searchParams.get("item_ref");
  const status = url.searchParams.get("status");
  if (itemRef) qs.set("item_ref", itemRef);
  if (status) qs.set("status", status);
  try {
    const r = await fetch(`${BASE}/api/owner/notes?${qs.toString()}`, {
      headers: { "X-Tasks-Token": TOKEN! },
      cache: "no-store",
    });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: `Cockpit unreachable: ${e}` }, { status: 502 });
  }
}

// Create a note on an item.
export async function POST(req: Request) {
  const g = await gate();
  if (!g.ok) return g.err;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!String(body.body || "").trim()) {
    return NextResponse.json({ error: "Note body required" }, { status: 422 });
  }
  try {
    const r = await fetch(`${BASE}/api/owner/notes`, {
      method: "POST",
      headers: { "X-Tasks-Token": TOKEN!, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: `Cockpit unreachable: ${e}` }, { status: 502 });
  }
}
