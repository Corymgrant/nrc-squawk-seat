// ============================================================================
// KIT CONFIG — multi-tenant scaffolding for the Cockpit seat (job 685)
// ----------------------------------------------------------------------------
// NRC is the FIRST kit of Cockpit; every kit is one tenant. This module is the
// single source of per-tenant identity for the seat shell: brand, product name,
// seat label, accent, monogram, tagline. Resolve the active kit from a
// client_id (env `NEXT_PUBLIC_KIT_ID`, default "nrc") so the same codebase can
// be re-skinned per tenant WITHOUT touching component code — the shell reads
// from here, nothing hard-codes "NoRepairCost".
//
// Adding a kit == adding one entry to KITS below. That is the whole contract.
// (Colors are Concept-C cockpit tokens by default; a kit may override `accent`
//  which the shell applies as the emerald-equivalent highlight.)
// ============================================================================

export type KitConfig = {
  /** stable tenant id — matches Supabase org / Close smart-view scoping key */
  clientId: string;
  /** company the seat belongs to */
  brand: string;
  /** the OS the seat runs on — almost always "Cockpit" */
  product: string;
  /** what this particular seat is called in the header */
  seatLabel: string;
  /** one-line footer / meta description tagline */
  tagline: string;
  /** header monogram glyph (single char) */
  monogram: string;
  /** highlight color (hex) — used for the live-pill glow + accent flourishes */
  accent: string;
};

const KITS: Record<string, KitConfig> = {
  nrc: {
    clientId: "nrc",
    brand: "NoRepairCost",
    product: "Cockpit",
    seatLabel: "Sales Seat",
    tagline: "NoRepairCost · powered by Cockpit",
    monogram: "C",
    accent: "#2FD79B", // Concept-C emerald
  },
  // --- add a new tenant kit here; nothing else changes -----------------------
  // acme: { clientId: "acme", brand: "Acme RV", product: "Cockpit",
  //         seatLabel: "Sales Seat", tagline: "Acme RV · powered by Cockpit",
  //         monogram: "A", accent: "#5B8DEF" },
};

const DEFAULT_KIT_ID = "nrc";

/**
 * Resolve the active kit. Works on both server and client because it only
 * reads a build-time-inlined `NEXT_PUBLIC_` var. Unknown ids fall back to the
 * default kit rather than throwing — a missing tenant should degrade to NRC,
 * never white-screen the reveal surface.
 */
export function getKitConfig(clientId?: string): KitConfig {
  const id = (clientId || process.env.NEXT_PUBLIC_KIT_ID || DEFAULT_KIT_ID).toLowerCase();
  return KITS[id] ?? KITS[DEFAULT_KIT_ID];
}

export const activeKit = getKitConfig();
