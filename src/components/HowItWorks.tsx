import { PROFILES, PROFILE_KEYS } from "../profiles";

export default function HowItWorks() {
  return (
    <div style={{ maxWidth: 820, padding: "8px 0" }}>

      {/* ─── Section 1: Pipeline Overview ─── */}
      <SectionTitle>Pipeline Overview</SectionTitle>
      <div style={{
        background: "#0a1624", border: "1px solid #18283e", borderRadius: 8,
        padding: "20px 24px", marginBottom: 24, overflowX: "auto",
      }}>
        <pre style={{
          color: "#7dd3fc", fontSize: 12, lineHeight: 1.8,
          fontFamily: "monospace", margin: 0, whiteSpace: "pre",
        }}>
{`T1 Image ──┬── Normalize ──┬── Register ──┬── SSIM ──┬── Route ──┬── Region Detection ──┬── Score ──┬── Export
           │               │              │          │           │                      │           │
           └── T2 Image ───┘              │          │           │                      │           │
                                          │          │           │                      │           │
                                    ┌─────┘     ┌────┘      ┌───┘                      │           │
                                    ▼           ▼           ▼                           ▼           ▼
                              Brightness   Alignment   SSIM < 0.5 ── Global Diff      Priority     CSV/JSON
                              Normalize    Score       SSIM ≥ 0.5 ── Localized        Scoring      PDF/PNG
                                                       Hotspot`}
        </pre>
      </div>

      {/* ─── Section 2: Analysis Modes ─── */}
      <SectionTitle>Analysis Modes</SectionTitle>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24,
      }}>
        <ModeCard
          title="Global Difference Mode"
          trigger="SSIM < 0.5"
          triggerColor="#f59e0b"
          description="When images differ significantly (low structural similarity), the engine falls back to a direct RGB difference surface. A mean + 0.5σ threshold is applied globally, and connected regions ≥ 100px are extracted. This mode is designed for major scene changes — floods, fires, large-scale construction — where localized hotspot detection would miss broad-area signals."
          details={[
            "Single-channel grayscale absolute differencing",
            "Adaptive threshold based on pixel statistics",
            "Min region size: 100px, max 30% of frame",
            "No Gaussian suppression applied",
          ]}
        />
        <ModeCard
          title="Localized Hotspot Mode"
          trigger="SSIM ≥ 0.5"
          triggerColor="#34d399"
          description="For structurally similar image pairs, the engine builds a multi-layer change surface from spectral, structural, edge, and vegetation-index channels — each weighted by the active profile. A wide Gaussian (σ=31) subtracts broad seasonal/illumination drift, preserving only localized hotspots. Profile-specific bias and percentile gating tune the detection threshold."
          details={[
            "Profile-weighted multi-layer surface (4 channels)",
            "Gaussian suppression of broad scene differences",
            "Adaptive percentile + absolute thresholding",
            "Safety valve caps mask at 10% of scene area",
          ]}
        />
      </div>

      {/* ─── Section 3: Profile System ─── */}
      <SectionTitle>Profile System</SectionTitle>
      <div style={{ overflowX: "auto", marginBottom: 24 }}>
        <table style={{
          width: "100%", borderCollapse: "collapse",
          color: "#9fb5cc", fontSize: 12,
        }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #18283e" }}>
              <TH>Profile</TH>
              <TH>Bias</TH>
              <TH>Structural</TH>
              <TH>Spectral</TH>
              <TH>Compact</TH>
              <TH>Area</TH>
              <TH>Edge</TH>
              <TH>Max Det</TH>
              <TH>Best For</TH>
            </tr>
          </thead>
          <tbody>
            {PROFILE_KEYS.map(key => {
              const p = PROFILES[key];
              return (
                <tr key={key} style={{ borderBottom: "1px solid #12293d" }}>
                  <td style={{ padding: "10px 8px", color: p.color, fontWeight: 700 }}>{key}</td>
                  <TD>{p.thresholdBias}</TD>
                  <TD>{p.structuralWeight.toFixed(2)}</TD>
                  <TD>{p.spectralWeight.toFixed(2)}</TD>
                  <TD>{p.compactnessWeight.toFixed(2)}</TD>
                  <TD>{p.areaWeight.toFixed(2)}</TD>
                  <TD>{p.edgeWeight.toFixed(2)}</TD>
                  <TD>{p.maxDetections}</TD>
                  <td style={{ padding: "10px 8px", color: "#6b8099", fontSize: 11, lineHeight: 1.5 }}>{p.summary}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── Section 4: Limitations ─── */}
      <SectionTitle>Limitations</SectionTitle>
      <div style={{
        background: "#0a1624", border: "1px solid #18283e", borderRadius: 8,
        padding: "16px 20px",
      }}>
        {[
          ["☁️", "Cloud cover", "Thick cloud or cloud shadow in either image produces false change signals in those areas. Pre-filter scenes for <20% cloud cover where possible."],
          ["🌫️", "Haze and atmospheric variation", "Haze, dust, or differential atmospheric scattering alter per-pixel intensities, especially in blue/green bands. Normalization helps but cannot fully correct heterogeneous haze."],
          ["🌿", "Seasonal vegetation changes", "Leaf-on vs leaf-off, crop cycles, and phenological shifts create widespread spectral differences that may be flagged as change. Profile tuning (Agriculture) mitigates this but cannot eliminate it."],
          ["📷", "Sensor / resolution mismatch", "Different sensors (Landsat vs Sentinel, or different camera systems) produce different MTF, band response, and noise characteristics. Resampling and normalization reduce but cannot remove these artifacts."],
          ["📍", "No georeferencing without coordinates", "Pixel coordinates are reported as image-relative (x, y) unless the user provides top-left and bottom-right lat/lng bounds. Without those, no geographic conversion is possible."],
          ["🔄", "Translational registration only", "The alignment step corrects for x/y translation (shift) only. It does not handle rotation, scale change, homography, or terrain relief distortion. Significant viewpoint changes will cause misregistration artifacts."],
        ].map(([icon, title, desc]) => (
          <div key={title} style={{
            display: "flex", gap: 12,
            padding: "10px 0",
            borderBottom: "1px solid #12293d",
          }}>
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icon}</span>
            <div>
              <span style={{ color: "#e8f2ff", fontWeight: 700, fontSize: 13 }}>{title}</span>
              <div style={{ color: "#6b8099", fontSize: 12, lineHeight: 1.6, marginTop: 2 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      color: "#e8f2ff", fontSize: 16, fontWeight: 800, marginBottom: 12,
      letterSpacing: "-0.02em", paddingBottom: 8, borderBottom: "1px solid #18283e"
    }}>
      {children}
    </h2>
  );
}

function ModeCard({ title, trigger, triggerColor, description, details }: {
  title: string; trigger: string; triggerColor: string;
  description: string; details: string[];
}) {
  return (
    <div style={{
      background: "#0a1624", border: "1px solid #18283e", borderRadius: 8,
      padding: "16px 18px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ color: "#e8f2ff", fontSize: 14, fontWeight: 800 }}>{title}</span>
        <span style={{
          padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 800,
          background: `${triggerColor}18`, color: triggerColor,
          fontFamily: "monospace",
        }}>{trigger}</span>
      </div>
      <p style={{ color: "#8ba3bd", fontSize: 13, lineHeight: 1.6, margin: "0 0 10px 0" }}>{description}</p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {details.map((d, i) => (
          <li key={i} style={{
            color: "#6b8099", fontSize: 12, padding: "2px 0",
          }}>▸ {d}</li>
        ))}
      </ul>
    </div>
  );
}

function TH({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      padding: "10px 8px", textAlign: "left",
      color: "#4a6a85", fontSize: 11, fontWeight: 800,
      letterSpacing: "0.08em", textTransform: "uppercase",
    }}>
      {children}
    </th>
  );
}

function TD({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: "10px 8px", color: "#9fb5cc", fontFamily: "monospace", fontSize: 12 }}>
      {children}
    </td>
  );
}
