import { useEffect, useMemo, useState } from "react";
import type { AnalysisResult } from "../types";
import { isPreliminaryReview } from "../utils/preliminary";
import AnalystPanel from "./AnalystPanel";
import MarkerOverlay from "./MarkerOverlay";

interface Props {
  result: AnalysisResult;
  selected: number | null;
  onSelectRegion: (id: number | null) => void;
  onAnalystWorkflowChange: () => void;
}

export default function HeatmapSection({
  result,
  selected,
  onSelectRegion,
  onAnalystWorkflowChange,
}: Props) {
  const [imageSize, setImageSize] = useState({ width: 760, height: 460 });
  const preliminaryMode = isPreliminaryReview(result);
  const visibleRegions = useMemo(
    () => {
      if (!preliminaryMode) return result.detections;
      const top = result.detections.slice(0, result.visibleRegionLimit);
      const selectedRegion = selected === null ? null : result.detections.find(region => region.id === selected) ?? null;
      if (!selectedRegion || top.some(region => region.id === selectedRegion.id)) return top;
      return [...top.slice(0, Math.max(0, result.visibleRegionLimit - 1)), selectedRegion];
    },
    [preliminaryMode, result.detections, result.visibleRegionLimit, selected],
  );
  const selectedDetection = result.detections.find(d => d.id === selected) ?? null;

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setImageSize({
        width: img.naturalWidth || img.width || 760,
        height: img.naturalHeight || img.height || 460,
      });
    };
    img.src = result.images.heatmapImage;
    return () => {
      cancelled = true;
    };
  }, [result.images.heatmapImage]);

  return (
    <div className="surface-layout global-difference-surface">
      <div
        className="surface-image-card"
        style={{
          minWidth: 0,
          position: "relative",
          background: preliminaryMode ? "#05090b" : "#050912",
          border: preliminaryMode ? "1px solid rgba(125,211,252,0.22)" : "1px solid #12293d",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: preliminaryMode ? "inset 0 0 0 1px rgba(125,211,252,0.04)" : "none",
        }}
      >
        <div
          className="surface-image-frame"
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "100%",
            aspectRatio: imageSize.width / Math.max(imageSize.height, 1),
            maxHeight: 680,
            overflow: "hidden",
            isolation: "isolate",
            background: preliminaryMode ? "#05080a" : "#020617",
          }}
        >
          {preliminaryMode && (
            <img
              src={result.images.recentImage}
              alt=""
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
                pointerEvents: "none",
                userSelect: "none",
              }}
            />
          )}
          <img
            src={result.images.heatmapImage}
            alt={preliminaryMode ? "Global difference surface" : "Change-priority heatmap"}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
              opacity: preliminaryMode ? 0.42 : 1,
              pointerEvents: "none",
              userSelect: "none",
            }}
          />
          <MarkerOverlay
            regions={visibleRegions}
            selectedRegionId={selected}
            onSelectRegion={onSelectRegion}
            imageWidth={imageSize.width}
            imageHeight={imageSize.height}
            preliminaryMode={preliminaryMode}
            showLabels
            tooltipRegionLabel={region => preliminaryMode ? `Review region #${region.id}` : `Region #${region.id}`}
          />
        </div>

        {preliminaryMode && (
          <div
            className="surface-legend"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
              padding: "10px 12px",
              borderTop: "1px solid rgba(125,211,252,0.16)",
              background: "rgba(7,17,31,0.96)",
            }}
          >
            <LegendItem color="#f0d276" label="Higher visual difference" />
            <LegendItem color="#d6b169" label="Moderate visual difference" />
            <LegendItem color="#67d5e1" label="Lower visual difference" />
          </div>
        )}
      </div>

      <AnalystPanel
        result={result}
        detection={selectedDetection}
        onAnalystWorkflowChange={onAnalystWorkflowChange}
      />
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
      <span style={{ width: 18, height: 5, borderRadius: 999, background: color, flexShrink: 0 }} />
      <span style={{ color: "#9fb5cc", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
    </div>
  );
}
