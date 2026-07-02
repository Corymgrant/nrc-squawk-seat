// Server-side proxy helper for the LIVE teach-sandbox (job 331, service :8096 on
// Cortex, exposed via Tailscale Funnel under /teach with HTTP Basic auth).
// Creds live in SERVER env vars and never reach the browser bundle — the browser
// talks only to our authed /api/teach/* routes.
const BASE = process.env.TEACH_SANDBOX_URL; // e.g. https://cortex-1.tail1c0b73.ts.net/teach
const USER = process.env.TEACH_SANDBOX_USER;
const PASS = process.env.TEACH_SANDBOX_PASS;

export function teachConfigured(): boolean {
  return !!(BASE && USER && PASS);
}

export async function teachFetch(path: string, body: unknown): Promise<Response> {
  const auth = Buffer.from(`${USER}:${PASS}`).toString("base64");
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(110_000),
  });
}
