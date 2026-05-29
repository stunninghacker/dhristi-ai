export default function HowItWorks() {
  return (
    <div style={{ maxWidth: 820, padding: "8px 0" }}>
      <SectionTitle>Methodology</SectionTitle>
      <p style={{ color: "#9fb5cc", marginBottom: 20, lineHeight: 1.7, fontSize: 13 }}>
        The system compares two satellite images from different times and generates analyst-review change candidates using a multi-layer computer vision pipeline.
      </p>

      <SectionTitle>Processing Pipeline</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {[
          ["1", "Image Ingestion", "Load T1 baseline and T2 recent images. Supports PNG, JPG, and TIFF formats."],
          ["2", "Controlled Resizing", "Resize both images to the selected processing resolution while preserving aspect ratio."],
          ["3", "Feature-Based Alignment", "Register T2 against T1 using structural correlation estimation. An alignment score quantifies registration quality."],
          ["4", "Color Statistics Normalisation", "Match per-channel mean and standard deviation between images. This removes global lighting, sensor, and atmospheric tone differences without suppressing real local changes."],
          ["5", "Multi-Layer Change Surface", "Compute profile-weighted spectral (chroma-only), structural (local contrast residual), edge/texture difference, vegetation index delta (ExG), and water-surface proxy layers."],
          ["6", "Broad Scene Suppression", "Subtract a wide Gaussian (σ=31) from the raw change surface. This suppresses seasonal, illumination, and resolution-induced scene-wide differences while preserving localized hotspots."],
          ["7", "Adaptive Thresholding", "Apply an absolute plus percentile-gated threshold. A safety valve tightens the threshold if the mask covers more than 10% of the scene, preventing false mass-detection."],
          ["8", "Connected Region Extraction", "Identify spatially connected change zones above the threshold. Filter by minimum area, aspect ratio, and fill density to remove noise seams."],
          ["9", "Priority Scoring", "Score each region by intensity, area, compactness, edge evidence, and spectral specificity — all weighted by the active analysis profile."],
          ["10", "Confidence Calibration", "Compute a global confidence score based on SSIM, alignment quality, changed area fraction, brightness delta, and contrast delta. Dampen detection scores proportionally."],
          ["11", "Low-Confidence Hints", "If no strong detections exist but weak localized signals remain after suppression, extract up to four analyst-review hints clearly labelled as low-confidence review regions."],
          ["12", "Output Generation", "Annotated imagery, visual difference surface, detection log, and downloadable CSV/JSON/PDF reports."],
        ].map(([num, title, desc]) => (
          <div key={num} style={{
            display: "flex", gap: 14, alignItems: "flex-start",
            background: "#0a1624", border: "1px solid #18283e",
            borderRadius: 8, padding: "12px 14px",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#38bdf8", fontSize: 13, fontWeight: 800,
            }}>{num}</div>
            <div>
              <div style={{ color: "#e8f2ff", fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{title}</div>
              <div style={{ color: "#8ba3bd", fontSize: 13, lineHeight: 1.6 }}>{desc}</div>
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
