import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Feature 1 — "Teach the Assistant" correction window.
// Flow: auth → record pending correction → n8n webhook distills via local Qwen
// and retains to Hindsight (bank nrc, tag michael/erika-edit-lesson, all_strict-
// compatible so the drafters' recall picks it up) → record the distilled rule.
// Compliance-category corrections are flagged promote_to_gate and the n8n side
// notifies Cory for review into the deterministic anti-guarantee gate.
const WEBHOOK = process.env.CORRECTION_WEBHOOK_URL;
const CATEGORIES = ["compliance", "wording", "factual"];
const APPLIES = ["michael", "erika", "both"];

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,org_id,email,full_name,role")
    .eq("id", claims.sub)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 403 });
  }

  let body: {
    not_say?: string;
    should_say?: string;
    context?: string;
    category?: string;
    applies_to?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const not_say = (body.not_say || "").trim();
  const should_say = (body.should_say || "").trim();
  const context = (body.context || "").trim() || null;
  const category = (body.category || "").trim().toLowerCase();
  let applies_to = (body.applies_to || "michael").trim().toLowerCase();

  if (!not_say || !should_say) {
    return NextResponse.json(
      { error: "Fill in both what it should NOT say and what it SHOULD say." },
      { status: 400 },
    );
  }
  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Pick a category." }, { status: 422 });
  }
  if (!APPLIES.includes(applies_to)) applies_to = "michael";

  const reporter = profile.full_name || profile.email || "michael";
  const isCompliance = category === "compliance";

  // 1) Record the correction first (source of truth for the flywheel).
  const { data: row, error: insErr } = await supabase
    .from("squawk_corrections")
    .insert({
      org_id: profile.org_id,
      user_id: profile.id,
      reporter,
      not_say,
      should_say,
      context,
      category,
      applies_to,
      promote_to_gate: isCompliance,
      status: "pending",
    })
    .select("id")
    .single();
  if (insErr || !row) {
    return NextResponse.json(
      { error: "Could not save the correction. Please try again." },
      { status: 500 },
    );
  }

  // 2) Distill + retain via n8n (local Qwen, not metered) → Hindsight.
  let rule = `Do not say: ${not_say}. Instead say: ${should_say}.`;
  let retained = false;
  if (WEBHOOK) {
    try {
      const r = await fetch(WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          not_say,
          should_say,
          context,
          category,
          applies_to,
          reporter,
        }),
      });
      if (r.ok) {
        const j = await r.json().catch(() => ({}));
        if (j && typeof j.rule === "string" && j.rule.trim()) rule = j.rule.trim();
        retained = !!j?.ok;
      }
    } catch {
      // Webhook unreachable — the correction is still recorded as pending and can
      // be reprocessed; the rep still gets a graceful confirmation.
    }
  }

  // 3) Record the distilled rule + outcome.
  await supabase
    .from("squawk_corrections")
    .update({
      distilled_rule: rule,
      status: retained ? "active" : "error",
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  return NextResponse.json({
    ok: true,
    rule,
    category,
    applies_to,
    promoted: isCompliance,
    active: retained,
  });
}
