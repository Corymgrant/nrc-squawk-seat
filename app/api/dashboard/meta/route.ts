import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";

// Owner-only, READ-ONLY Meta ads review proxy. The system-user token stays server-side
// (Vercel env META_SYSTEM_USER_TOKEN) and never reaches the browser. Pulls live campaign
// (and optionally ad) metrics Cory reviews — spend, CPL, CTR, frequency, reach, results,
// status — for the NRC ad account. No writes/edits to Meta from here (v1). Per-campaign
// notes are handled by the existing /api/dashboard/notes conduit, not this route.
export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com/v21.0";
const TOKEN = process.env.META_SYSTEM_USER_TOKEN;
const ACCOUNT = process.env.META_AD_ACCOUNT || "act_623088029316611";
const FREQ_FLAG = 2.5; // NRC's tighter frequency threshold

// Action types that count as a lead/result for CPL (most-specific first).
const LEAD_ACTIONS = ["onsite_web_lead", "lead", "offsite_conversion.fb_pixel_lead", "leadgen.other"];

function n(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

type Action = { action_type: string; value: string };
function leadsFrom(actions: Action[] | undefined): number {
  if (!actions) return 0;
  for (const t of LEAD_ACTIONS) {
    const hit = actions.find((a) => a.action_type === t);
    if (hit) return Number(hit.value) || 0;
  }
  return 0;
}

export async function GET(req: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (profile.role !== "owner") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  if (!TOKEN) return NextResponse.json({ error: "Meta token not configured", account: ACCOUNT }, { status: 500 });

  const url = new URL(req.url);
  const preset = url.searchParams.get("range") || "last_7d"; // today | last_7d | last_14d | last_30d
  const level = url.searchParams.get("level") === "ad" ? "ad" : "campaign";

  try {
    // 1) Status/objective per campaign (insights alone don't carry effective_status).
    const campRes = await fetch(
      `${GRAPH}/${ACCOUNT}/campaigns?fields=id,name,effective_status,objective,daily_budget,lifetime_budget&limit=200&access_token=${TOKEN}`,
      { cache: "no-store" },
    );
    const campJson = await campRes.json();
    if (!campRes.ok) {
      return NextResponse.json(
        { error: campJson?.error?.message || "Meta campaigns fetch failed", account: ACCOUNT },
        { status: 502 },
      );
    }
    const statusById: Record<string, { status: string; objective: string }> = {};
    for (const c of campJson.data ?? []) {
      statusById[c.id] = { status: c.effective_status, objective: c.objective };
    }

    // 2) Insights at the chosen level.
    const idField = level === "ad" ? "ad_id,ad_name,campaign_name" : "campaign_id,campaign_name";
    const insRes = await fetch(
      `${GRAPH}/${ACCOUNT}/insights?level=${level}&fields=${idField},spend,impressions,reach,frequency,clicks,ctr,cpc,actions&date_preset=${preset}&limit=200&access_token=${TOKEN}`,
      { cache: "no-store" },
    );
    const insJson = await insRes.json();
    if (!insRes.ok) {
      return NextResponse.json(
        { error: insJson?.error?.message || "Meta insights fetch failed", account: ACCOUNT },
        { status: 502 },
      );
    }

    const rows = (insJson.data ?? []).map((r: Record<string, unknown>) => {
      const cid = (r.campaign_id as string) ?? "";
      const spend = n(r.spend) ?? 0;
      const leads = leadsFrom(r.actions as Action[] | undefined);
      const cpl = leads > 0 ? spend / leads : null;
      const freq = n(r.frequency);
      return {
        id: level === "ad" ? (r.ad_id as string) : cid,
        ref: level === "ad" ? `meta-ad-${r.ad_id}` : `meta-campaign-${cid}`,
        name: (r.ad_name as string) || (r.campaign_name as string) || "(unnamed)",
        campaign_name: (r.campaign_name as string) || "",
        status: statusById[cid]?.status || (level === "campaign" ? statusById[r.id as string]?.status : "") || "—",
        objective: statusById[cid]?.objective || "",
        spend,
        impressions: n(r.impressions),
        reach: n(r.reach),
        frequency: freq,
        freq_flag: freq != null && freq > FREQ_FLAG,
        clicks: n(r.clicks),
        ctr: n(r.ctr),
        cpc: n(r.cpc),
        leads,
        cpl,
      };
    });

    // Sort: highest spend first (what Cory scans).
    rows.sort((a: { spend: number }, b: { spend: number }) => b.spend - a.spend);

    const totals = rows.reduce(
      (acc: { spend: number; leads: number }, r: { spend: number; leads: number }) => {
        acc.spend += r.spend || 0;
        acc.leads += r.leads || 0;
        return acc;
      },
      { spend: 0, leads: 0 },
    );

    return NextResponse.json({
      ok: true,
      account: ACCOUNT,
      range: preset,
      level,
      freq_flag_threshold: FREQ_FLAG,
      totals: {
        spend: totals.spend,
        leads: totals.leads,
        cpl: totals.leads > 0 ? totals.spend / totals.leads : null,
      },
      rows,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Meta unreachable: ${e instanceof Error ? e.message : e}`, account: ACCOUNT },
      { status: 502 },
    );
  }
}
