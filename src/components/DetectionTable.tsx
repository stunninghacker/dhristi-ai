import { useState, type CSSProperties } from "react";
import type { AnalysisResult, AnalystDecision, Detection, Priority } from "../types";
import { isPreliminaryReview } from "../utils/preliminary";

interface Props {
  result: AnalysisResult;
  detections: Detection[];
  selected: number | null;
  setSelected: (id: number | null) => void;
  onAnalystWorkflowChange: () => void;
}

const ANALYST_DECISIONS: AnalystDecision[] = [
  "Pending review",
  "Confirmed change",
  "False positive",
  "Needs better image pair",
  "Escalate for review",
];

export default function DetectionTable({
  result,
  detections,
  selected,
  setSelected,
  onAnalystWorkflowChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const reviewedCount = detections.filter(d => d.reviewed).length;
  const preliminaryReview = isPreliminaryReview(result);

  if (detections.length === 0) {
    return (
      <div style={{
        background: "#08111d",
        border: "1px solid #18283e",
        borderRadius: 12,
        padding: "24px",
        textAlign: "center",
        color: "#8ba3bd",
        fontSize: 13,
      }}>
        {preliminaryReview
          ? "No preliminary review regions above the selected threshold."
          : "No localized change candidates above the selected threshold."}
      </div>
    );
  }

  const headerRowStyle: CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 10,
    background: "#06090f",
    borderBottom: "2px solid #1e3a5a",
  };

  const thStyle: CSSProperties = {
    background: "#06090f",
  };

  return (
    <div>
      <div style={{
        color: "#4a7a9b",
        fontSize: 12,
        fontFamily: "monospace",
        marginBottom: 8,
        letterSpacing: "0.03em",
      }}>
        {reviewedCount} of {detections.length} {preliminaryReview ? "review regions" : "detections"} reviewed
      </div>

      <div style={{
        background: "#08111d",
        border: "1px solid #18283e",
        borderRadius: 12,
        overflow: "hidden",
      }}>
        <div style={{ overflowX: "auto", maxHeight: "460px", overflowY: "auto" }}>
          <table className="det-table" style={{ borderCollapse: "collapse", width: "100%", minWidth: 1340 }}>
            <thead>
              <tr style={headerRowStyle}>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Priority</th>
                <th style={thStyle}>Score</th>
                <th style={thStyle}>Reliability</th>
                <th style={thStyle}>Assessment</th>
                <th style={thStyle}>Area (px^2)</th>
                <th style={thStyle}>Compactness</th>
                <th style={thStyle}>Mean Delta</th>
                <th style={thStyle}>Grid Ref</th>
                <th style={thStyle}>Analyst Decision</th>
                <th style={thStyle}>Analyst Note</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {detections.map(d => {
                const isSelected = selected === d.id;
                const hasSelection = selected !== null;
                const displayPriority: Priority = preliminaryReview ? "REVIEW" : d.priority;
                const reviewReliability = preliminaryReview
                  ? "PRELIMINARY"
                  : d.priority === "HIGH" || d.priority === "CRITICAL"
                    ? "HIGH"
                    : d.priority === "MEDIUM"
                      ? "MEDIUM"
                      : "LOW";
                const scoreBarColor = preliminaryReview
                  ? "#7dd3fc"
                  : d.score >= 68 ? "#fb4765" : d.score >= 42 ? "#f59e0b" : "#34d399";

                return (
                  <tr
                    key={d.id}
                    onClick={() => setSelected(d.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(d.id);
                      }
                    }}
                    tabIndex={0}
                    aria-selected={isSelected}
                    className={[
                      "detection-row",
                      isSelected ? "detection-row-selected" : "",
                      hasSelection && !isSelected ? "detection-row-dimmed" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    <td style={{ color: "#9fb5cc", fontWeight: 700 }}>#{d.id}</td>
                    <td style={{ color: "#b6c6d9", maxWidth: 240, fontSize: 11 }}>{d.type}</td>
                    <td><span className={`badge badge-${displayPriority}`}>{displayPriority}</span></td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: Math.max(4, Math.round(d.score * 0.7)),
                          height: 6,
                          borderRadius: 3,
                          background: scoreBarColor,
                        }} />
                        <span style={{ color: "#e8f2ff", fontWeight: 700 }}>{d.score}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#9fb5cc" }}>
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: preliminaryReview ? "#7dd3fc" : reviewReliability === "HIGH" ? "#34d399" : reviewReliability === "MEDIUM" ? "#f59e0b" : "#fb4765",
                        }} />
                        {reviewReliability}
                      </div>
                    </td>
                    <td style={{ color: preliminaryReview ? "#7dd3fc" : "#8ba3bd", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {preliminaryReview ? "Not confirmed change" : "Analyst review"}
                    </td>
                    <td style={{ color: "#9fb5cc" }}>{d.areaPx.toLocaleString()}</td>
                    <td style={{ color: "#9fb5cc" }}>{d.compactness.toFixed(3)}</td>
                    <td style={{ color: "#9fb5cc" }}>{d.meanDelta.toFixed(2)}</td>
                    <td style={{ color: "#4fc3ff", fontFamily: "monospace", fontSize: 11, whiteSpace: "nowrap" }}>
                      {d.gridRef}
                    </td>
                    <td>
                      <select
                        value={d.analystDecision}
                        onClick={event => event.stopPropagation()}
                        onKeyDown={event => event.stopPropagation()}
                        onChange={(event) => {
                          d.analystDecision = event.target.value as AnalystDecision;
                          onAnalystWorkflowChange();
                        }}
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid #1e3a5f",
                          borderRadius: 4,
                          color: "#dff9ff",
                          padding: "6px 8px",
                          fontSize: 11,
                          minWidth: 170,
                          outline: "none",
                          fontFamily: "inherit",
                        }}
                      >
                        {ANALYST_DECISIONS.map(decision => (
                          <option key={decision} value={decision}>{decision}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        defaultValue={d.analystNote}
                        onClick={event => event.stopPropagation()}
                        onKeyDown={event => event.stopPropagation()}
                        onChange={(event) => {
                          d.analystNote = event.target.value;
                          onAnalystWorkflowChange();
                        }}
                        placeholder="Add note..."
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid #1e3a5f",
                          borderRadius: 4,
                          color: "#e8f2ff",
                          padding: "6px 9px",
                          fontSize: 11,
                          width: "100%",
                          minWidth: 150,
                          outline: "none",
                        }}
                        onFocus={event => event.target.style.borderColor = "#38bdf8"}
                        onBlur={event => event.target.style.borderColor = "#1e3a5f"}
                      />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={d.reviewed}
                        aria-label={`${preliminaryReview ? "Review region" : "Detection"} ${d.id} reviewed`}
                        onClick={event => event.stopPropagation()}
                        onKeyDown={event => event.stopPropagation()}
                        onChange={event => {
                          d.reviewed = event.target.checked;
                          onAnalystWorkflowChange();
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: "#0a1420",
            border: "1px solid #18283e",
            borderRadius: 8,
            padding: "8px 14px",
            color: "#9fb5cc",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {expanded ? "Hide" : "Show"} {preliminaryReview ? "Top Review Region Details" : "Top Detection Details"}
        </button>
        {expanded && (
          <div style={{
            background: "#08111d",
            border: "1px solid #18283e",
            borderRadius: 10,
            padding: 14,
            marginTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}>
            {detections.slice(0, 5).map(d => (
              <div key={d.id} style={{
                padding: "10px 12px",
                background: "#060e1a",
                borderRadius: 8,
                border: "1px solid #0f1e30",
              }}>
                <span style={{ color: "#38bdf8", fontWeight: 700, marginRight: 8 }}>{preliminaryReview ? "Review region" : "Zone"} {d.id}</span>
                <span style={{ color: "#9fb5cc", fontSize: 12 }}>{d.type}</span>
                <span style={{
                  marginLeft: 8,
                  fontSize: 11,
                  fontWeight: 800,
                  color: preliminaryReview ? "#7dd3fc" : d.priority === "CRITICAL" ? "#fb4765" : d.priority === "HIGH" ? "#f59e0b" : d.priority === "MEDIUM" ? "#facc15" : d.priority === "REVIEW" ? "#7dd3fc" : d.priority === "PRELIMINARY" ? "#cbd5e1" : "#34d399",
                }}>
                  {preliminaryReview ? "REVIEW" : d.priority}
                </span>
                <span style={{ color: "#4a6a85", fontSize: 11, marginLeft: 8 }}>
                  score <code style={{ color: "#4fc3ff" }}>{d.score}</code> | area <code style={{ color: "#4fc3ff" }}>{d.areaPx}px^2</code> | center <code style={{ color: "#4fc3ff" }}>[{d.pixelCenter[0]}, {d.pixelCenter[1]}]</code>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
