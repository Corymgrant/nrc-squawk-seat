import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";

// Owner-only proxy: client -> this route -> Cockpit owner JSON. The Cockpit token
// lives in a SERVER env var and never reaches the browser bundle.
const BASE = process.env.COCKPIT_OWNER_API_BASE;
const TOKEN = process.env.COCKPIT_TASKS_TOKEN;

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (profile.role !== "owner") {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }
  if (!BASE || !TOKEN) {
    return NextResponse.json({ error: "Owner API not configured" }, { status: 500 });
  }
  try {
    const r = await fetch(`${BASE}/summary`, {
      headers: { "X-Tasks-Token": TOKEN },
      cache: "no-store",
    });
    const j = await r.json();
    return NextResponse.json(j, { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json(
      { error: `Cockpit unreachable: ${e instanceof Error ? e.message : e}` },
      { status: 502 },
    );
  }
}
