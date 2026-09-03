import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";

// job 2682 — BOARD NOW Home-tab panel. Same owner-only token-gated proxy
// pattern as every other /api/owner/* route in this app (clone of job
// 2642's cory-today route). Backend (cockpit/owner_dash.py:
// owner_board_now) is a read-only live view of the Orchestrator board +
// the local handoff store — this route adds no logic of its own beyond
// forwarding the kit name (?kit=nrc; any kit registered in the backend's
// BOARD_NOW_KITS gets the same panel with zero frontend changes).
const BASE = process.env.COCKPIT_OWNER_API_BASE;
const TOKEN = process.env.COCKPIT_TASKS_TOKEN;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (profile.role !== "owner") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  if (!BASE || !TOKEN) return NextResponse.json({ error: "Owner API not configured" }, { status: 500 });
  const kit = req.nextUrl.searchParams.get("kit") || "nrc";
  try {
    const r = await fetch(`${BASE}/board-now?kit=${encodeURIComponent(kit)}`, {
      headers: { "X-Tasks-Token": TOKEN },
      cache: "no-store",
    });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: `Cockpit unreachable: ${e}` }, { status: 502 });
  }
}
