import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/profile";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

// OWNER-ONLY. A sales_rep (Michael) is bounced to their own seat; an unauthed
// visitor goes to login. Defence-in-depth: every /api/dashboard/* route also
// re-checks the owner role server-side.
export default async function DashboardPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/auth/login?next=/dashboard");
  if (profile.role !== "owner") redirect("/protected");
  return <DashboardClient ownerName={profile.full_name ?? profile.email ?? "Cory"} />;
}
