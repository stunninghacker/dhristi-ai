import { useState, useMemo, type CSSProperties } from "react";
import type { AnalysisResult, AnalystDecision, Detection, Priority } from "../types";
import { isPreliminaryReview } from "../utils/preliminary";

interface Props {
  result: AnalysisResult;
  detections: Detection[];
  selected: number | null;
  setSelected: (id: number | null) => void;
  onAnalystWorkflowChange: () => void;
}

const DEFENCE_LABELS = ["VEHICLE/EQUIPMENT", "INFRASTRUCTURE", "FORTIFICATION", "MOVEMENT CORRIDOR", "TERRAIN CHANGE", "UNKNOWN OBJECT"] as const;

const BADGE_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  "VEHICLE/EQUIPMENT":  { bg: "rgba(245,158,11,0.15)", fg: "#f59e0b", border: "rgba(245,158,11,0.3)" },
  "INFRASTRUCTURE":     { bg: "rgba(56,189,248,0.15)", fg: "#38bdf8", border: "rgba(56,189,248,0.3)" },
  "FORTIFICATION":      { bg: "rgba(251,71,101,0.15)", fg: "#fb4765", border: "rgba(251,71,101,0.3)" },
  "MOVEMENT CORRIDOR":  { bg: "rgba(249,115,22,0.15)", fg: "#f97316", border: "rgba(249,115,22,0.3)" },
  "TERRAIN CHANGE":     { bg: "rgba(52,211,153,0.15)", fg: "#34d399", border: "rgba(52,211,153,0.3)" },
  "UNKNOWN OBJECT":     { bg: "rgba(148,163,184,0.15)", fg: "#94a3b8", border: "rgba(148,163,184,0.3)" },
};

function classifyDetection(d: Detection): string {
  const { areaPx, compactness } = d;
  if (compactness < 0.25) return "MOVEMENT CORRIDOR";
  if (areaPx > 1200 && compactness < 0.45) return "TERRAIN CHANGE";
  if (areaPx < 400 && compactness > 0.55) return "VEHICLE/EQUIPMENT";
  if (areaPx > 800) return "INFRASTRUCTURE";
  if (compactness > 0.75) return "FORTIFICATION";
  return "UNKNOWN OBJECT";
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
  const [filter, setFilter] = useState<'all' | 'high' | 'low'>('all');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [sortByConfidence, setSortByConfidence] = useState(false);

  const reviewedCount = detections.filter(d => d.reviewed).length;
  const preliminaryReview = isPreliminaryReview(result);

  const getConfidenceColor = (score: number) => {
    if (score > 70) return "#34d399"; // green
    if (score >= 50) return "#f59e0b"; // amber
    return "#fb4765"; // red
  };

  const getConfidenceText = (score: number) => {
    if (score > 70) return "High";
    if (score >= 50) return "Medium";
    return "Low";
  };

  const processedDetections = useMemo(() => {
    let list = [...detections];

    if (filter === 'high') {
      list = list.filter(d => d.score > 70);
    } else if (filter === 'low') {
      list = list.filter(d => d.score <= 70);
    }
    if (typeFilter && typeFilter !== "all") {
      list = list.filter(d => classifyDetection(d) === typeFilter);
    }

    if (sortByConfidence) {
      list.sort((a, b) => b.score - a.score);
    }

    return list;
  }, [detections, filter, sortByConfidence, typeFilter]);

  if (detections.length === 0) {
    return (
      <div style={{
        background: "#08111d",
        border: "1px solid #18283e",
        borderRadius: 8,
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
      {/* Controls: Count, Filters and Sort */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
        flexWrap: "wrap",
        gap: 12,
        padding: "4px 2px",
      }}>
        {/* Count */}
        <div style={{ color: "#7db7e5", fontSize: 13.5, fontWeight: 600 }}>
          Showing {processedDetections.length} of {detections.length} {preliminaryReview ? "regions" : "detections"}
        </div>
        
        {/* Actions bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", background: "#060a12", border: "1px solid #1c3554", borderRadius: 8, padding: 2 }}>
            {(["all", "high", "low"] as const).map((f) => {
              const label = f === "all" ? "All" : f === "high" ? "High Conf" : "Low Conf";
              const active = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "none",
                    background: active ? "#38bdf8" : "transparent",
                    color: active ? "#06090f" : "#8ba3bd",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", background: "#060a12", border: "1px solid #1c3554", borderRadius: 8, padding: 2 }}>
            {(["all", ...DEFENCE_LABELS] as const).map((t) => {
              const active = (typeFilter ?? "all") === t;
              const colors = t !== "all" ? BADGE_COLORS[t] : null;
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t === "all" ? null : t)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: "none",
                    background: active ? (colors ? colors.fg : "#2dd4bf") : "transparent",
                    color: active ? "#06090f" : colors ? colors.fg : "#8ba3bd",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t === "all" ? "All Types" : t.replace("/", "/\u200B")}
                </button>
              );
            })}
          </div>

          {/* Sort by Confidence Button */}
          <button
            onClick={() => setSortByConfidence(s => !s)}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              border: sortByConfidence ? "1px solid #38bdf8" : "1px solid #1c3554",
              background: sortByConfidence ? "rgba(56, 189, 248, 0.12)" : "#0b1522",
              color: sortByConfidence ? "#38bdf8" : "#8ba3bd",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.2s ease",
              boxShadow: sortByConfidence ? "0 0 10px rgba(56, 189, 248, 0.15)" : "none",
            }}
          >
            <span>Sort by Confidence</span>
            <span style={{ fontSize: 14, fontWeight: 900 }}>{sortByConfidence ? "↓" : "—"}</span>
          </button>
        </div>
      </div>

      <div style={{
        background: "#08111d",
        border: "1px solid #18283e",
        borderRadius: 8,
        overflow: "hidden",
      }}>
        <div style={{ overflowX: "auto", maxHeight: "460px", overflowY: "auto" }}>
          {processedDetections.length === 0 ? (
            <div style={{
              padding: "48px 24px",
              textAlign: "center",
              color: "#8ba3bd",
              fontSize: 13,
            }}>
              No regions match the selected filter.
            </div>
          ) : (
            <table className="det-table" style={{ borderCollapse: "collapse", width: "100%", minWidth: 1440 }}>
              <thead>
                <tr style={headerRowStyle}>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Object</th>
                  <th style={thStyle}>Priority</th>
                  <th style={thStyle}>Score</th>
                  <th style={thStyle}>Confidence</th>
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
                {processedDetections.map(d => {
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
                      <td style={{ color: "#b6c6d9", maxWidth: 240, fontSize: 13 }}>{d.type}</td>
                      <td>
                        {(() => {
                          const label = classifyDetection(d);
                          const colors = BADGE_COLORS[label];
                          return (
                            <span style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              background: colors.bg,
                              color: colors.fg,
                              border: `1px solid ${colors.border}`,
                            }}>
                              {label}
                            </span>
                          );
                        })()}
                      </td>
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
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, color: getConfidenceColor(d.score) }}>
                          <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: getConfidenceColor(d.score),
                            boxShadow: `0 0 6px ${getConfidenceColor(d.score)}`,
                          }} />
                          {d.score}% ({getConfidenceText(d.score)})
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#9fb5cc" }}>
                          <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: preliminaryReview ? "#7dd3fc" : reviewReliability === "HIGH" ? "#34d399" : reviewReliability === "MEDIUM" ? "#f59e0b" : "#fb4765",
                          }} />
                          {reviewReliability}
                        </div>
                      </td>
                      <td style={{ color: preliminaryReview ? "#7dd3fc" : "#8ba3bd", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {preliminaryReview ? "Not confirmed change" : "Analyst review"}
                      </td>
                      <td style={{ color: "#9fb5cc" }}>{d.areaPx.toLocaleString()}</td>
                      <td style={{ color: "#9fb5cc" }}>{d.compactness.toFixed(3)}</td>
                      <td style={{ color: "#9fb5cc" }}>{d.meanDelta.toFixed(2)}</td>
                      <td style={{ color: "#4fc3ff", fontFamily: "monospace", fontSize: 13, whiteSpace: "nowrap" }}>
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
                            fontSize: 13,
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
                            fontSize: 13,
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
          )}
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
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {expanded ? "Hide" : "Show"} {preliminaryReview ? "Top Review Region Details" : "Top Detection Details"}
        </button>
        {expanded && (
          <div style={{
            background: "#08111d",
            border: "1px solid #18283e",
            borderRadius: 8,
            padding: 14,
            marginTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}>
            {processedDetections.slice(0, 5).map(d => (
              <div key={d.id} style={{
                padding: "10px 12px",
                background: "#060e1a",
                borderRadius: 8,
                border: "1px solid #0f1e30",
              }}>
                <span style={{ color: "#38bdf8", fontWeight: 700, marginRight: 8 }}>{preliminaryReview ? "Review region" : "Zone"} {d.id}</span>
                <span style={{ color: "#9fb5cc", fontSize: 13 }}>{d.type}</span>
                <span style={{
                  marginLeft: 8,
                  fontSize: 13,
                  fontWeight: 800,
                  color: preliminaryReview ? "#7dd3fc" : d.priority === "CRITICAL" ? "#fb4765" : d.priority === "HIGH" ? "#f59e0b" : d.priority === "MEDIUM" ? "#facc15" : d.priority === "REVIEW" ? "#7dd3fc" : d.priority === "PRELIMINARY" ? "#cbd5e1" : "#34d399",
                }}>
                  {preliminaryReview ? "REVIEW" : d.priority}
                </span>
                <span style={{ color: "#4a6a85", fontSize: 13, marginLeft: 8 }}>
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
