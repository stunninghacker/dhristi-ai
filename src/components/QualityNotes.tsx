import { useState } from "react";
import { CheckCircleIcon, AlertIcon } from "./Icons";

export default function QualityNotes({ notes }: { notes: string[] }) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{
      border: "1px solid #18283e",
      borderRadius: 8,
      overflow: "hidden",
      marginBottom: 20,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", background: "#0a1420", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", color: "#9fb5cc",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 13, color: "#b6c6d9" }}>Quality & Reliability Notes</span>
        <span style={{ fontSize: 13, color: "#8ba3bd" }}>{open ? "▲ collapse" : "▼ expand"}</span>
      </button>

      {open && (
        <div style={{ padding: "12px 16px", background: "#08111d", display: "flex", flexDirection: "column", gap: 8 }}>
          {notes.map((note, i) => {
            const isOk = note.toLowerCase().includes("suitable");
            return (
              <div key={i} style={{
                background: isOk ? "rgba(34,197,94,.10)" : "rgba(245,158,11,.10)",
                border: `1px solid ${isOk ? "rgba(34,197,94,.30)" : "rgba(245,158,11,.30)"}`,
                borderRadius: 8,
                padding: "10px 12px",
                display: "flex", alignItems: "flex-start", gap: 8,
              }}>
                <div style={{ marginTop: 1, flexShrink: 0 }}>
                  {isOk
                    ? <CheckCircleIcon size={14} color="#22c55e" />
                    : <AlertIcon size={14} color="#f59e0b" />
                  }
                </div>
                <span style={{ color: isOk ? "#bbf7d0" : "#fde68a", fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
                  {note}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
