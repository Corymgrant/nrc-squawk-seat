import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";
import {
  createAdminClient,
  SQUAWK_IMAGES_BUCKET,
  SIGNED_URL_TTL,
} from "@/lib/supabase/admin";

// Owner-only squawk-ticket management for the operator console. Reads the FULL
// squawk_tickets rows (no truncation — the whole point) and performs reversible
// lifecycle changes (resolve / archive / dismiss test+PROOF junk / edit). Soft-state
// only: archive + dismiss set a status, never hard-delete. Service-role client is
// used but every call is owner-gated and scoped to the owner's org_id.
export const dynamic = "force-dynamic";

const STATUSES = ["open", "resolved", "archived", "dismissed"] as const;
type Status = (typeof STATUSES)[number];

async function ownerOrErr() {
  const profile = await getSessionProfile();
  if (!profile) return { err: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  if (profile.role !== "owner") return { err: NextResponse.json({ error: "Owner only" }, { status: 403 }) };
  return { profile };
}

// GET /api/dashboard/squawks?status=open|all  — full tickets + signed image URLs.
export async function GET(req: Request) {
  const g = await ownerOrErr();
  if (g.err) return g.err;
  const profile = g.profile!;

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") || "active"; // active = open+resolved (hide archived/dismissed)

  const admin = createAdminClient();
  let q = admin
    .from("squawk_tickets")
    .select("id,reporter,text,reply,tier,lead_id,image_path,status,created_at,resolved_at,archived_at,status_updated_at")
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (statusFilter === "active") q = q.in("status", ["open", "resolved"]);
  else if (STATUSES.includes(statusFilter as Status)) q = q.eq("status", statusFilter);
  // statusFilter === "all" → no status constraint

  const { data: tickets, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const withUrls = await Promise.all(
    (tickets ?? []).map(async (t) => {
      let image_url: string | null = null;
      if (t.image_path) {
        const { data } = await admin.storage
          .from(SQUAWK_IMAGES_BUCKET)
          .createSignedUrl(t.image_path, SIGNED_URL_TTL);
        image_url = data?.signedUrl ?? null;
      }
      return { ...t, image_url };
    }),
  );

  // Counts for the panel header.
  const { data: counts } = await admin
    .from("squawk_tickets")
    .select("status")
    .eq("org_id", profile.org_id);
  const byStatus: Record<string, number> = {};
  for (const r of counts ?? []) byStatus[r.status as string] = (byStatus[r.status as string] ?? 0) + 1;

  return NextResponse.json({ ok: true, tickets: withUrls, counts: byStatus });
}

// PATCH /api/dashboard/squawks  — lifecycle + edit + bulk test-dismiss.
// body: { action, id?, text? }
//   action: resolve | reopen | archive | unarchive | dismiss | edit | dismiss_tests
export async function PATCH(req: Request) {
  const g = await ownerOrErr();
  if (g.err) return g.err;
  const profile = g.profile!;

  let body: { action?: string; id?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const action = (body.action || "").trim();
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Bulk: dismiss every OPEN ticket that looks like a test / PROOF fixture.
  if (action === "dismiss_tests") {
    const { data: open } = await admin
      .from("squawk_tickets")
      .select("id,text,reporter")
      .eq("org_id", profile.org_id)
      .eq("status", "open");
    const re = /\b(test|testing|proof|ignore|fixture|sample|dummy)\b/i;
    const ids = (open ?? []).filter((t) => re.test(t.text || "") || re.test(t.reporter || "")).map((t) => t.id);
    if (ids.length === 0) return NextResponse.json({ ok: true, dismissed: 0, ids: [] });
    const { error } = await admin
      .from("squawk_tickets")
      .update({ status: "dismissed", status_updated_at: now })
      .eq("org_id", profile.org_id)
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, dismissed: ids.length, ids });
  }

  const id = (body.id || "").trim();
  if (!id) return NextResponse.json({ error: "Ticket id required" }, { status: 422 });

  let patch: Record<string, unknown> | null = null;
  switch (action) {
    case "resolve":
      patch = { status: "resolved", resolved_at: now, status_updated_at: now };
      break;
    case "reopen":
      patch = { status: "open", resolved_at: null, archived_at: null, status_updated_at: now };
      break;
    case "archive":
      patch = { status: "archived", archived_at: now, status_updated_at: now };
      break;
    case "unarchive":
      patch = { status: "open", archived_at: null, status_updated_at: now };
      break;
    case "dismiss":
      patch = { status: "dismissed", status_updated_at: now };
      break;
    case "edit": {
      const text = (body.text || "").trim();
      if (!text) return NextResponse.json({ error: "Text required" }, { status: 422 });
      patch = { text };
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 422 });
  }

  const { data, error } = await admin
    .from("squawk_tickets")
    .update(patch)
    .eq("org_id", profile.org_id)
    .eq("id", id)
    .select("id,status,text,resolved_at,archived_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ticket: data });
}
