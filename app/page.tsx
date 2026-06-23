import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/profile";

// Single role-based router. The owner (Cory) lands on the cockpit /dashboard;
// a sales_rep (Michael) goes to their /protected seat; an unauthed visitor goes
// to login. This is the one place the post-login destination is decided.
export default async function Home() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/auth/login");
  redirect(profile.role === "owner" ? "/dashboard" : "/protected");
}
