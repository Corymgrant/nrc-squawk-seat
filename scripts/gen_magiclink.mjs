// One-off, local-only: mint a magiclink token_hash for the owner test
// account via the Supabase service-role admin API (job2269 screenshot
// verification). Never touches/resets the real password. Prints ONLY the
// token_hash + type (no secrets) to stdout.
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);
const email = process.argv[2];
const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, token_hash: data.properties.hashed_token, type: "magiclink" }));
