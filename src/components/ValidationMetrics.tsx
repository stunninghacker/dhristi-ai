import { useMemo, useState, type ReactNode } from "react";
import type { AnalysisResult, ValidationGroundTruth, ValidationMetricsReport } from "../types";
import { countVisualFlagRegions, isPreliminaryReview } from "../utils/preliminary";

interface Props {
  result: AnalysisResult;
  groundTruth: ValidationGroundTruth;
  onGroundTruthChange: (next: ValidationGroundTruth) => void;
}

export function buildValidationMetrics(
  result: AnalysisResult,
  groundTruth: ValidationGroundTruth,
): ValidationMetricsReport {
  const highConfidenceRegions = countVisualFlagRegions(result.detections);
  const preliminaryRegions = isPreliminaryReview(result)
    ? result.totalReviewRegions
    : result.detections.filter(detection => detection.priority === "PRELIMINARY" || detection.priority === "REVIEW").length;
  const hasGroundTruth = groundTruth.truePositives !== null &&
    groundTruth.falsePositives !== null &&
    groundTruth.falseNegatives !== null;
  const precision = hasGroundTruth
    ? ratio(groundTruth.truePositives!, groundTruth.truePositives! + groundTruth.falsePositives!)
    : null;
  const recall = hasGroundTruth
    ? ratio(groundTruth.truePositives!, groundTruth.truePositives! + groundTruth.falseNegatives!)
    : null;
  const f1Score = precision === null || recall === null || precision + recall === 0
    ? null
    : roundMetric((2 * precision * recall) / (precision + recall));

  return {
    totalReviewRegions: result.totalReviewRegions,
    highConfidenceRegions,
    preliminaryRegions,
    sceneComparability: result.sceneComparability,
    ssimScore: result.ssim,
    meanAbsoluteDifference: result.meanAbsoluteDifference,
    psnr: result.psnr,
    registrationShift: result.alignmentShift,
    reviewRegionDensityPct: result.reviewRegionDensityPct,
    confidenceBand: result.reliabilityTier,
    confidenceScore: result.confidence,
    manualVerificationRequired: result.manualVerificationRequired,
    groundTruth,
    precision,
    recall,
    f1Score,
  };
}

export default function ValidationMetrics({ result, groundTruth, onGroundTruthChange }: Props) {
  const [open, setOpen] = useState(true);
  const metrics = useMemo(() => buildValidationMetrics(result, groundTruth), [groundTruth, result]);

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
        <span style={{ fontSize: 13, fontWeight: 800 }}>Validation Metrics</span>
        <span style={{ color: "#4a6a85", fontSize: 13 }}>{open ? "Collapse" : "Expand"}</span>
      </button>

      {open && (
        <div style={{ background: "#07111f", borderTop: "1px solid #18283e", padding: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <Metric label="SSIM Score" value={metrics.ssimScore.toFixed(4)} />
            <Metric label="Mean Absolute Difference" value={`${metrics.meanAbsoluteDifference.toFixed(2)} intensity units`} />
            <Metric label="PSNR" value={formatPsnr(metrics.psnr)} />
            <Metric
              label="Registration Shift"
              value={`X: ${metrics.registrationShift[0]}px, Y: ${metrics.registrationShift[1]}px`}
            />
            <Metric label="Review Region Density" value={`${metrics.reviewRegionDensityPct.toFixed(3)}%`} />
            <Metric label="Confidence Band" value={metrics.confidenceBand}>
              <ConfidenceBadge band={metrics.confidenceBand} />
            </Metric>
          </div>

          <div style={{ color: "#4a8aaa", fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
            Ground Truth
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <GroundTruthInput
              label="True positives"
              value={groundTruth.truePositives}
              onChange={value => onGroundTruthChange({ ...groundTruth, truePositives: value })}
            />
            <GroundTruthInput
              label="False positives"
              value={groundTruth.falsePositives}
              onChange={value => onGroundTruthChange({ ...groundTruth, falsePositives: value })}
            />
            <GroundTruthInput
              label="False negatives"
              value={groundTruth.falseNegatives}
              onChange={value => onGroundTruthChange({ ...groundTruth, falseNegatives: value })}
            />
          </div>
          {(() => {
          const renderMetricValue = (val: number | null) => {
            if (val === null) {
              return (
                <div className="gt-tooltip-container" style={{ color: "#8ba3bd", fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                  <span>Awaiting ground truth</span>
                  <span className="gt-tooltip-icon">i</span>
                  <span className="gt-tooltip-text">
                    Ground truth validation requires labeled reference imagery. 
                    Upload annotated masks to enable precision/recall scoring.
                  </span>
                </div>
              );
            }
            return (
              <div style={{ color: "#3ab5ff", fontSize: 15, fontWeight: 900, overflowWrap: "anywhere", lineHeight: 1.2 }}>
                {val.toFixed(4)}
              </div>
            );
          };

          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              <Metric label="Precision" value="">
                {renderMetricValue(metrics.precision)}
              </Metric>
              <Metric label="Recall" value="">
                {renderMetricValue(metrics.recall)}
              </Metric>
              <Metric label="F1 score" value="">
                {renderMetricValue(metrics.f1Score)}
              </Metric>
            </div>
          );
        })()}
      </div>
    )}
  </section>
);
}

function GroundTruthInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 5, minWidth: 0 }}>
      <span style={{ color: "#8ba3bd", fontSize: 13, fontWeight: 700 }}>{label}</span>
      <input
        type="number"
        min={0}
        step={1}
        value={value ?? ""}
        onChange={event => onChange(parseGroundTruth(event.target.value))}
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: "#0a1628",
          border: "1px solid #1e3a5a",
          borderRadius: 6,
          color: "#e8f2ff",
          padding: "8px 9px",
          minHeight: 36,
          fontSize: 13,
          fontFamily: "inherit",
        }}
      />
    </label>
  );
}

function Metric({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div style={{
      background: "linear-gradient(180deg, #0b1b2e 0%, #081321 100%)",
      border: "1px solid #18324f",
      borderRadius: 8,
      padding: "15px 16px",
      minWidth: 0,
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02)",
    }}>
      <div style={{ color: "#4a8aaa", fontSize: 13, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      {children ?? (
        <div style={{ color: "#3ab5ff", fontSize: 15, fontWeight: 900, overflowWrap: "anywhere", lineHeight: 1.2 }}>
          {value}
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ band }: { band: string }) {
  const color = band === "VERIFIED"
    ? { bg: "rgba(34,197,94,0.16)", border: "#22c55e", text: "#22c55e" }
    : band === "REVIEW"
      ? { bg: "rgba(245,158,11,0.16)", border: "#f59e0b", text: "#f59e0b" }
      : { bg: "rgba(239,68,68,0.16)", border: "#ef4444", text: "#ef4444" };

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      minHeight: 24,
      borderRadius: 5,
      border: `1px solid ${color.border}`,
      background: color.bg,
      color: color.text,
      padding: "3px 9px",
      fontSize: 13,
      fontWeight: 900,
      letterSpacing: "0.08em",
    }}>
      {band}
    </span>
  );
}

function parseGroundTruth(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return roundMetric(numerator / denominator);
}

function roundMetric(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function formatMetric(value: number | null): string {
  return value === null ? "Awaiting ground truth" : value.toFixed(4);
}

function formatPsnr(value: number | null): string {
  return value === null ? "∞ dB" : `${value.toFixed(2)} dB`;
}
