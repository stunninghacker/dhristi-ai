import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";
import type { AnalysisResult } from "../types";
import { isPreliminaryReview } from "../utils/preliminary";

const VIEWS = [
  { key: "baseImage", label: "T1 — Baseline" },
  { key: "recentImage", label: "T2 — Registered Recent" },
  { key: "annotatedImage", label: "Annotated Review Zones" },
  { key: "heatmapImage", label: "Change-Priority Heatmap" },
] as const;



interface Props {
  result: AnalysisResult;
  showHeatmap: boolean;
}

export default function ImageViewer({ result, showHeatmap }: Props) {
  const [idx, setIdx] = useState(0);
  const isPreliminary = isPreliminaryReview(result);

  const heatmapLabel = isPreliminary ? "Global Difference Surface" : "Change-Priority Heatmap";
  const available = VIEWS
    .filter(v => showHeatmap || v.key !== "heatmapImage")
    .map(v => v.key === "heatmapImage"
      ? { ...v, label: heatmapLabel }
      : v.key === "annotatedImage" && isPreliminary
        ? { ...v, label: "Annotated Review Regions" }
        : v);
  const safeIdx = Math.min(idx, available.length - 1);
  const current = available[safeIdx];
  const imgUrl = result.images[current.key as keyof typeof result.images] as string;

  const prev = () => setIdx(i => (i - 1 + available.length) % available.length);
  const next = () => setIdx(i => (i + 1) % available.length);

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Three-image overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { url: result.images.baseImage, label: "T1 — Baseline" },
          { url: result.images.recentImage, label: "T2 — Registered Recent" },
          { url: result.images.annotatedImage, label: isPreliminary ? "Annotated Review Regions" : "Annotated Review Zones" },
        ].map(({ url, label }) => (
          <div key={label} style={{
            background: "#050912",
            border: "1px solid #18283e",
            borderRadius: 12,
            padding: 10,
            textAlign: "center",
          }}>
            <img
              src={url}
              alt={label}
              style={{
                display: "block",
                maxHeight: 200,
                maxWidth: "100%",
                margin: "0 auto",
                borderRadius: 8,
                objectFit: "contain",
                background: "#020617",
              }}
            />
            <div style={{ color: "#8ba3bd", fontSize: 11, marginTop: 6 }}>{label}</div>
            {isPreliminary && label.includes("Review Regions") && (
              <div style={{ color: "#7dd3fc", fontSize: 10, marginTop: 4 }}>
                Showing top review regions. Full list available in exports.
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Full viewer */}
      <div style={{
        background: "#070c15",
        border: "1px solid #18283e",
        borderRadius: 14,
        padding: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div style={{ color: "#7db7e5", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 700 }}>
            Image Viewer
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {available.map((v, i) => (
              <button
                key={v.key}
                onClick={() => setIdx(i)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  border: i === safeIdx ? "1px solid #38bdf8" : "1px solid #1c3554",
                  background: i === safeIdx ? "rgba(56,189,248,0.12)" : "#0b1522",
                  color: i === safeIdx ? "#38bdf8" : "#8ba3bd",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <NavBtn onClick={prev} label="Previous"><ChevronLeftIcon size={14} color="#9fb5cc" /></NavBtn>
            <NavBtn onClick={next} label="Next"><ChevronRightIcon size={14} color="#9fb5cc" /></NavBtn>
          </div>
        </div>

        <div style={{ background: "#050912", borderRadius: 10, padding: 12, textAlign: "center", minHeight: 300 }}>
          <img
            src={imgUrl}
            alt={current.label}
            className="viewer-img"
          />
          <div style={{ color: "#8ba3bd", fontSize: 12, marginTop: 8 }}>{current.label}</div>
          {isPreliminary && (current.key === "annotatedImage" || current.key === "heatmapImage") && (
            <div style={{ color: "#7dd3fc", fontSize: 11, marginTop: 4 }}>
              Showing top review regions. Full list available in exports.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NavBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        padding: "6px 12px",
        borderRadius: 8,
        border: "1px solid #1c3554",
        background: "#0b1522",
        color: "#9fb5cc",
        cursor: "pointer",
        display: "flex", alignItems: "center", gap: 4,
        fontSize: 12, fontWeight: 600,
        transition: "border-color 0.2s",
      }}
    >
      {children} {label}
    </button>
  );
}
