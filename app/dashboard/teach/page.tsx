import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, signImagePaths } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/profile";
import { SquawkConsole } from "@/components/squawk-console";

// Owner-reachable surface for the EXISTING Teach-the-Assistant correction window +
// image drag/drop/paste (the SquawkConsole component). Not a rebuild — the same live
// pieces (POST /api/correction → Qwen → Hindsight flywheel; POST /api/squawk → engine),
// reachable from the operator console via a link. Owner-gated like /dashboard.
export const dynamic = "force-dynamic";

export default async function TeachPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/auth/login?next=/dashboard/teach");
  if (profile.role !== "owner") redirect("/protected");

  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("squawk_tickets")
    .select("id,reporter,text,reply,status,created_at,status_updated_at,image_path")
    .order("created_at", { ascending: false })
    .limit(20);

  const admin = createAdminClient();
  const withUrls = await Promise.all(
    (tickets ?? []).map(async (t) => {
      const image_urls = await signImagePaths(admin, t.image_path);
      return { ...t, image_url: image_urls[0] ?? null, image_urls, notes: [] };
    }),
  );

  return (
    <div style={{ maxWidth: 440, margin: "0 auto", padding: "16px 14px 40px" }}>
      <Link href="/dashboard" style={{ color: "#2FD79B", fontSize: 13, textDecoration: "none" }}>
        ← back to console
      </Link>
      <div style={{ marginTop: 14 }}>
        <SquawkConsole role={profile.role} tickets={withUrls} />
      </div>
    </div>
  );
}
