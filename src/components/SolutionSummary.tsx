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
        padding: "32px 28px", marginBottom: 20, textAlign: "center",
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#e8f2ff", marginBottom: 6, letterSpacing: "-0.02em" }}>
          DHRISTI AI — Defence Satellite Intelligence Platform
        </div>
        <div style={{ color: "#38bdf8", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em" }}>
          Submitted for iDEX Challenge #4: AI Based Satellite Image Analysis
        </div>
      </div>

      {/* ─── Problem Statement ─── */}
      <div style={{
        background: "#0a1624", border: "1px solid #18283e", borderRadius: 8,
        padding: "18px 20px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>🎯</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: "#e8f2ff", letterSpacing: "0.04em" }}>
            Problem Statement
          </span>
        </div>
        <div style={{ color: "#8ba3bd", fontSize: 14, lineHeight: 1.7, paddingLeft: 30 }}>
          Real-time AI solution for target identification, classification, spatial parameter recognition, and change detection in satellite imagery for Indian defence.
        </div>
      </div>

      {/* ─── Our Approach (4 cards) ─── */}
      <SectionTitle>Our Approach</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 24 }}>
        {APPROACH_CARDS.map(({ icon, title, desc }) => (
          <ApproachCard key={title} icon={icon} title={title} desc={desc} />
        ))}
      </div>

      {/* ─── Key Capabilities ─── */}
      <SectionTitle>Key Capabilities</SectionTitle>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24,
      }}>
        {[
          { icon: "🎯", label: "Target Detection" },
          { icon: "📍", label: "Spatial Analysis" },
          { icon: "🔄", label: "Change Detection" },
          { icon: "🛡️", label: "Air-Gap Deployable" },
          { icon: "📊", label: "Confidence Scoring" },
          { icon: "📄", label: "Intelligence Reports" },
        ].map(({ icon, label }) => (
          <CapabilityCard key={label} icon={icon} label={label} />
        ))}
      </div>

      {/* ─── Roadmap ─── */}
      <SectionTitle>Roadmap</SectionTitle>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 24,
      }}>
        {[
          { icon: "🧠", label: "YOLOv8 deep learning integration" },
          { icon: "📚", label: "Multi-temporal stack analysis" },
          { icon: "🔔", label: "Automated alert generation" },
          { icon: "🔌", label: "REST API for system integration" },
          { icon: "🛰️", label: "Real Sentinel-2 imagery pipeline" },
        ].map(({ icon, label }) => (
          <div key={label} style={{
            background: "#0a1624", border: "1px solid #18283e", borderRadius: 8,
            padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
            <span style={{ color: "#9fb5cc", fontSize: 13, fontWeight: 600 }}>{label}</span>
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

const APPROACH_CARDS = [
  {
    icon: "🖥️",
    title: "Zero-Server Architecture",
    desc: "Runs 100% in-browser. Air-gap deployable. No data leaves the analyst's device.",
  },
  {
    icon: "🔀",
    title: "Dual CV Pipeline",
    desc: "SSIM-routed: global difference mode for major events, localized hotspot detection for subtle changes.",
  },
  {
    icon: "⚖️",
    title: "Defence-Profile Scoring",
    desc: "Weighted confidence tuned for infrastructure, vehicle, and fortification detection.",
  },
  {
    icon: "📄",
    title: "Evidence Export",
    desc: "Intelligence-grade PDF reports with audit trail.",
  },
];

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

function ApproachCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{
      background: "#0a1624", border: "1px solid #18283e", borderRadius: 8,
      padding: "18px 16px", display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <span style={{ color: "#e8f2ff", fontWeight: 800, fontSize: 14 }}>{title}</span>
      </div>
      <div style={{ color: "#8ba3bd", fontSize: 13, lineHeight: 1.6, paddingLeft: 34 }}>{desc}</div>
    </div>
  );
}

function CapabilityCard({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{
      background: "#0a1624", border: "1px solid #18283e", borderRadius: 8,
      padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center",
    }}>
      <span style={{ fontSize: 28 }}>{icon}</span>
      <span style={{ color: "#9fb5cc", fontWeight: 700, fontSize: 13 }}>{label}</span>
    </div>
  );
}
