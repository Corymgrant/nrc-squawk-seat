"use client";

// job 2269 — THE RELATIONS LAYER. Cory 2026-08-27: "the board is a LIST OF
// ISOLATED RECORDS ... an agent cannot traverse what is not modeled, cannot
// compute blast radius, and cannot verify its own work." This is the Graph
// mode on THE COCKPIT surface (same tab bar as Home/tiles, per his own
// framing: "absorbs the tile-dashboard scope ... rather than competing with
// it" — Home stays tiles, this is the relations catalog+graph, both modes
// on one surface). Schema stolen from Backstage's entity+relations model
// (his explicit ruling: steal the SCHEMA, never the Node-monorepo app).
//
// Data: GET /api/owner/relations-graph -> conductor/relations_graph.py's
// latest snapshot (nodes, edges, orphan_ids, stats), regenerated from live
// systems every 30min. This component does zero graph computation of its
// own beyond client-side neighbor/blast-radius lookups over the already-
// typed edge list — the SAME data Board Warden/the Duty Officer can read
// via relations_graph.py's blast_radius() CLI.
//
// HEALTH LAW (rendered, not invented here): green = a real assertion/
// invariant passed; amber = degraded/not-watched; red = failed/dead/
// inactive; red-stale = the backing artifact outlived its own refresh
// cadence, overriding whatever status it cached. ORPHAN LAW: a node with
// zero edges renders with a dashed ring + "ORPHANED" chip — never as a
// normal node — because that visibility is the entire point of this build.

import { useCallback, useEffect, useMemo, useState } from "react";

const C = {
  card: "#14181A",
  text: "#EDEFEE",
  muted: "#7E8682",
  emerald: "#2FD79B",
  amber: "#F5B544",
  red: "#F2655A",
  line: "#222829",
  sky: "#5AA9E6",
};

const HEALTH_COLOR: Record<string, string> = {
  green: C.emerald,
  amber: C.amber,
  red: C.red,
  "red-stale": C.red,
  neutral: C.muted,
};

const HEALTH_LABEL: Record<string, string> = {
  green: "passing",
  amber: "degraded",
  red: "failed",
  "red-stale": "STALE (was cached passing — artifact outlived its refresh cadence)",
  neutral: "n/a",
};

const TYPE_LABEL: Record<string, string> = {
  row: "Board rows",
  capability: "Capabilities",
  invariant: "Invariants",
  workflow: "n8n workflows",
  objective: "Objectives A–H",
  person: "People",
  resource: "Resources",
  // job2321 PART ONE additions — credential/estate-inventory node types.
  credential: "Credentials",
  webhook: "Webhooks",
  cron: "Cron jobs",
  campaign: "Meta campaigns",
  ad: "Meta ads",
  creative: "Meta creatives",
  pipelinestage: "Close pipeline stages",
  form: "Instant Forms",
  question: "Questions",
  endpage: "End pages",
  academy: "Academy",
  persona: "Personas",
  judge: "Judges",
  portal: "Portals",
  reviewstate: "Review states",
};

const TYPE_ORDER = [
  "row", "capability", "invariant", "workflow", "objective", "person", "resource",
  "credential", "webhook", "cron", "campaign", "ad", "creative", "pipelinestage",
  "form", "question", "endpage", "academy", "persona", "judge", "portal", "reviewstate",
];

type GraphNode = {
  id: string;
  type: string;
  label: string;
  status: string | null;
  health: string;
  freshness_iso: string | null;
  freshness_note: string | null;
  detail: Record<string, unknown> | null;
  orphan: boolean;
};

type GraphEdge = { from: string; to: string; type: string; evidence: string | null };

type Graph = {
  generated_at: string;
  doctrine: string;
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
  orphan_ids: string[];
  stats: {
    node_count: number;
    edge_count: number;
    by_type: Record<string, number>;
    orphan_count: number;
    edge_cap: number;
    edge_cap_hit: boolean;
  };
  diff_vs_previous: { nodes_added: number; nodes_removed: number; edges_prev: number; edges_now: number };
};

function ageLabel(iso: string | null): string {
  if (!iso) return "no timestamp";
  const ms = Date.now() - new Date(iso).getTime();
  if (!isFinite(ms)) return "unknown";
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 48) return `${h.toFixed(1)}h ago`;
  return `${(h / 24).toFixed(1)}d ago`;
}

function HealthChip({ health, orphan }: { health: string; orphan?: boolean }) {
  const color = HEALTH_COLOR[health] ?? C.muted;
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: 999,
          background: health === "red-stale" ? "transparent" : color,
          border: health === "red-stale" ? `2px dashed ${color}` : "none",
          flexShrink: 0,
        }}
        title={HEALTH_LABEL[health] ?? health}
      />
      {orphan && (
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: 0.3,
            color: C.amber,
            border: `1px dashed ${C.amber}`,
            borderRadius: 5,
            padding: "1px 5px",
          }}
        >
          ORPHANED
        </span>
      )}
    </span>
  );
}

function buildAdj(edges: GraphEdge[]) {
  const fwd: Record<string, GraphEdge[]> = {};
  const rev: Record<string, GraphEdge[]> = {};
  for (const e of edges) {
    (fwd[e.from] ??= []).push(e);
    (rev[e.to] ??= []).push(e);
  }
  return { fwd, rev };
}

function blastRadius(nodeId: string, rev: Record<string, GraphEdge[]>, maxDepth = 6): string[] {
  const seen = new Set([nodeId]);
  const order: string[] = [];
  let frontier = [nodeId];
  let depth = 0;
  while (frontier.length && depth < maxDepth) {
    const next: string[] = [];
    for (const cur of frontier) {
      for (const e of rev[cur] ?? []) {
        if (!seen.has(e.from)) {
          seen.add(e.from);
          order.push(e.from);
          next.push(e.from);
        }
      }
    }
    frontier = next;
    depth += 1;
  }
  return order;
}

/* ── ego-graph SVG: selected node centered, depends_on to the left,
   unlocks/feeds to the right, breaks_if (reverse) above. Deterministic
   layout, no force-directed library needed for a bounded neighbor set. ── */
function EgoGraph({
  graph,
  selectedId,
  onSelect,
}: {
  graph: Graph;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { fwd, rev } = useMemo(() => buildAdj(graph.edges), [graph.edges]);
  if (!selectedId || !graph.nodes[selectedId]) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: C.muted,
          fontSize: 13,
          textAlign: "center",
          padding: 24,
        }}
      >
        Select a node from the catalog to see what it depends on, what it unlocks, and what breaks if it fails.
      </div>
    );
  }
  const center = graph.nodes[selectedId];
  const outEdges = (fwd[selectedId] ?? []).filter((e) => e.type !== "owned_by");
  const inEdges = rev[selectedId] ?? [];
  const out = Array.from(new Map(outEdges.map((e) => [e.to, e])).values()).slice(0, 10);
  const bin = Array.from(new Map(inEdges.map((e) => [e.from, e])).values()).slice(0, 10);

  const W = 720;
  const H = Math.max(340, Math.max(out.length, bin.length) * 46 + 60);
  const cx = W / 2;
  const cy = H / 2;

  const outPositions = out.map((e, i) => ({
    edge: e,
    node: graph.nodes[e.to],
    x: W - 130,
    y: 50 + i * 46,
  }));
  const inPositions = bin.map((e, i) => ({
    edge: e,
    node: graph.nodes[e.from],
    x: 130,
    y: 50 + i * 46,
  }));

  const dot = (n: GraphNode | undefined, x: number, y: number, r: number, id: string) => {
    if (!n) return null;
    const color = HEALTH_COLOR[n.health] ?? C.muted;
    const dashed = n.health === "red-stale" || n.orphan;
    return (
      <g key={id} onClick={() => onSelect(id)} style={{ cursor: "pointer" }}>
        <circle
          cx={x}
          cy={y}
          r={r}
          fill={dashed ? "transparent" : color}
          stroke={color}
          strokeWidth={dashed ? 2 : 1}
          strokeDasharray={dashed ? "3,3" : undefined}
          opacity={id === selectedId ? 1 : 0.92}
        />
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
      {/* edges: depends_on/watches/feeds/unlocks OUT (right), breaks_if IN (left) */}
      {inPositions.map(({ node, x, y }, i) =>
        node ? <line key={`il${i}`} x1={x + 14} y1={y} x2={cx - 16} y2={cy} stroke={C.line} strokeWidth={1.5} /> : null
      )}
      {outPositions.map(({ node, x, y }, i) =>
        node ? <line key={`ol${i}`} x1={cx + 16} y1={cy} x2={x - 14} y2={y} stroke={C.line} strokeWidth={1.5} /> : null
      )}

      {/* center node */}
      {dot(center, cx, cy, 16, selectedId)}
      <text x={cx} y={cy + 32} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.text}>
        {center.label.length > 34 ? center.label.slice(0, 34) + "…" : center.label}
      </text>

      {/* breaks-if (reverse deps), left */}
      {inPositions.length > 0 && (
        <text x={130} y={26} textAnchor="middle" fontSize={10} fill={C.amber} fontWeight={700}>
          BREAKS IF THIS FAILS
        </text>
      )}
      {inPositions.map(({ node, x, y }, i) => (
        <g key={`in${i}`}>
          {dot(node, x, y, 8, node?.id ?? `in${i}`)}
          <text x={x} y={y + 20} textAnchor="middle" fontSize={9.5} fill={C.muted}>
            {(node?.label ?? "").slice(0, 20)}
          </text>
        </g>
      ))}

      {/* outbound relations, right */}
      {outPositions.length > 0 && (
        <text x={W - 130} y={26} textAnchor="middle" fontSize={10} fill={C.sky} fontWeight={700}>
          DEPENDS ON / UNLOCKS / FEEDS
        </text>
      )}
      {outPositions.map(({ node, x, y }, i) => (
        <g key={`out${i}`}>
          {dot(node, x, y, 8, node?.id ?? `out${i}`)}
          <text x={x} y={y + 20} textAnchor="middle" fontSize={9.5} fill={C.muted}>
            {(node?.label ?? "").slice(0, 20)}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function RelationsGraphPanel() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [orphansOnly, setOrphansOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/owner/relations-graph", { cache: "no-store" });
      const j = await r.json();
      if (j?.error) {
        setErr(j.error);
        return;
      }
      setErr(null);
      setGraph(j as Graph);
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const { fwd, rev } = useMemo(() => (graph ? buildAdj(graph.edges) : { fwd: {}, rev: {} }), [graph]);

  const filteredIds = useMemo(() => {
    if (!graph) return [];
    const q = query.trim().toLowerCase();
    return Object.values(graph.nodes)
      .filter((n) => (typeFilter ? n.type === typeFilter : true))
      .filter((n) => (orphansOnly ? n.orphan : true))
      .filter((n) => (q ? n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q) : true))
      .sort((a, b) => (a.orphan === b.orphan ? 0 : a.orphan ? -1 : 1) || (HEALTH_RANK[a.health] - HEALTH_RANK[b.health]))
      .map((n) => n.id)
      .slice(0, 400);
  }, [graph, typeFilter, orphansOnly, query]);

  const selected = selectedId && graph ? graph.nodes[selectedId] : null;
  const selectedOut = selectedId ? (fwd[selectedId] ?? []) : [];
  const selectedIn = selectedId ? (rev[selectedId] ?? []) : [];
  const radius = selectedId && graph ? blastRadius(selectedId, rev) : [];

  if (err) {
    return (
      <div style={{ background: C.card, borderRadius: 18, padding: 16, border: `1px solid ${C.red}`, color: C.red }}>
        Couldn&apos;t reach the relations graph: {err}
      </div>
    );
  }
  if (!graph) {
    return (
      <div style={{ background: C.card, borderRadius: 18, padding: 16, border: `1px solid ${C.line}`, color: C.muted }}>
        Loading relations graph…
      </div>
    );
  }

  const genAgeH = (Date.now() - new Date(graph.generated_at).getTime()) / 3_600_000;
  const graphStale = genAgeH > 2;

  return (
    <div className="cx-graph-shell">
      {/* header strip */}
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div className="cx-title" style={{ color: C.text }}>Relations Graph</div>
          <div className="cx-def">
            {graph.stats.node_count} nodes · {graph.stats.edge_count} edges (cap {graph.stats.edge_cap}) ·{" "}
            <span style={{ color: C.amber, fontWeight: 700 }}>{graph.stats.orphan_count} orphaned</span> — a node
            with zero edges, generated fresh from live systems every 30min, never hand-authored.
          </div>
        </div>
        <div style={{ ...(graphStale ? { color: C.red } : { color: C.muted }), fontSize: 11.5, fontWeight: 600 }}>
          {graphStale ? "STALE — " : "as of "}
          {ageLabel(graph.generated_at)}
        </div>
      </div>

      {/* left: type filter + catalog */}
      <div className="cx-col-primary" style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.line}`, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes…"
          style={{
            background: "#0B0D0C",
            border: `1px solid ${C.line}`,
            borderRadius: 10,
            padding: "8px 10px",
            color: C.text,
            fontSize: 13,
          }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button
            className="cx-btn"
            onClick={() => setTypeFilter(null)}
            style={chipStyle(typeFilter === null)}
          >
            All
          </button>
          {TYPE_ORDER.map((t) => (
            <button
              key={t}
              className="cx-btn"
              onClick={() => setTypeFilter(t)}
              style={chipStyle(typeFilter === t)}
            >
              {TYPE_LABEL[t]} ({graph.stats.by_type[t] ?? 0})
            </button>
          ))}
          <button
            className="cx-btn"
            onClick={() => setOrphansOnly((o) => !o)}
            style={{
              ...chipStyle(orphansOnly),
              borderColor: orphansOnly ? C.amber : C.line,
              color: orphansOnly ? C.amber : C.muted,
              background: orphansOnly ? "#2a2110" : C.card,
            }}
          >
            Orphans only ({graph.stats.orphan_count})
          </button>
        </div>
        <div style={{ overflowY: "auto", maxHeight: 520, display: "flex", flexDirection: "column", gap: 2 }}>
          {filteredIds.map((id) => {
            const n = graph.nodes[id];
            return (
              <button
                key={id}
                className="cx-card--tap"
                onClick={() => setSelectedId(id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  textAlign: "left",
                  padding: "7px 8px",
                  borderRadius: 10,
                  border: `1px solid ${id === selectedId ? C.emerald : "transparent"}`,
                  background: id === selectedId ? "#12251d" : "transparent",
                  color: C.text,
                  fontSize: 12.5,
                }}
              >
                <HealthChip health={n.health} orphan={n.orphan} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.label}</span>
              </button>
            );
          })}
          {filteredIds.length === 0 && <div style={{ color: C.muted, fontSize: 12, padding: 8 }}>No nodes match.</div>}
        </div>
      </div>

      {/* middle: ego graph */}
      <div style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.line}`, padding: 8, minHeight: 380 }}>
        <EgoGraph graph={graph} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {/* right: detail pane */}
      <div style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.line}`, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {!selected ? (
          <div style={{ color: C.muted, fontSize: 13 }}>Select a node to see its relations.</div>
        ) : (
          <>
            <div>
              <div className="cx-eyebrow" style={{ color: C.muted }}>{TYPE_LABEL[selected.type] ?? selected.type}</div>
              <div className="cx-headline" style={{ color: C.text, marginTop: 2 }}>{selected.label}</div>
              <div style={{ marginTop: 6 }}>
                <HealthChip health={selected.health} orphan={selected.orphan} />
                <span style={{ marginLeft: 8, fontSize: 11.5, color: HEALTH_COLOR[selected.health] }}>
                  {HEALTH_LABEL[selected.health]}
                </span>
              </div>
              <div className="cx-def" style={{ marginTop: 4 }}>
                {selected.freshness_note ?? "no freshness note"} · {ageLabel(selected.freshness_iso)}
              </div>
            </div>

            <EdgeGroup title="Depends on" items={selectedOut.filter((e) => e.type === "depends_on")} graph={graph} dir="to" onSelect={setSelectedId} />
            <EdgeGroup title="Unlocks" items={selectedOut.filter((e) => e.type === "unlocks")} graph={graph} dir="to" onSelect={setSelectedId} />
            <EdgeGroup title="Watches / Feeds" items={selectedOut.filter((e) => e.type === "watches" || e.type === "feeds")} graph={graph} dir="to" onSelect={setSelectedId} />
            <EdgeGroup title="Owned by" items={selectedOut.filter((e) => e.type === "owned_by")} graph={graph} dir="to" onSelect={setSelectedId} />
            <EdgeGroup title="Breaks if this fails (direct)" items={selectedIn} graph={graph} dir="from" onSelect={setSelectedId} accent={C.amber} />

            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
              <div className="cx-caption" style={{ color: C.muted }}>
                Full blast radius (transitive, depth ≤6)
              </div>
              <div className="cx-number" style={{ fontSize: 22, color: radius.length ? C.amber : C.muted, marginTop: 2 }}>
                {radius.length}
              </div>
              <div className="cx-def">
                {radius.length === 0
                  ? "Nothing on this graph currently depends on, watches, or unlocks-from this node — it is a leaf for blast-radius purposes."
                  : `${radius.length} downstream node${radius.length === 1 ? "" : "s"} would need review if this fails. Same traversal relations_graph.py exposes via blast-radius CLI for Board Warden / the Duty Officer.`}
              </div>
            </div>
          </>
        )}
      </div>

      {graph.stats.edge_cap_hit && (
        <div style={{ gridColumn: "1 / -1", color: C.amber, fontSize: 11.5 }}>
          Edge cap reached this run — some real relationships may be missing from this snapshot until the cap is raised.
        </div>
      )}
    </div>
  );
}

const HEALTH_RANK: Record<string, number> = { "red-stale": 0, red: 1, amber: 2, green: 3, neutral: 4 };

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "5px 9px",
    borderRadius: 999,
    border: `1px solid ${active ? C.emerald : C.line}`,
    background: active ? "#12251d" : "transparent",
    color: active ? C.emerald : C.muted,
    fontSize: 11.5,
    fontWeight: 600,
  };
}

function EdgeGroup({
  title,
  items,
  graph,
  dir,
  onSelect,
  accent,
}: {
  title: string;
  items: GraphEdge[];
  graph: Graph;
  dir: "to" | "from";
  onSelect: (id: string) => void;
  accent?: string;
}) {
  if (items.length === 0) return null;
  const seen = new Set<string>();
  const uniq = items.filter((e) => {
    const id = dir === "to" ? e.to : e.from;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return (
    <div>
      <div className="cx-caption" style={{ color: accent ?? C.muted, fontWeight: 700 }}>
        {title} ({uniq.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
        {uniq.slice(0, 12).map((e, i) => {
          const id = dir === "to" ? e.to : e.from;
          const n = graph.nodes[id];
          if (!n) return null;
          return (
            <button
              key={i}
              className="cx-card--tap"
              onClick={() => onSelect(id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                textAlign: "left",
                padding: "4px 6px",
                borderRadius: 8,
                border: "1px solid transparent",
                background: "transparent",
                color: C.text,
                fontSize: 12,
              }}
            >
              <HealthChip health={n.health} orphan={n.orphan} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
