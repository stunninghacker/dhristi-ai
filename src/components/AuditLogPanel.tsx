import { useState } from "react";
import type { AuditLogEntry } from "../utils/auditLog";
import { copyAuditLogAsJson, clearAuditLog } from "../utils/auditLog";

interface Props {
  entries: AuditLogEntry[];
  onClear: () => void;
}

export default function AuditLogPanel({ entries, onClear }: Props) {
  const [expanded, setExpanded] = useState(false);
  const recent = entries.slice(0, 5);

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        cursor: "pointer", userSelect: "none",
        padding: "10px 12px",
        background: "#0a1624", border: "1px solid #18283e",
        borderRadius: 8, marginBottom: expanded ? 12 : 0,
      }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}>
            ▶
          </span>
          <span style={{ color: "#7dd3fc", fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Audit Log
          </span>
          <span style={{ color: "#4a6a85", fontSize: 13 }}>
            ({entries.length} run{entries.length !== 1 ? "s" : ""})
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
          {entries.length > 0 && (
            <button
              onClick={copyAuditLogAsJson}
              style={{
                padding: "4px 10px", borderRadius: 6, border: "1px solid #1c3554",
                background: "#0b1522", color: "#9fb5cc", fontSize: 12, cursor: "pointer",
              }}
            >
              Copy Log
            </button>
          )}
          {entries.length > 0 && (
            <button
              onClick={() => { onClear(); clearAuditLog(); }}
              style={{
                padding: "4px 10px", borderRadius: 6, border: "1px solid #5a1a1a",
                background: "#1a0a0a", color: "#cc5555", fontSize: 12, cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{
          background: "#0a1624", border: "1px solid #18283e",
          borderTop: "none", borderRadius: "0 0 8px 8px",
          overflow: "hidden", marginTop: -12, padding: "12px 16px",
        }}>
          {recent.length === 0 ? (
            <div style={{ color: "#4a6a85", fontSize: 13, fontStyle: "italic" }}>
              No audit log entries yet. Run an analysis to populate the log.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #18283e", color: "#6b8099" }}>
                    <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600 }}>Time</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600 }}>T1</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600 }}>T2</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600 }}>Profile</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600 }}>SSIM</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600 }}>Regions</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600 }}>Mode</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600 }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(entry => (
                    <tr key={entry.id} style={{ borderBottom: "1px solid #0f1f33", color: "#9fb5cc" }}>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 11 }}>
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: "6px 8px", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {entry.t1Filename}
                      </td>
                      <td style={{ padding: "6px 8px", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {entry.t2Filename}
                      </td>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{entry.profile}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>{entry.ssim.toFixed(4)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{entry.regionsDetected}</td>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{entry.pipelineMode === "GLOBAL_DIFF" ? "Global Diff" : "Localized"}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", textAlign: "right" }}>{entry.processingTimeMs}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
