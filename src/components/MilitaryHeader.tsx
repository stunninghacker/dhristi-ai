import { useState, useEffect } from "react";

function formatUTC(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
}

export default function MilitaryHeader() {
  const [clock, setClock] = useState(() => formatUTC(new Date()));

  useEffect(() => {
    const id = setInterval(() => setClock(formatUTC(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 52,
        padding: "0 24px",
        background: "#0a0f1e",
        borderBottom: "1px solid rgba(0, 212, 255, 0.3)",
        color: "#fff",
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      {/* Left: logo + title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 6,
            background: "linear-gradient(135deg, #0c2a44, #0b4870)",
            border: "1px solid #1e5d84",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
          }}
        >
          🛰
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: 1.5 }}>
            DHRISTI
          </div>
          <div style={{ fontSize: 10, color: "#9ab0c5", letterSpacing: 0.6, marginTop: -1 }}>
            Defence Satellite Intelligence Platform
          </div>
        </div>
      </div>

      {/* Center: UTC clock */}
      <div
        style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: 2,
          color: "#38bdf8",
          textShadow: "0 0 8px rgba(56, 189, 248, 0.4)",
        }}
      >
        {clock}
      </div>

      {/* Right: status indicators */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <StatusDot label="SYSTEM ONLINE" color="#34d399" />
        <StatusDot label="PIPELINE READY" color="#34d399" />
        <StatusDot label="SECURE MODE" color="#fbbf24" />
      </div>
    </div>
  );
}

function StatusDot({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 6px ${color}`,
          flexShrink: 0,
        }}
      />
      {label}
    </div>
  );
}
