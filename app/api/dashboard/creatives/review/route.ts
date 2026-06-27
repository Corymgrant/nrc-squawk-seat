import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";

// Owner-only proxy for revision/annotation on a finished creative. Forwards the
// owner's rating / keep-kill / notes / tags to the Cockpit creative bench. The
// Cockpit token stays server-side. This is a bounded write to a learning ledger —
// no publish, no spend.
const BASE = process.env.COCKPIT_OWNER_API_BASE;
const TOKEN = process.env.COCKPIT_TASKS_TOKEN;

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const r = await fetch(`${BASE}/creatives/review`, {
      method: "POST",
      headers: { "X-Tasks-Token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
