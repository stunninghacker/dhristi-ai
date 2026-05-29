import { useMemo, useState } from "react";
import type { AnalysisResult } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

interface Props {
  result: AnalysisResult;
}

export default function TimelineAnalysis({ result }: Props) {
  const [open, setOpen] = useState(true);
  const timeline = useMemo(() => buildTimeline(result), [result]);

  return (
    <section style={{ border: "1px solid #18283e", borderRadius: 8, overflow: "hidden", marginTop: 24, marginBottom: 24 }}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        style={{
          width: "100%",
          border: "none",
          background: "#0a1420",
          color: "#e8f2ff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "12px 14px",
          fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 800 }}>Timeline Analysis</span>
        <span style={{ color: "#4a6a85", fontSize: 13 }}>{open ? "Collapse" : "Expand"}</span>
      </button>

      {open && (
        <div style={{ background: "#07111f", borderTop: "1px solid #18283e", padding: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <TimelineEndpoint
              tag="T1"
              title="Baseline"
              value={timeline.baselineLabel}
              muted={!timeline.hasBaselineDate}
            />

            <div style={{ flex: "1 1 260px", minWidth: 220 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 7 }}>
                <span style={{ color: "#7db7e5", fontSize: 13, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Change Intensity
                </span>
                <span style={{ color: timeline.intensityColor, fontSize: 13, fontWeight: 900 }}>
                  {timeline.intensityLabel}
                </span>
              </div>

              <div
                aria-label={`Change intensity ${timeline.intensityPercent} percent`}
                style={{
                  position: "relative",
                  height: 12,
                  borderRadius: 999,
                  background: "#040b14",
                  border: "1px solid #16314c",
                  overflow: "hidden",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02)",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(90deg, rgba(56,189,248,0.20) 0%, rgba(52,211,153,0.32) 42%, rgba(245,158,11,0.52) 72%, rgba(239,68,68,0.72) 100%)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: `${timeline.intensityPercent}%`,
                    minWidth: timeline.intensityPercent > 0 ? 8 : 0,
                    background: "linear-gradient(90deg, #38bdf8 0%, #34d399 42%, #f59e0b 72%, #ef4444 100%)",
                    boxShadow: timeline.intensityPercent > 0 ? "0 0 16px rgba(56,189,248,0.35)" : "none",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "50%",
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: "#7dd3fc",
                    border: "1px solid #dff9ff",
                    transform: "translate(1px, -50%)",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "50%",
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: "#fb7185",
                    border: "1px solid #ffe4e6",
                    transform: "translate(-1px, -50%)",
                  }}
                />
              </div>
            </div>

            <TimelineEndpoint
              tag="T2"
              title="Recent"
              value={timeline.recentLabel}
              muted={!timeline.hasRecentDate}
              align="right"
            />
          </div>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "center",
              color: timeline.daysBetween === null ? "#6f86a1" : "#cfe8ff",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {timeline.daysBetween === null
              ? "Upload EXIF-tagged images to enable temporal analysis"
              : `${timeline.daysBetween.toLocaleString()} ${timeline.daysBetween === 1 ? "day" : "days"} between T1 and T2`}
          </div>
        </div>
      )}
    </section>
  );
}

function TimelineEndpoint({
  tag,
  title,
  value,
  muted,
  align = "left",
}: {
  tag: string;
  title: string;
  value: string;
  muted: boolean;
  align?: "left" | "right";
}) {
  return (
    <div
      style={{
        flex: "0 0 148px",
        minWidth: 132,
        textAlign: align,
        background: muted ? "rgba(8,26,46,0.54)" : "#081a2e",
        border: muted ? "1px dashed #24445f" : "1px solid #17456d",
        borderRadius: 8,
        padding: "9px 10px",
      }}
    >
      <div style={{ color: "#3ab5ff", fontSize: 13, fontWeight: 900, letterSpacing: "0.14em" }}>{tag}</div>
      <div style={{ color: "#d9e9fb", fontSize: 13, fontWeight: 900, marginTop: 3 }}>{title}</div>
      <div style={{ color: muted ? "#8ba3bd" : "#e8f2ff", fontSize: 13, fontWeight: 800, marginTop: 5 }}>{value}</div>
    </div>
  );
}

function buildTimeline(result: AnalysisResult) {
  const baselineDate = parseDate(result.timeline.baselineDate);
  const recentDate = parseDate(result.timeline.recentDate);
  const intensityPercent = clamp(Math.round(Math.max(result.maxScore, result.changedAreaPct * 8, result.maskChangedPct * 5)), 0, 100);

  return {
    baselineLabel: baselineDate ? formatTimelineDate(baselineDate) : "Baseline",
    recentLabel: recentDate ? formatTimelineDate(recentDate) : "Recent",
    hasBaselineDate: Boolean(baselineDate),
    hasRecentDate: Boolean(recentDate),
    daysBetween: baselineDate && recentDate
      ? Math.abs(Math.round((dateOnlyUtc(recentDate) - dateOnlyUtc(baselineDate)) / DAY_MS))
      : null,
    intensityPercent,
    intensityLabel: intensityLabel(intensityPercent),
    intensityColor: intensityColor(intensityPercent),
  };
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTimelineDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function dateOnlyUtc(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function intensityLabel(value: number): string {
  if (value >= 72) return "High";
  if (value >= 42) return "Moderate";
  if (value > 0) return "Low";
  return "None";
}

function intensityColor(value: number): string {
  if (value >= 72) return "#fb7185";
  if (value >= 42) return "#facc15";
  if (value > 0) return "#7dd3fc";
  return "#6f86a1";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
