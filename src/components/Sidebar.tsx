import React from "react";
import { PROFILES, PROFILE_KEYS } from "../profiles";
import type { ProfileKey } from "../types";
import { SatelliteIcon, SlidersIcon, InfoIcon } from "./Icons";

interface SidebarProps {
  resolution: number;
  setResolution: (v: number) => void;
  sensitivity: number;
  setSensitivity: (v: number) => void;
  minArea: number;
  setMinArea: (v: number) => void;
  profile: ProfileKey;
  setProfile: (v: ProfileKey) => void;
  showLabels: boolean;
  setShowLabels: (v: boolean) => void;
  showHeatmap: boolean;
  setShowHeatmap: (v: boolean) => void;
}

export default function Sidebar(props: SidebarProps) {
  const { resolution, setResolution, sensitivity, setSensitivity, minArea, setMinArea,
    profile, setProfile, showLabels, setShowLabels, showHeatmap, setShowHeatmap } = props;

  return (
    <aside style={{
      width: 268,
      minWidth: 268,
      background: "#070b13",
      borderRight: "1px solid #18283e",
      display: "flex",
      flexDirection: "column",
      padding: "20px 16px",
      gap: 0,
      overflowY: "auto",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg, #0c2a44, #0b4870)",
          border: "1px solid #1e5d84",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <SatelliteIcon size={18} color="#38bdf8" />
        </div>
        <div>
          <div style={{ color: "#7dd3fc", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 800 }}>SATELLIGENCE</div>
          <div style={{ color: "#9fb5cc", fontSize: 11 }}>Intelligence Platform</div>
        </div>
      </div>

      <SectionLabel icon={<SlidersIcon size={12} color="#7dd3fc" />} label="System Parameters" />

      <SliderField
        label="Processing Resolution"
        value={resolution}
        min={420} max={980} step={20}
        onChange={setResolution}
        display={`${resolution}px`}
      />
      <SliderField
        label="Change Sensitivity"
        value={sensitivity}
        min={10} max={90} step={1}
        onChange={setSensitivity}
        display={`${sensitivity}/100`}
      />
      <SliderField
        label="Minimum Change Size"
        value={minArea}
        min={50} max={4000} step={25}
        onChange={setMinArea}
        display={`${minArea}px²`}
      />

      <SectionLabel icon={<SlidersIcon size={12} color="#7dd3fc" />} label="Analysis Profile" style={{ marginTop: 12 }} />

      <div style={{ marginBottom: 16 }}>
        <select value={profile} onChange={e => setProfile(e.target.value as ProfileKey)}>
          {PROFILE_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      <div style={{
        padding: "10px 12px",
        background: "#0a1624",
        borderRadius: 10,
        border: "1px solid #18283e",
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: PROFILES[profile].color, flexShrink: 0 }} />
          <span style={{ color: "#7dd3fc", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Active Profile
          </span>
        </div>
        <div style={{ color: "#9fb5cc", fontSize: 11, lineHeight: 1.55 }}>{PROFILES[profile].summary}</div>
      </div>

      <SectionLabel icon={<SlidersIcon size={12} color="#7dd3fc" />} label="Display Options" />

      <CheckField label="Show Detection Labels" checked={showLabels} onChange={setShowLabels} />
      <CheckField label="Show Difference Surface" checked={showHeatmap} onChange={setShowHeatmap} />

      {/* Method note */}
      <div style={{
        marginTop: "auto",
        paddingTop: 18,
        borderTop: "1px solid #18283e",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <InfoIcon size={12} color="#7dd3fc" />
          <span style={{ color: "#7dd3fc", fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" }}>Method</span>
        </div>
        <div style={{ color: "#6b8099", fontSize: 11, lineHeight: 1.6 }}>
          Profile-weighted spectral, structural, and edge change analysis with local hotspot extraction, brightness normalisation, and analyst-review priority scoring.
        </div>
      </div>
    </aside>
  );
}

function SectionLabel({ label, icon, style }: { label: string; icon?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, ...style }}>
      {icon}
      <span style={{ color: "#7dd3fc", fontSize: 10, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

function SliderField({ label, value, min, max, step, onChange, display }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; display: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ color: "#9fb5cc", fontSize: 12 }}>{label}</span>
        <span style={{ color: "#4fc3ff", fontSize: 12, fontWeight: 700 }}>{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", marginBottom: 10, userSelect: "none" }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span style={{ color: "#9fb5cc", fontSize: 12 }}>{label}</span>
    </label>
  );
}
