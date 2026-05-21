import { useState } from "react";

const FUTURE_DATES = ["T1", "T2", "T3", "T4"];

export default function TimelineAnalysis() {
  const [open, setOpen] = useState(false);

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
        <span style={{ fontSize: 13, fontWeight: 800 }}>Timeline Analysis</span>
        <span style={{ color: "#4a6a85", fontSize: 11 }}>{open ? "Collapse" : "Expand"}</span>
      </button>

      {open && (
        <div style={{ background: "#07111f", borderTop: "1px solid #18283e", padding: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <div style={{ color: "#d9e9fb", fontSize: 12, fontWeight: 800 }}>
              Current mode: T1 vs T2 comparison
            </div>
            <div
              style={{
                background: "rgba(56,189,248,0.08)",
                border: "1px solid rgba(56,189,248,0.24)",
                borderRadius: 999,
                color: "#7dd3fc",
                fontSize: 10,
                fontWeight: 800,
                padding: "5px 9px",
                textTransform: "uppercase",
              }}
            >
              Future-ready
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 8,
              marginBottom: 12,
            }}
          >
            {FUTURE_DATES.map((date, index) => (
              <div
                key={date}
                style={{
                  minWidth: 0,
                  background: index < 2 ? "#081a2e" : "rgba(8,26,46,0.62)",
                  border: index < 2 ? "1px solid #17456d" : "1px dashed #20415d",
                  borderRadius: 8,
                  padding: "10px 9px",
                  textAlign: "center",
                }}
              >
                <div style={{ color: index < 2 ? "#3ab5ff" : "#8ba3bd", fontSize: 12, fontWeight: 900 }}>
                  {date}
                </div>
              </div>
            ))}
          </div>

          <div style={{ color: "#9fb5cc", fontSize: 12, lineHeight: 1.5 }}>
            Multi-date analysis can reveal gradual construction, water loss, vegetation change, or urban expansion.
          </div>
        </div>
      )}
    </section>
  );
}
