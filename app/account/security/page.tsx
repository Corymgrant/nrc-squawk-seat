import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/profile";
import { MfaEnrollment } from "@/components/mfa-enrollment";

// job 1941: any authenticated account (owner or sales_rep) may self-enroll
// MFA on their own login — this is a per-user Supabase Auth setting, not an
// owner-only control surface.
export default async function SecurityPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/auth/login");

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <MfaEnrollment />
      </div>
    </div>
  );
}
