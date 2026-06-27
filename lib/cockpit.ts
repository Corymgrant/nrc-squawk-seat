// Server-side bridge to the Cockpit owner-dash backend (the Opportunity Engine
// decision surface lives there). The owner token is held server-side only — it
// never reaches the browser. Owner-role gating is enforced by every route handler
// before this is called.
import { getSessionProfile } from "@/lib/profile";

// Prefer the env the dashboard's summary proxy already uses in prod
// (COCKPIT_OWNER_API_BASE / COCKPIT_TASKS_TOKEN) so the Opportunities board reaches
// the same reachable Cockpit host without needing extra Vercel env. That var points
// at <root>/api/owner; the paths in this module already include /api/owner, so
// normalize back to the bare root to avoid a double prefix.
const RAW = process.env.COCKPIT_OWNER_API_BASE || process.env.COCKPIT_API_URL || "http://127.0.0.1:7000";
const BASE = RAW.replace(/\/api\/owner\/?$/, "");
const TOKEN = process.env.COCKPIT_TASKS_TOKEN || process.env.COCKPIT_OWNER_TOKEN || "";

export async function requireOwner() {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false as const, status: 401, error: "Not authenticated" };
  if (profile.role !== "owner") return { ok: false as const, status: 403, error: "Owner only" };
  return { ok: true as const, profile };
}

export async function cockpitFetch(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(BASE + path, {
    method: init?.method || "GET",
    headers: {
      "x-tasks-token": TOKEN,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}
