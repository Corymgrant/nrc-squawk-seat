import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, SQUAWK_IMAGES_BUCKET, SIGNED_URL_TTL } from "@/lib/supabase/admin";
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
    .select("id,reporter,text,reply,created_at,image_path")
    .order("created_at", { ascending: false })
    .limit(20);

  const admin = createAdminClient();
  const withUrls = await Promise.all(
    (tickets ?? []).map(async (t) => {
      let image_url: string | null = null;
      if (t.image_path) {
        const { data } = await admin.storage.from(SQUAWK_IMAGES_BUCKET).createSignedUrl(t.image_path, SIGNED_URL_TTL);
        image_url = data?.signedUrl ?? null;
      }
      return { ...t, image_url };
    }),
  );

  return (
    <div style={{ maxWidth: 440, margin: "0 auto", padding: "16px 14px 40px" }}>
      <Link href="/dashboard" style={{ color: "#2FD79B", fontSize: 13, textDecoration: "none" }}>
        ← back to console
      </Link>
      <div style={{ marginTop: 14 }}>
        <SquawkConsole role={profile.role} fullName={profile.full_name ?? profile.email ?? "Cory"} tickets={withUrls} />
      </div>
    </div>
  );
}
