import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { PROFILES } from "../profiles";
import { PROFILE_DISPLAY_CONFIGS } from "../config/profiles";
import type { ProfileKey } from "../types";

interface SolutionSummaryProps {
  profile: ProfileKey;
  setProfile: (profile: ProfileKey) => void;
  preliminaryReview?: boolean;
}

type ProfileCardMeta = {
  key: ProfileKey;
  icon: string;
};

const PROFILE_CARDS: ProfileCardMeta[] = [
  { key: "Defence / Security", icon: "🛡" },
  { key: "Urban development", icon: "🏗" },
  { key: "Environmental monitoring", icon: "🌿" },
  { key: "Disaster assessment", icon: "⚠" },
  { key: "Water-body change", icon: "💧" },
  { key: "Agriculture / vegetation", icon: "🌾" },
];

export default function SolutionSummary({ profile, setProfile, preliminaryReview = false }: SolutionSummaryProps) {
  const [hoveredProfile, setHoveredProfile] = useState<ProfileKey | null>(null);

  return (
    <div style={{ maxWidth: 900 }}>
      <SectionTitle>Project Summary</SectionTitle>
      <p style={{ color: "#9fb5cc", fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>
        The system supports structured comparison of before-and-after satellite imagery for analyst review,
        with reliability-aware outputs that remain aligned to image-pair quality and review readiness.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
        <InfoCard title="Problem" color="#fb4765" items={[
          "Manual satellite image comparison is slow and error-prone.",
          "Image pairs may differ through acquisition conditions, scene alignment, or visual quality.",
          "Analysts need a concise first-pass review surface before making a final assessment.",
        ]} />
        <InfoCard title="Solution" color="#34d399" items={[
          "The app highlights preliminary review regions for analyst verification.",
          "The comparison workflow preserves scores, confidence, and scene comparability context.",
          "Outputs are framed for review support rather than unsupported certainty.",
        ]} />
      </div>

      <SectionTitle>Reliability & Workflow</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
        <InfoCard title="Why Reliability Matters" color="#f59e0b" items={[
          "SSIM indicates how comparable the image pair is for visual review.",
          "Low SSIM means the system should not claim confirmed change.",
          "Preliminary review wording protects analyst interpretation when comparability is limited.",
        ]} />
        <InfoCard title="Workflow" color="#38bdf8" items={[
          "Upload → Register → Compare → Review → Export.",
          "Registration prepares the recent image against the baseline view.",
          "Review and export steps keep the analyst in control of downstream decisions.",
        ]} />
      </div>

      <SectionTitle>Analysis Profiles</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {PROFILE_CARDS.map(card => (
          <ProfileCard
            key={card.key}
            card={card}
            active={card.key === profile}
            expanded={card.key === hoveredProfile}
            onClick={() => setProfile(card.key)}
            onHoverChange={isHovered => setHoveredProfile(isHovered ? card.key : null)}
          />
        ))}
      </div>

      <SectionTitle>Outputs & Exports</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 24 }}>
        {[
          ["Review Surface", preliminaryReview ? "Visual difference surface for preliminary analyst review." : "Visual comparison surface for scene-level review."],
          ["Review Regions", "Spatially bounded regions that direct analyst attention to local visual differences."],
          ["Confidence", "Confidence score that communicates overall review readiness."],
          ["SSIM", "Scene comparability score for the T1 and T2 image pair."],
          ["Annotated Review Image", preliminaryReview ? "T2 image with numbered review-region badges." : "T2 image with review-region annotations."],
          ["Exports", "CSV, image, JSON, and PDF outputs for reporting and downstream review."],
        ].map(([name, desc]) => (
          <div key={name} style={{
            display: "flex", gap: 10, alignItems: "flex-start",
            background: "#0a1624", border: "1px solid #18283e",
            borderRadius: 8, padding: "10px 12px",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#38bdf8", marginTop: 5, flexShrink: 0 }} />
            <div>
              <div style={{ color: "#e8f2ff", fontSize: 13, fontWeight: 700 }}>{name}</div>
              <div style={{ color: "#7db7e5", fontSize: 13, marginTop: 2 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <SectionTitle>Limitations</SectionTitle>
      <div style={{ marginBottom: 24 }}>
        <InfoCard title="Deployment Considerations" color="#7dd3fc" items={[
          "The app is not a replacement for a human analyst.",
          "The output is not confirmed object detection.",
          "GeoTIFF support and model validation improve deployment readiness.",
        ]} />
      </div>

      <div style={{
        background: "rgba(56,189,248,0.06)",
        border: "1px solid rgba(56,189,248,0.2)",
        borderRadius: 8, padding: "14px 16px",
      }}>
        <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Analyst-Safe Language Policy</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ color: "#22c55e", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>✓ Used in this system</div>
            {["change candidate", "review zone", "low-confidence review hint", "localized change signal", "structural review zone", "land-cover change zone"].map(t => (
              <div key={t} style={{ color: "#bbf7d0", fontSize: 13, marginBottom: 3 }}>· {t}</div>
            ))}
          </div>
          <div>
            <div style={{ color: "#fb4765", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>✗ Avoided in this system</div>
            {["definitive attribution", "object identity claim", "activity conclusion", "certainty claim", "unverified final assessment"].map(t => (
              <div key={t} style={{ color: "#fecdd3", fontSize: 13, marginBottom: 3 }}>· {t}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileCard({
  card,
  active,
  expanded,
  onClick,
  onHoverChange,
}: {
  card: ProfileCardMeta;
  active: boolean;
  expanded: boolean;
  onClick: () => void;
  onHoverChange: (isHovered: boolean) => void;
}) {
  const config = PROFILES[card.key];
  const displayConfig = PROFILE_DISPLAY_CONFIGS[card.key];
  const thresholdLabel = `threshold ${config.thresholdBias > 0 ? "+" : ""}${config.thresholdBias}`;
  const areaLabel = `area ${config.minAreaScale.toFixed(2)}x`;
  const compactnessLabel = `compactness ${config.compactnessWeight.toFixed(2)}x`;

  const cardStyle: CSSProperties = {
    height: expanded ? 220 : 120,
    background: active ? "#0d2240" : expanded ? "#0d1f38" : "#0a1628",
    border: active ? "2px solid #3ab5ff" : expanded ? "1px solid #3ab5ff" : "1px solid #1e3a5a",
    borderLeft: active ? "4px solid #3ab5ff" : expanded ? "1px solid #3ab5ff" : "1px solid #1e3a5a",
    borderRadius: 8,
    boxShadow: expanded ? "0 0 20px rgba(58,181,255,0.15)" : "none",
    color: "#e8f2ff",
    cursor: "pointer",
    padding: "14px",
    width: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: expanded ? "flex-start" : "center",
    textAlign: "center",
    overflow: "hidden",
    fontFamily: "inherit",
    appearance: "none",
    transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
  };

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      style={cardStyle}
    >
      <div style={{ fontSize: expanded ? 24 : 30, lineHeight: 1, marginBottom: expanded ? 8 : 12, transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)" }}>
        {card.icon}
      </div>
      <div style={{ fontSize: expanded ? 15 : 18, fontWeight: 800, lineHeight: 1.15, marginBottom: expanded ? 6 : 0 }}>
        {displayConfig.displayName}
      </div>

      <div style={{
        opacity: expanded ? 1 : 0,
        maxHeight: expanded ? 130 : 0,
        transform: expanded ? "translateY(0)" : "translateY(6px)",
        transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        flex: expanded ? 1 : "0 0 auto",
        pointerEvents: expanded ? "auto" : "none",
      }}>
        <div style={{ color: "#2dd4bf", fontSize: 13, fontStyle: "italic", marginBottom: 8 }}>
          {config.label}
        </div>

        <div style={{ color: "#9ab0c5", fontSize: 13, lineHeight: 1.45, marginBottom: 10, textAlign: "left", padding: "0 2px" }}>
          {displayConfig.description}
        </div>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center", marginTop: "auto" }}>
          {[thresholdLabel, areaLabel, compactnessLabel].map(label => (
            <span key={label} style={{
              color: "#8ed8ff",
              background: "rgba(58,181,255,0.08)",
              border: "1px solid rgba(58,181,255,0.22)",
              borderRadius: 999,
              padding: "3px 7px",
              fontSize: 13,
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 style={{
      color: "#e8f2ff", fontSize: 16, fontWeight: 800, marginBottom: 12,
      letterSpacing: "-0.02em", paddingBottom: 8, borderBottom: "1px solid #18283e"
    }}>
      {children}
    </h2>
  );
}

function InfoCard({ title, color, items }: { title: string; color: string; items: string[] }) {
  return (
    <div style={{
      background: "#0a1624", border: `1px solid #18283e`,
      borderTop: `3px solid ${color}`,
      borderRadius: 8, padding: "14px",
    }}>
      <div style={{ color, fontWeight: 800, fontSize: 13, marginBottom: 10 }}>{title}</div>
      {items.map(item => (
        <div key={item} style={{ display: "flex", gap: 8, marginBottom: 7 }}>
          <div style={{ color, fontSize: 14, lineHeight: 1.2, flexShrink: 0 }}>·</div>
          <div style={{ color: "#9fb5cc", fontSize: 13, lineHeight: 1.5 }}>{item}</div>
        </div>
      ))}
    </div>
  );
}
