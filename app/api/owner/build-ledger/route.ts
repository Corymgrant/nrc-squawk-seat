import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";

// job 2664: Build Ledger + Estate Census panel -- derived build-lifecycle
// state per capability (live/shadow_awaiting_authorization/shadow_graduating/
// half_built/superseded/dead/unknown) + OVERLAPS redundancy panel. Rendering
// only, same proxy shape as halo-pulse (job 1941).
const BASE = process.env.COCKPIT_OWNER_API_BASE;
const TOKEN = process.env.COCKPIT_TASKS_TOKEN;

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (profile.role !== "owner") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  if (!BASE || !TOKEN) return NextResponse.json({ error: "Owner API not configured" }, { status: 500 });
  try {
    const r = await fetch(`${BASE}/build-ledger`, {
      headers: { "X-Tasks-Token": TOKEN },
      cache: "no-store",
    });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: `Cockpit unreachable: ${e}` }, { status: 502 });
  }
}
