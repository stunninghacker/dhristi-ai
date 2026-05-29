import type { AnalysisResult } from "../types";
import { getReliabilityPossibleCauses } from "../utils/reliabilityCauses";
import { AlertIcon } from "./Icons";

export default function ReliabilityCauses({ result }: { result: AnalysisResult }) {
  const causes = getReliabilityPossibleCauses(result.sceneComparability);

  if (!causes.length) return null;

  return (
    <section
      style={{
        background: "linear-gradient(180deg, rgba(245,158,11,0.10), rgba(8,17,29,0.96))",
        border: "1px solid rgba(245,158,11,0.32)",
        borderRadius: 8,
        marginBottom: 18,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "14px 16px 12px",
          borderBottom: "1px solid rgba(245,158,11,0.16)",
        }}
      >
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          <AlertIcon size={15} color="#f59e0b" />
        </div>
        <div>
          <div style={{ color: "#fde68a", fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
            Reliability explanation
          </div>
          <div style={{ color: "#d3b878", fontSize: 13, lineHeight: 1.5 }}>
            Low scene comparability may reflect one or more unmeasured factors. Review these as possible causes only.
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))",
          gap: 8,
          padding: "12px 16px 14px",
        }}
      >
        {causes.map(({ status, cause }) => (
          <div
            key={cause}
            style={{
              minWidth: 0,
              background: "rgba(245,158,11,0.10)",
              border: "1px solid rgba(245,158,11,0.24)",
              borderRadius: 8,
              padding: "9px 10px",
            }}
          >
            <div
              style={{
                color: "#fbbf24",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 5,
              }}
            >
              {status}
            </div>
            <div style={{ color: "#fff0bf", fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>
              {cause}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
