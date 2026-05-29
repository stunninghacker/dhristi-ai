import { useEffect, useMemo, useRef, useState } from "react";
import type { Detection } from "../types";
import MarkerOverlay from "./MarkerOverlay";

interface Props {
  beforeSrc: string;
  afterSrc: string;
  afterLabel?: string;
  regions?: Detection[];
  selectedRegionId?: number | null;
  onSelectRegion?: (id: number | null) => void;
  preliminaryMode?: boolean;
  showLabels?: boolean;
}

export default function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  afterLabel = "AFTER T2",
  regions = [],
  selectedRegionId = null,
  onSelectRegion,
  preliminaryMode = false,
  showLabels = true,
}: Props) {
  const isValidSrc = (s: unknown) =>
    typeof s === "string" && s.startsWith("data:");
  const hasValidSources = isValidSrc(beforeSrc) && isValidSrc(afterSrc);
  const [pct, setPct] = useState(50);
  const [imageSize, setImageSize] = useState({ width: 16, height: 7 });
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasValidSources) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setImageSize({
        width: img.naturalWidth || img.width || 16,
        height: img.naturalHeight || img.height || 7,
      });
    };
    img.src = afterSrc || beforeSrc;
    return () => {
      cancelled = true;
    };
  }, [afterSrc, beforeSrc, hasValidSources]);

  const visibleRegions = useMemo(
    () => {
      if (!preliminaryMode) return regions;
      const top = regions.slice(0, 12);
      const selected = selectedRegionId === null ? null : regions.find(region => region.id === selectedRegionId) ?? null;
      if (!selected || top.some(region => region.id === selected.id)) return top;
      return [...top.slice(0, 11), selected];
    },
    [preliminaryMode, regions, selectedRegionId],
  );

  const aspectRatio = imageSize.width / Math.max(imageSize.height, 1);

  const drag = (clientX: number) => {
    if (!box.current) return;
    const rect = box.current.getBoundingClientRect();
    setPct(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPct(value => Math.max(0, value - 2));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setPct(value => Math.min(100, value + 2));
    } else if (event.key === "Home") {
      event.preventDefault();
      setPct(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setPct(100);
    }
  };

  if (!hasValidSources) {
    console.error("Slider: invalid image sources", typeof beforeSrc, typeof afterSrc);
    return <div style={{ color: "red", padding: 20 }}>Image data not ready</div>;
  }

  return (
    <div
      style={{
        width: "100%",
        background: "#07111f",
        border: "1px solid #12293d",
        borderRadius: 8,
        padding: 12,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <ControlButton onClick={() => setPct(0)}>Show Before</ControlButton>
        <ControlButton onClick={() => setPct(50)}>50 / 50</ControlButton>
        <ControlButton onClick={() => setPct(100)}>Show After</ControlButton>
      </div>

      <div
        ref={box}
        role="slider"
        tabIndex={0}
        aria-label="Before and after image comparison slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("[data-marker-control='true']")) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) drag(event.clientX);
        }}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "100%",
          aspectRatio,
          maxHeight: 620,
          overflow: "hidden",
          cursor: "col-resize",
          background: "#020617",
          userSelect: "none",
          touchAction: "none",
          borderRadius: 8,
          border: "1px solid #1c3554",
          boxShadow: "0 18px 42px rgba(0,0,0,0.20)",
          outline: "none",
        }}
      >
        <img
          src={beforeSrc}
          alt="Before T1"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: `inset(0 ${100 - pct}% 0 0)`,
            pointerEvents: "auto",
          }}
        >
          <img
            src={afterSrc}
            alt={afterLabel}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              pointerEvents: "none",
            }}
          />
          {visibleRegions.length > 0 && (
            <MarkerOverlay
              regions={visibleRegions}
              selectedRegionId={selectedRegionId}
              onSelectRegion={onSelectRegion ?? (() => undefined)}
              imageWidth={imageSize.width}
              imageHeight={imageSize.height}
              preliminaryMode={preliminaryMode}
              showLabels={showLabels}
            />
          )}
        </div>

        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${pct}%`,
            width: 1,
            background: "rgba(125,211,252,0.82)",
            transform: "translateX(-50%)",
            pointerEvents: "none",
            boxShadow: "0 0 10px rgba(56,189,248,0.65)",
            zIndex: 5,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "#07111f",
              border: "2px solid #7dd3fc",
              transform: "translate(-50%, -50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.45)",
            }}
          >
            <span style={{ color: "#7dd3fc", fontSize: 13, fontWeight: 900 }}>{"<>"}</span>
          </div>
        </div>

        <ImageTag align="left">BEFORE T1</ImageTag>
        <ImageTag align="right">{afterLabel}</ImageTag>
      </div>
    </div>
  );
}

function ControlButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "1px solid #1e4870",
        background: "#0d1f35",
        color: "#9fdfff",
        borderRadius: 7,
        padding: "7px 11px",
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer",
        lineHeight: 1.1,
      }}
    >
      {children}
    </button>
  );
}

function ImageTag({ align, children }: { align: "left" | "right"; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        [align]: 10,
        background: "rgba(2,6,23,0.76)",
        color: "#dff9ff",
        padding: "3px 8px",
        fontSize: 13,
        borderRadius: 5,
        fontFamily: "monospace",
        pointerEvents: "none",
      }}
    >
      {children}
    </div>
  );
}
