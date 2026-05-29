import { useEffect, useMemo, useState } from "react";
import { exportZoneCrop } from "../engine";
import type { AnalysisResult, AnalystDecision, Detection, Priority } from "../types";
import { isPreliminaryReview } from "../utils/preliminary";
import RegionPreview from "./RegionPreview";

interface Props {
  result: AnalysisResult;
  detection: Detection | null;
  onAnalystWorkflowChange: () => void;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  CRITICAL: "#fb4765",
  HIGH: "#f59e0b",
  MEDIUM: "#facc15",
  LOW: "#34d399",
  REVIEW: "#7dd3fc",
  PRELIMINARY: "#cbd5e1",
};

const MAX_NOTE_LENGTH = 500;
const ANALYST_DECISIONS: AnalystDecision[] = [
  "Pending review",
  "Confirmed change",
  "False positive",
  "Needs better image pair",
  "Escalate for review",
];

export default function AnalystPanel({ result, detection, onAnalystWorkflowChange }: Props) {
  const [note, setNote] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const storageKey = useMemo(() => {
    if (!detection) return "";
    return `drishti:analyst-note:${detection.gridRef}:${detection.id}`;
  }, [detection]);

  useEffect(() => {
    setCopyState("idle");
    if (!detection || !storageKey) {
      setNote("");
      return;
    }

    const saved = window.localStorage.getItem(storageKey);
    setNote((saved ?? detection.analystNote ?? "").slice(0, MAX_NOTE_LENGTH));
  }, [detection, storageKey]);

  const handleNoteChange = (value: string) => {
    if (!detection || !storageKey) return;
    const next = value.slice(0, MAX_NOTE_LENGTH);
    setNote(next);
    detection.analystNote = next;
    window.localStorage.setItem(storageKey, next);
    onAnalystWorkflowChange();
  };

  const copyGridRef = async () => {
    if (!detection) return;
    await navigator.clipboard.writeText(detection.gridRef);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1400);
  };

  if (!detection) {
    return (
      <aside style={panelStyle}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              width: "100%",
              background: "linear-gradient(180deg, rgba(13,31,53,0.86), rgba(5,12,23,0.92))",
              border: "1px solid rgba(125,211,252,0.20)",
              borderRadius: 8,
              padding: "22px 18px",
              textAlign: "center",
              boxShadow: "inset 0 0 0 1px rgba(125,211,252,0.03)",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                margin: "0 auto 12px",
                border: "1px solid rgba(125,211,252,0.42)",
                background: "rgba(125,211,252,0.10)",
                boxShadow: "0 0 18px rgba(56,189,248,0.12)",
              }}
            />
            <div style={{ color: "#e8f4ff", fontSize: 13, fontWeight: 800, lineHeight: 1.45, marginBottom: 7 }}>
              Region details
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: "#a8c4d8" }}>
              Select a review region on the map or a row in the log to inspect details.
            </div>
          </div>
        </div>
      </aside>
    );
  }

  const preliminaryReview = isPreliminaryReview(result);
  const displayPriority: Priority = preliminaryReview ? "REVIEW" : detection.priority;
  const color = PRIORITY_COLORS[displayPriority];
  const reliability = preliminaryReview
    ? "PRELIMINARY"
    : detection.priority === "HIGH" || detection.priority === "CRITICAL"
      ? "HIGH"
      : detection.priority === "MEDIUM"
        ? "MEDIUM"
        : "LOW";
  const handleDecisionChange = (decision: AnalystDecision) => {
    detection.analystDecision = decision;
    onAnalystWorkflowChange();
  };

  const toggleReviewed = () => {
    detection.reviewed = !detection.reviewed;
    onAnalystWorkflowChange();
  };

  const isReviewed = detection.reviewed;

  return (
    <aside style={panelStyle}>
      <div
        style={{
          background: "rgba(8,26,46,0.72)",
          border: "1px solid #102c48",
          borderRadius: 8,
          padding: "11px 12px",
          marginBottom: 12,
        }}
      >
        <div style={{ color: "#e8f4ff", fontSize: 15, fontWeight: 850, lineHeight: 1.35, marginBottom: 5 }}>
          {preliminaryReview ? `Review region #${detection.id}` : `Zone #${detection.id}`}
        </div>
        <div style={{ color: "#8ba3bd", fontSize: 13, lineHeight: 1.35 }}>
          {detection.type}
        </div>
      </div>

      <RegionPreview imageSrc={result.images.annotatedImage} region={detection} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{
          color: "#07111f",
          background: color,
          borderRadius: 999,
          padding: "4px 9px",
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: "0.08em",
        }}>
          {displayPriority}
        </span>
        <div style={{ flex: 1, height: 8, borderRadius: 999, background: "#0b1c31", overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, detection.score)}%`, height: "100%", background: color, borderRadius: 999 }} />
        </div>
        <span style={{ color: "#3ab5ff", fontSize: 13, fontWeight: 800 }}>{detection.score}</span>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 8,
        marginBottom: 16,
      }}>
        <Metric label="Area" value={detection.areaPx.toLocaleString()} />
        <Metric label="Compactness" value={detection.compactness.toFixed(3)} />
        <Metric label="Mean Delta" value={detection.meanDelta.toFixed(2)} />
        <Metric label="Grid Ref" value={detection.gridRef} mono />
        <Metric label="Confidence" value={`${result.confidence}/100`} />
        <Metric label="Reliability" value={reliability} />
        <Metric label="Assessment" value={preliminaryReview ? "Not confirmed change" : "Analyst review"} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{
          color: "#4a8aaa",
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 7,
        }}>
          Analyst Decision
        </div>
        <select
          value={detection.analystDecision}
          onChange={event => handleDecisionChange(event.target.value as AnalystDecision)}
          style={{
            width: "100%",
            minHeight: 38,
            background: "#0a1628",
            border: "1px solid #1e3a5a",
            borderRadius: 6,
            color: "#dff9ff",
            padding: "8px 10px",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        >
          {ANALYST_DECISIONS.map(decision => (
            <option key={decision} value={decision}>{decision}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
          <span style={{ color: "#4a8aaa", fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Analyst Notes
          </span>
          <span style={{ color: note.length >= MAX_NOTE_LENGTH ? "#f59e0b" : "#4a6a7a", fontSize: 13 }}>
            {note.length}/{MAX_NOTE_LENGTH}
          </span>
        </div>
        <textarea
          value={note}
          onChange={event => handleNoteChange(event.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="Add your observations..."
          style={{
            width: "100%",
            minHeight: 112,
            resize: "vertical",
            background: "#0a1628",
            border: "1px solid #1e3a5a",
            borderRadius: "6px",
            color: "#c8dce8",
            padding: "10px",
            outline: "none",
            fontSize: 13,
            lineHeight: 1.5,
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
        {note.trim() && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#8ff5bf", fontSize: 13, marginTop: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
            Note saved
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 7 }}>
        <ActionButton
          label="Export this zone"
          onClick={() => exportZoneCrop(result.images.annotatedImage, detection, note, result.timestampUtc)}
        />
        <ActionButton label={copyState === "copied" ? "Copied" : "Copy grid ref"} onClick={copyGridRef} />
        <ActionButton
          label={isReviewed ? "Reviewed" : "Mark reviewed"}
          onClick={toggleReviewed}
          active={isReviewed}
        />
      </div>
    </aside>
  );
}

const panelStyle = {
  position: "relative" as const,
  zIndex: 0,
  width: "100%",
  minWidth: 0,
  background: "linear-gradient(180deg, #07111f 0%, #050b14 100%)",
  border: "1px solid #1e3a5a",
  borderRadius: "8px",
  padding: "16px",
  minHeight: 0,
  height: "auto",
  alignSelf: "start",
  display: "flex",
  flexDirection: "column" as const,
  boxSizing: "border-box" as const,
  overflow: "hidden",
};

function Metric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ background: "#081a2e", border: "1px solid #102c48", borderRadius: 8, padding: "8px 9px", minWidth: 0 }}>
      <div style={{ color: "#4a8aaa", fontSize: 13, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        color: "#3ab5ff",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: mono ? "monospace" : "inherit",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {value}
      </div>
    </div>
  );
}

function ActionButton({ label, onClick, active = false }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active ? "1px solid #34d399" : "1px solid #1e4870",
        background: active ? "rgba(52,211,153,0.12)" : "#0d1f35",
        color: active ? "#bbf7d0" : "#3ab5ff",
        borderRadius: "6px",
        padding: "9px 12px",
        minHeight: 38,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 800,
        lineHeight: 1.2,
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}
