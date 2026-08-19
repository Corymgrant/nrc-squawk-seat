import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, signImagePaths } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/profile";
import { SquawkConsole } from "@/components/squawk-console";
import { SystemsStatus } from "@/components/systems-status";
import { ApprenticePanel } from "@/components/apprentice-panel";
import { LogoutButton } from "@/components/logout-button";
import { ContextStrip } from "@/components/context-strip";
import { activeKit } from "@/lib/kit-config";


export default async function SeatPage() {
  const profile = await getSessionProfile();
  // Defence-in-depth: the owner's home is /dashboard — bounce there if they
  // land on the rep seat (e.g. an old bookmark).
  if (profile?.role === "owner") redirect("/dashboard");
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Account not provisioned</h1>
        <p className="text-muted-foreground max-w-md">
          This email isn&apos;t set up for the Cockpit seat yet. Ask Cory to provision your
          account, then sign in again.
        </p>
        <LogoutButton />
      </div>
    );
  }

  // Both queries run on the user's session client, so RLS scopes them to the
  // rep's OWN tickets/notes at the database level — never widen these to admin.
  const supabase = await createClient();
  // job 1966: WHAT'S CHANGING THIS WEEK strip — chat-Claude-writable only (the app
  // never inserts here); an empty/all-expired table means NO rows come back, and
  // ContextStrip renders nothing in that case.
  const nowIso = new Date().toISOString();
  const { data: contextRows } = await supabase
    .from("cockpit_michael_context")
    .select("id,message,created_at")
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(2);

  const { data: tickets } = await supabase
    .from("squawk_tickets")
    .select("id,reporter,text,reply,status,created_at,status_updated_at,image_path,engine_nonce")
    .order("created_at", { ascending: false })
    .limit(50);

  const ticketIds = (tickets ?? []).map((t) => t.id);
  const { data: notes } = ticketIds.length
    ? await supabase
        .from("squawk_ticket_notes")
        .select("id,ticket_id,author_role,author_name,text,created_at")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  // Sign URLs for any attached images (private bucket → short-lived signed URLs).
  // N screenshots per ticket → sign every path; keep image_url = first for back-compat.
  const admin = createAdminClient();
  const withUrls = await Promise.all(
    (tickets ?? []).map(async (t) => {
      const image_urls = await signImagePaths(admin, t.image_path);
      return {
        ...t,
        image_url: image_urls[0] ?? null,
        image_urls,
        notes: (notes ?? []).filter((n) => n.ticket_id === t.id),
      };
    }),
  );

  // Apprentice window (job 663): read-only draft-vs-sent pairs + progress, org-scoped by RLS.
  // Zero workload by construction; framing is apprentice-only (MICHAEL-SEAT-DOCTRINE).
  const { data: scored } = await supabase
    .from("shadow_draft_ledger")
    .select("id,category,inbound_excerpt,shadow_draft,sent_reply,similarity,drafted_at")
    .not("similarity", "is", null)
    .order("drafted_at", { ascending: false })
    .limit(300);
  const { count: pendingCount } = await supabase
    .from("shadow_draft_ledger")
    .select("id", { count: "exact", head: true })
    .is("similarity", null);

  const kit = activeKit;
  const firstName = (profile.full_name ?? profile.email ?? "there").split(/[\s@]/)[0];

  return (
    <div className="flex flex-col gap-6">
      <ContextStrip rows={contextRows ?? []} />

      {/* ── Cockpit hero band — the reveal greeting ─────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-6 sm:p-7">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full blur-3xl"
          style={{ background: `${kit.accent}22` }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {kit.product} · {kit.seatLabel}
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
              Hi {firstName} <span className="align-middle">👋</span>
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              Your cockpit for the day — flag anything that&apos;s off, teach the assistant how
              you&apos;d handle it, and see how it&apos;s coming along. You&apos;re always the one
              who talks to customers.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Sales Rep
          </span>
        </div>
      </section>

      <SystemsStatus />
      <SquawkConsole role={profile.role} tickets={withUrls} />
      {scored && scored.length > 0 && (
        <ApprenticePanel
          pairs={scored}
          pendingCount={pendingCount ?? 0}
          totalStudied={scored.length}
        />
      )}
    </div>
  );
}
