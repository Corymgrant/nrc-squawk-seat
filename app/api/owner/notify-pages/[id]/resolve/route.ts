import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";

// job 2134 P0 ntfy return path — resolve loop: proxies owner_dash.py's
// POST /api/owner/notify-pages/{id}/resolve, which writes the same
// resolved/resolved_by/resolved_at/resolution_note columns the
// cockpit_resolve_page MCP tool writes, on the same notify_pages_mirror
// table (W0MnTro1brYSMXQX) the dashboard's Needs-Cory card reads via
// cockpit_v1.notify_pages(). Dashboard tap and chat-seat resolve land on
// one source. Mirrors the existing /api/dashboard/notes PATCH ack pattern.
const BASE = process.env.COCKPIT_OWNER_API_BASE;
const TOKEN = process.env.COCKPIT_TASKS_TOKEN;

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (profile.role !== "owner") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  if (!BASE || !TOKEN) return NextResponse.json({ error: "Owner API not configured" }, { status: 500 });
  let note = "";
  try {
    const body = await req.json();
    note = String(body?.note || "");
  } catch {
    /* note is optional */
  }
  try {
    const r = await fetch(`${BASE}/notify-pages/${id}/resolve`, {
      method: "POST",
      headers: { "X-Tasks-Token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: `Cockpit unreachable: ${e}` }, { status: 502 });
  }
}
