import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

// Owner-only flywheel feed for "Teach the Assistant" corrections. Self-contained:
// reads squawk_corrections directly via the owner's RLS (owner-select returns the
// whole org). No dependency on the Cockpit owner API.
export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (profile.role !== "owner") {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }

  const supabase = await createClient();

  const [{ count: total }, { count: active }, recentRes, complianceRes] =
    await Promise.all([
      supabase.from("squawk_corrections").select("*", { count: "exact", head: true }),
      supabase
        .from("squawk_corrections")
        .select("*", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("squawk_corrections")
        .select(
          "id,not_say,should_say,distilled_rule,category,applies_to,status,promote_to_gate,gate_promoted_at,created_at,reporter",
        )
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("squawk_corrections")
        .select("id,not_say,should_say,distilled_rule,applies_to,created_at,reporter")
        .eq("category", "compliance")
        .is("gate_promoted_at", null)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  return NextResponse.json({
    total: total ?? 0,
    active: active ?? 0,
    compliance_pending_count: complianceRes.data?.length ?? 0,
    compliance_pending: complianceRes.data ?? [],
    recent: recentRes.data ?? [],
  });
}
