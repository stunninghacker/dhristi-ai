import { useMemo, useState } from "react";
import type { AnalysisResult, ValidationGroundTruth, ValidationMetricsReport } from "../types";
import { isPreliminaryReview } from "../utils/preliminary";

interface Props {
  result: AnalysisResult;
  groundTruth: ValidationGroundTruth;
  onGroundTruthChange: (next: ValidationGroundTruth) => void;
}

export function buildValidationMetrics(
  result: AnalysisResult,
  groundTruth: ValidationGroundTruth,
): ValidationMetricsReport {
  const highConfidenceRegions = result.detections.filter(detection => detection.score >= 68).length;
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
    confidenceScore: result.confidence,
    manualVerificationRequired: result.manualVerificationRequired,
    groundTruth,
    precision,
    recall,
    f1Score,
  };
}

export default function ValidationMetrics({ result, groundTruth, onGroundTruthChange }: Props) {
  const [open, setOpen] = useState(false);
  const metrics = useMemo(() => buildValidationMetrics(result, groundTruth), [groundTruth, result]);

  return (
    <section style={{ border: "1px solid #18283e", borderRadius: 10, overflow: "hidden", marginBottom: 24 }}>
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
        <span style={{ color: "#4a6a85", fontSize: 11 }}>{open ? "Collapse" : "Expand"}</span>
      </button>

      {open && (
        <div style={{ background: "#07111f", borderTop: "1px solid #18283e", padding: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <Metric label="Total review regions" value={String(metrics.totalReviewRegions)} />
            <Metric label="High confidence regions" value={String(metrics.highConfidenceRegions)} />
            <Metric label="Preliminary regions" value={String(metrics.preliminaryRegions)} />
            <Metric label="Scene comparability" value={metrics.sceneComparability} />
            <Metric label="SSIM score" value={metrics.ssimScore.toFixed(4)} />
            <Metric label="Confidence score" value={`${metrics.confidenceScore}/100`} />
            <Metric label="Manual verification required" value={metrics.manualVerificationRequired ? "Yes" : "No"} />
          </div>

          <div style={{ color: "#4a8aaa", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            <Metric label="Precision" value={formatMetric(metrics.precision)} />
            <Metric label="Recall" value={formatMetric(metrics.recall)} />
            <Metric label="F1 score" value={formatMetric(metrics.f1Score)} />
          </div>
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
      <span style={{ color: "#8ba3bd", fontSize: 11, fontWeight: 700 }}>{label}</span>
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
          fontSize: 12,
          fontFamily: "inherit",
        }}
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#081a2e", border: "1px solid #102c48", borderRadius: 8, padding: "9px 10px", minWidth: 0 }}>
      <div style={{ color: "#4a8aaa", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ color: "#3ab5ff", fontSize: 12, fontWeight: 800, overflowWrap: "anywhere" }}>{value}</div>
    </div>
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
