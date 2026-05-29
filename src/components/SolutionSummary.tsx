import type { ProfileKey } from "../types";

interface SolutionSummaryProps {
  profile: ProfileKey;
  setProfile: (profile: ProfileKey) => void;
  preliminaryReview?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function SolutionSummary(_props: SolutionSummaryProps) {
  return (
    <div style={{ maxWidth: 900 }}>

      {/* ─── Hero ─── */}
      <div style={{
        background: "linear-gradient(135deg, #0c1f33 0%, #0d2942 50%, #0c1f33 100%)",
        border: "1px solid #1e4870", borderRadius: 10,
        padding: "32px 28px", marginBottom: 24, textAlign: "center",
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#e8f2ff", marginBottom: 8, letterSpacing: "-0.02em" }}>
          Drishti AI — Browser-Native Satellite Change Detection
        </div>
        <div style={{ color: "#6b8099", fontSize: 14, fontWeight: 600 }}>
          No server. No ML dependencies. Runs entirely offline.
        </div>
      </div>

      {/* ─── 3 Feature Cards ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        <FeatureCard
          icon="🔀"
          title="Dual Pipeline"
          desc="SSIM-routed engine that selects between global RGB difference (< 0.5) and localized multi-layer hotspot detection (≥ 0.5). Each mode is tuned for the image pair's structural similarity."
        />
        <FeatureCard
          icon="🎯"
          title="6 Analysis Profiles"
          desc="Domain-aware sensitivity tuning for Defence, Urban, Environment, Disaster, Agriculture, and Water. Each profile adjusts structural, spectral, compactness, area, and edge weights."
        />
        <FeatureCard
          icon="📦"
          title="Evidence Export"
          desc="CSV detection log, annotated PNG map, structured JSON report, and formal PDF with document ID, analyst metadata, and classification markings. All generated client-side."
        />
      </div>

      {/* ─── Use Cases ─── */}
      <SectionTitle>Use Cases</SectionTitle>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24,
      }}>
        {[
          { icon: "🛡️", label: "Defence", desc: "Monitor strategic assets, restricted zones, and infrastructure changes." },
          { icon: "🌊", label: "Disaster", desc: "Flood mapping, earthquake damage, fire scar assessment." },
          { icon: "🏙️", label: "Urban", desc: "Track construction sites, building footprints, road network growth." },
          { icon: "🌿", label: "Environment", desc: "Monitor vegetation loss, coastal erosion, land degradation." },
          { icon: "🚢", label: "Maritime", desc: "Detect shoreline movement, port activity, vessel presence changes." },
          { icon: "🌾", label: "Agriculture", desc: "Crop rotation tracking, irrigation changes, field boundary shifts." },
        ].map(({ icon, label, desc }) => (
          <div key={label} style={{
            background: "#0a1624", border: "1px solid #18283e", borderRadius: 8,
            padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start",
          }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
            <div>
              <div style={{ color: "#e8f2ff", fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{label}</div>
              <div style={{ color: "#6b8099", fontSize: 12, lineHeight: 1.55 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Tech Specs ─── */}
      <SectionTitle>Technical Specifications</SectionTitle>
      <div style={{
        background: "#0a1624", border: "1px solid #18283e", borderRadius: 8,
        overflow: "hidden", marginBottom: 24,
      }}>
        {[
          ["Engine", "Canvas 2D (browser-native pixel analysis)"],
          ["Framework", "React 19 + TypeScript"],
          ["Deployment", "Fully offline, single-file production build"],
          ["Processing", "Client-side only — zero data egress"],
          ["Export formats", "CSV, JSON, PDF, PNG (annotated map)"],
          ["Image formats", "PNG, JPG, TIFF"],
        ].map(([key, val]) => (
          <div key={key} style={{
            display: "flex", borderBottom: "1px solid #12293d", padding: "10px 16px",
          }}>
            <div style={{ width: 140, flexShrink: 0, color: "#4a6a85", fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {key}
            </div>
            <div style={{ color: "#9fb5cc", fontSize: 13 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* ─── Disclaimer ─── */}
      <div style={{
        background: "rgba(251,71,101,0.06)", border: "1px solid rgba(251,71,101,0.2)",
        borderRadius: 8, padding: "14px 18px",
      }}>
        <div style={{ color: "#fb4765", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Important Disclaimer</div>
        <div style={{ color: "#9fb5cc", fontSize: 13, lineHeight: 1.7 }}>
          This tool performs automated pixel-based change detection using purely browser-side Canvas 2D analysis.
          It does <strong>not</strong> use machine learning, GPU inference, or server-side processing. All results are
          approximate and intended as a <strong>first-pass triage aid</strong> only. Do not rely solely on this tool
          for operational, legal, safety-critical, or defense decision-making. Always verify findings with qualified
          analysts and authoritative sources.
        </div>
      </div>

    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      color: "#e8f2ff", fontSize: 16, fontWeight: 800, marginBottom: 12,
      letterSpacing: "-0.02em", paddingBottom: 8, borderBottom: "1px solid #18283e"
    }}>
      {children}
    </h2>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{
      background: "#0a1624", border: "1px solid #18283e", borderRadius: 8,
      padding: "18px 16px", display: "flex", flexDirection: "column", gap: 10,
    }}>
      <span style={{ fontSize: 28 }}>{icon}</span>
      <div style={{ color: "#e8f2ff", fontWeight: 800, fontSize: 14 }}>{title}</div>
      <div style={{ color: "#8ba3bd", fontSize: 13, lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}
