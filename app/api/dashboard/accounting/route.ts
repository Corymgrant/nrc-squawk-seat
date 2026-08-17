import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";

// job 1885: Accounting tab — cancellations / dunning-ladder status. Proxies the
// existing Cockpit CS-Autonomy-Roadmap snapshot (owner_dash.py's sibling app.py,
// GET /api/owner/cs-roadmap, job 1241) rather than building a new backend — the
// dunning_saves gauge is already the real, honest source (shadow-mode-only by
// Ship Rule 1: the ladder never live-sends without 72h clean shadow + Cory's
// one word, so this never fabricates a recovered-$ figure).
export const dynamic = "force-dynamic";

const BASE = process.env.COCKPIT_OWNER_API_BASE;
const TOKEN = process.env.COCKPIT_TASKS_TOKEN;

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (profile.role !== "owner") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  if (!BASE || !TOKEN) return NextResponse.json({ error: "Owner API not configured" }, { status: 500 });

  try {
    const r = await fetch(`${BASE}/cs-roadmap`, {
      headers: { "X-Tasks-Token": TOKEN },
      cache: "no-store",
    });
    const j = await r.json();
    if (!r.ok || !j.ok) {
      return NextResponse.json({ error: j.error || "cs-roadmap fetch failed" }, { status: r.ok ? 502 : r.status });
    }
    return NextResponse.json({ ok: true, dunning: j.gauges?.dunning_saves ?? null });
  } catch (e) {
    return NextResponse.json({ error: `Cockpit unreachable: ${e instanceof Error ? e.message : e}` }, { status: 502 });
  }
}
