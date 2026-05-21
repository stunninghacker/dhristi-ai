import type { AnalysisResult } from "../types";
import type { CSSProperties } from "react";
import { isPreliminaryReview } from "../utils/preliminary";

export default function StatusBanner({ result }: { result: AnalysisResult }) {
  const isPreliminary = isPreliminaryReview(result);
  const isLowConf = result.confidence < 65 || result.analysisPriority.includes("low confidence") || result.reliabilityGateApplied;
  const priKey = isPreliminary
    ? "PRELIMINARY"
    : result.analysisPriority.includes("HIGH")
    ? "HIGH"
    : result.analysisPriority.includes("MEDIUM")
      ? "MEDIUM"
      : "LOW";

  const borderColor =
    priKey === "HIGH" ? "#cc2222" : priKey === "MEDIUM" || priKey === "PRELIMINARY" ? "#cc8500" : "#34d399";

  const priorityStyle: CSSProperties = {
    display: "inline-flex", alignItems: "center",
    padding: "3px 14px", borderRadius: "4px",
    fontSize: "12px", fontWeight: 700,
    letterSpacing: "0.08em", marginRight: "8px",
    fontFamily: "monospace",
  };

  const isHintOnly = result.detections.every(d => d.evidence === "weak-local-signal");

  const detLine = isPreliminary
    ? result.detectionCount > 0
      ? `${result.detectionCount} visual review region(s) identified. Manual verification required.`
      : "No preliminary review regions exceeded the configured threshold. Manual verification required."
    : result.detectionCount === 0
    ? "No localized review zones exceeded the configured threshold."
    : isHintOnly
      ? `${result.detectionCount} low-confidence review hint(s) identified for analyst inspection.`
      : `${result.detectionCount} change candidate(s) detected. ${result.highPriorityFlags > 0
          ? `${result.highPriorityFlags} high-priority candidate(s) require analyst review.`
          : "No high-priority flags raised."}`;

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #0f1b2c 0%, #0a121f 100%)",
        border: `1px solid ${borderColor}`,
        borderLeft: `5px solid ${borderColor}`,
        borderRadius: 12,
        padding: "14px 18px",
        margin: "14px 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {priKey === "PRELIMINARY" ? (
          <span
            style={{
              ...priorityStyle,
              background: "#3d2800",
              color: "#ffaa33",
              border: "1px solid #aa6600",
            }}
          >
            PRELIMINARY REVIEW
          </span>
        ) : priKey === "HIGH" ? (
          <span
            style={{
              background: '#4a0a0a',
              color: '#ff5555',
              border: '1px solid #cc1111',
              padding: '4px 14px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            HIGH PRIORITY
          </span>
        ) : priKey === "MEDIUM" ? (
          <span
            style={{
              ...priorityStyle,
              background: "#3d2800",
              color: "#ffaa33",
              border: "1px solid #aa6600",
            }}
          >
            MEDIUM PRIORITY
          </span>
        ) : (
          <span
            style={{
              ...priorityStyle,
              background: "#0a2a1a",
              color: "#34d399",
              border: "1px solid #1a6644",
            }}
          >
            LOW PRIORITY
          </span>
        )}
        {isLowConf && (
          <span
            style={{
              background: "#1a2a1a",
              color: "#66cc66",
              border: "1px solid #339933",
              padding: "3px 12px",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            LOW CONFIDENCE
          </span>
        )}
        <span style={{ color: "#9fb5cc", fontSize: 12 }}>{result.timestampUtc}</span>
        <span style={{ color: "#4a6a85", fontSize: 12 }}>Profile: {result.profile}</span>
      </div>
      <div style={{ color: "#b6c6d9", fontSize: 13, marginTop: 6 }}>{detLine}</div>
    </div>
  );
}
