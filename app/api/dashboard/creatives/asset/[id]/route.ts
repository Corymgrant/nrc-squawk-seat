import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";

// Owner-only pixel proxy for creative Drive assets (job 347). The Drive files
// are not link-shared, so the browser can't load drive.google.com URLs — the
// Cockpit backend fetches bounded Drive-generated thumbnails with its own
// server-side Drive auth and this route streams them to the owner's browser.
// Only file ids present in the creative ledger are served (enforced upstream).
const BASE = process.env.COCKPIT_OWNER_API_BASE;
const TOKEN = process.env.COCKPIT_TASKS_TOKEN;

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
  const { id } = await ctx.params;
  if (!/^[\w-]{10,120}$/.test(id)) {
    return NextResponse.json({ error: "Bad asset id" }, { status: 400 });
  }
  const sz = new URL(req.url).searchParams.get("sz") === "full" ? "full" : "grid";
  try {
    const r = await fetch(`${BASE}/creatives/asset/${encodeURIComponent(id)}?sz=${sz}`, {
      headers: { "X-Tasks-Token": TOKEN },
      cache: "no-store",
    });
    if (!r.ok) {
      return NextResponse.json({ error: `upstream ${r.status}` }, { status: r.status });
    }
    return new Response(r.body, {
      status: 200,
      headers: {
        "Content-Type": r.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Cockpit unreachable: ${e instanceof Error ? e.message : e}` },
      { status: 502 },
    );
  }
}
