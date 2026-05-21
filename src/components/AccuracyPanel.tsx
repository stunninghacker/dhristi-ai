import type { AnalysisResult } from "../types";

function reliabilityNote(result: AnalysisResult): string {
  if (result.reliability === "PRELIMINARY") return "Manual verification required";
  if (result.reliability === "LOW") return "Low-confidence review";
  if (result.reliability === "MODERATE") return "Controlled triage";
  if (result.reliability === "GOOD") return "Normal scoring";
  if (result.reliabilityTier === "VERIFIED") return "High-trust triage";
  if (result.reliabilityTier === "REVIEW") return "Analyst validation recommended";
  return "Indicative only";
}

export default function AccuracyPanel({ result }: { result: AnalysisResult }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 12,
        padding: "16px 0",
        borderTop: "1px solid #12293d",
        borderBottom: "1px solid #12293d",
        margin: "8px 0",
      }}
    >
      <div style={{ minWidth: 0, overflow: "hidden" }}>
        <div
          style={{
            fontSize: 10,
            color: "#4a8aaa",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Reliability
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: result.reliability === "PRELIMINARY" ? "#facc15" : "#22c55e" }}>
          {result.reliability}
        </div>
        <div style={{ fontSize: 11, color: "#4a6a7a" }}>
          {reliabilityNote(result)}
        </div>
      </div>

      <div style={{ minWidth: 0, overflow: "hidden" }}>
        <div
          style={{
            fontSize: 10,
            color: "#4a8aaa",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Scene Comparability
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: result.sceneComparability === "VERY LOW" ? "#facc15" : "#3ab5ff" }}>
          {result.sceneComparability}
        </div>
        <div style={{ fontSize: 11, color: "#4a6a7a" }}>
          SSIM {Number.isFinite(result.ssim) ? result.ssim.toFixed(4) : "0.0000"}
        </div>
      </div>

      <div style={{ minWidth: 0, overflow: "hidden", color: '#3ab5ff' }}>
        <div
          style={{
            fontSize: 10,
            color: '#4a8aaa',
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {result.sceneComparability === "VERY LOW" ? "Review Surface" : "Mask Coverage"}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#3ab5ff' }}>
          {Number.isFinite(result.maskChangedPct) ? result.maskChangedPct.toFixed(2) : "0.00"}%
        </div>
        <div style={{ fontSize: 11, color: '#4a6a7a' }}>
          {result.sceneComparability === "VERY LOW" ? "Global difference coverage" : "Changed area"} {Number.isFinite(result.changedAreaPct) ? result.changedAreaPct.toFixed(2) : "0.00"}%
        </div>
      </div>

      <div style={{ minWidth: 0, overflow: "hidden", color: '#2dd4bf' }}>
        <div
          style={{
            fontSize: 10,
            color: '#4a8aaa',
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Registration
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#2dd4bf' }}>
          {result.alignmentUsed ? "Applied" : "Skipped"}
        </div>
        <div style={{ fontSize: 11, color: '#4a6a7a' }}>
          Score {Number.isFinite(result.alignmentScore) ? result.alignmentScore : 0}/100
        </div>
      </div>
    </div>
  );
}
