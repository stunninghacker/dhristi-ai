import { useState, useEffect, useRef, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import UploadZone from "./components/UploadZone";
import MetricCard from "./components/MetricCard";
import StatusBanner from "./components/StatusBanner";
import AccuracyPanel from "./components/AccuracyPanel";
import ReliabilityCauses from "./components/ReliabilityCauses";
import QualityNotes from "./components/QualityNotes";
import ImageViewer from "./components/ImageViewer";
import GlobalDifferenceSurface from "./components/GlobalDifferenceSurface";
import DetectionTable from "./components/DetectionTable";
import ExportSection from "./components/ExportSection";
import ValidationMetrics, { buildValidationMetrics } from "./components/ValidationMetrics";
import TimelineAnalysis from "./components/TimelineAnalysis";
import HowItWorks from "./components/HowItWorks";
import SolutionSummary from "./components/SolutionSummary";
import BeforeAfterSlider from "./components/BeforeAfterSlider";
import { SpinnerIcon, PlayIcon, SatelliteIcon } from "./components/Icons";
import { analysePair, loadImageFromFile, generateDemoImages, canvasToDataURL } from "./engine";
import { extractGeoMetadata } from "./geospatial";
import type { AnalysisResult, ProfileKey, ActiveTab, GeoReferencePair, ValidationGroundTruth } from "./types";
import { isPreliminaryReview } from "./utils/preliminary";

export default function App() {
  // ── Sidebar parameters ──
  const [resolution, setResolution] = useState(720);
  const [sensitivity, setSensitivity] = useState(45);
  const [minArea, setMinArea] = useState(400);
  const [profile, setProfile] = useState<ProfileKey>("Defence / Security");
  const [showLabels, setShowLabels] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);

  // ── Upload state ──
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [preview1, setPreview1] = useState<string>("");
  const [preview2, setPreview2] = useState<string>("");
  const [useDemo, setUseDemo] = useState(false);

  // ── Analysis state ──
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("analyse");
  const [selected, setSelected] = useState<number | null>(null);
  const [, refreshAnalystWorkflow] = useState(0);
  const [validationGroundTruth, setValidationGroundTruth] = useState<ValidationGroundTruth>({
    truePositives: null,
    falsePositives: null,
    falseNegatives: null,
  });
  const surfaceRef = useRef<HTMLDivElement>(null);

  // Signature for auto-recompute
  const signatureRef = useRef<string>("");
  const currentSignature = [
    file1?.name ?? "", file2?.name ?? "", useDemo,
    resolution, sensitivity, minArea, profile, showLabels,
  ].join("|");

  const handleFile1 = (f: File) => {
    setFile1(f);
    const url = URL.createObjectURL(f);
    setPreview1(url);
  };

  const handleFile2 = (f: File) => {
    setFile2(f);
    const url = URL.createObjectURL(f);
    setPreview2(url);
  };

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      let img1: HTMLImageElement | HTMLCanvasElement;
      let img2: HTMLImageElement | HTMLCanvasElement;
      let geoReferences: GeoReferencePair | undefined;

      if (useDemo) {
        const [c1, c2] = generateDemoImages();
        img1 = c1; img2 = c2;
        // Set preview from demo canvases
        setPreview1(canvasToDataURL(c1));
        setPreview2(canvasToDataURL(c2));
      } else if (file1 && file2) {
        const [loadedT1, loadedT2, baselineGeo, recentGeo] = await Promise.all([
          loadImageFromFile(file1),
          loadImageFromFile(file2),
          extractGeoMetadata(file1, "T1"),
          extractGeoMetadata(file2, "T2"),
        ]);
        img1 = loadedT1;
        img2 = loadedT2;
        geoReferences = { baseline: baselineGeo, recent: recentGeo };
      } else {
        setError("Please upload both images or enable demo images.");
        setLoading(false);
        return;
      }

      signatureRef.current = currentSignature;
      const res = await analysePair(img1, img2, profile, resolution, sensitivity, minArea, showLabels, geoReferences);
      setResult(res);
    } catch (e) {
      console.error(e);
      setError("Analysis failed. Please check your images and try again.");
    } finally {
      setLoading(false);
    }
  }, [file1, file2, useDemo, profile, resolution, sensitivity, minArea, showLabels, currentSignature]);

  // Auto-recompute when params change (after first run)
  useEffect(() => {
    if (result && signatureRef.current && signatureRef.current !== currentSignature) {
      runAnalysis();
    }
  }, [currentSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSelected(null);
    setValidationGroundTruth({
      truePositives: null,
      falsePositives: null,
      falseNegatives: null,
    });
  }, [result]);

  const updateAnalystWorkflow = useCallback(() => {
    refreshAnalystWorkflow(version => version + 1);
  }, []);

  const handleSelectRegion = useCallback((id: number | null, scrollToSurface = false) => {
    setSelected(id);
    if (id !== null && scrollToSurface) {
      window.requestAnimationFrame(() => {
        surfaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const preliminaryReview = result ? isPreliminaryReview(result) : false;
  const highFlagCount = result && !preliminaryReview
    ? result.detections.filter(d => ["HIGH", "CRITICAL"].includes(d.priority)).length
    : 0;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#080d16" }}>
      <Sidebar
        resolution={resolution} setResolution={setResolution}
        sensitivity={sensitivity} setSensitivity={setSensitivity}
        minArea={minArea} setMinArea={setMinArea}
        profile={profile} setProfile={setProfile}
        showLabels={showLabels} setShowLabels={setShowLabels}
        showHeatmap={showHeatmap} setShowHeatmap={setShowHeatmap}
      />

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "24px 28px", maxWidth: "calc(100vw - 268px)" }}>

        {/* Hero */}
        <div style={{
          position: "relative",
          background: "radial-gradient(circle at 10% 15%, rgba(56,189,248,.15), transparent 28%), linear-gradient(135deg, #0b1524 0%, #0b1220 55%, #07101c 100%)",
          border: "1px solid #1e5d84",
          borderLeft: "5px solid #38bdf8",
          borderRadius: "0 14px 14px 0",
          padding: "22px 28px",
          marginBottom: 22,
          display: "flex", alignItems: "center", gap: 18,
        }}>
          <div style={{
            width: 50, height: 50, borderRadius: 14, flexShrink: 0,
            background: "linear-gradient(135deg, #0c2a44, #0b4870)",
            border: "1px solid #1e5d84",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <SatelliteIcon size={24} color="#38bdf8" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#7dd3fc", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
              Satellite Analysis Platform
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "white", letterSpacing: "-0.02em", marginBottom: 4 }}>
              AI-Based Satellite Intelligence System
            </div>
            <div style={{ color: "#9fb5cc", fontSize: 13 }}>
              Before/after imagery comparison · Profile-aware change detection · Analyst review · Exportable reporting
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #18283e", marginBottom: 24 }}>
          {([["analyse", "Analyse"], ["how", "How It Works"], ["summary", "Solution Summary"]] as [ActiveTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: "10px 20px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 13, fontWeight: 600,
                color: activeTab === key ? "#ffffff" : "#8ba3bd",
                borderBottom: activeTab === key ? "2px solid #fb4765" : "2px solid transparent",
                marginBottom: -1,
                transition: "color 0.2s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ─── HOW IT WORKS ─── */}
        {activeTab === "how" && <HowItWorks />}

        {/* ─── SOLUTION SUMMARY ─── */}
        {activeTab === "summary" && (
          <SolutionSummary profile={profile} setProfile={setProfile} preliminaryReview={preliminaryReview} />
        )}

        {/* ─── ANALYSE ─── */}
        {activeTab === "analyse" && (
          <div className="fade-in">
            {/* Upload row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <UploadZone
                label="T1 — Earlier / Baseline Image"
                sublabel="The reference image taken before changes"
                file={file1} onFile={handleFile1}
                previewUrl={preview1}
              />
              <UploadZone
                label="T2 — Recent Image"
                sublabel="The comparison image taken after potential changes"
                file={file2} onFile={handleFile2}
                previewUrl={preview2}
              />
            </div>

            {/* Demo toggle + Run button */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox" checked={useDemo}
                  onChange={e => setUseDemo(e.target.checked)}
                />
                <span style={{ color: "#9fb5cc", fontSize: 13 }}>Use built-in synthetic demo images</span>
              </label>

              <button
                onClick={runAnalysis}
                disabled={loading}
                style={{
                  background: loading ? "#0b1e30" : "linear-gradient(135deg, #0c4a78, #0a3a60)",
                  border: "1px solid #2a7ab8",
                  borderRadius: 10,
                  padding: "10px 24px",
                  cursor: loading ? "wait" : "pointer",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 14,
                  display: "flex", alignItems: "center", gap: 8,
                  transition: "all 0.2s",
                  boxShadow: loading ? "none" : "0 4px 16px rgba(56,189,248,0.15)",
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "linear-gradient(135deg, #0e5a92, #0b4878)"; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "linear-gradient(135deg, #0c4a78, #0a3a60)"; }}
              >
                {loading ? <SpinnerIcon size={16} /> : <PlayIcon size={16} color="white" />}
                {loading ? "Running Analysis…" : "Run Analysis"}
              </button>

              {error && (
                <div style={{
                  color: "#fb4765", fontSize: 12, fontWeight: 600,
                  background: "rgba(251,71,101,0.1)", border: "1px solid rgba(251,71,101,0.3)",
                  borderRadius: 8, padding: "6px 12px",
                }}>
                  {error}
                </div>
              )}
            </div>

            {/* Loading skeleton */}
            {loading && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "60px 40px", gap: 16,
                background: "#0a1624", border: "1px solid #18283e",
                borderRadius: 14,
              }}>
                <SpinnerIcon size={36} />
                <div style={{ color: "#7db7e5", fontSize: 14, fontWeight: 600 }}>Running profile-aware change analysis…</div>
                <div style={{ color: "#4a6a85", fontSize: 12 }}>
                  Aligning images · Computing change surface · Extracting review zones · Scoring review regions
                </div>
              </div>
            )}

            {/* No result yet */}
            {!loading && !result && !error && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "60px 40px", gap: 16,
                background: "#0a1624", border: "1px dashed #18283e",
                borderRadius: 14, textAlign: "center",
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <SatelliteIcon size={26} color="#38bdf8" />
                </div>
                <div style={{ color: "#7db7e5", fontSize: 15, fontWeight: 700 }}>Ready for Analysis</div>
                <div style={{ color: "#4a6a85", fontSize: 12, maxWidth: 380, lineHeight: 1.6 }}>
                  Upload a baseline (T1) and recent (T2) satellite image, or enable demo images, then click Run Analysis.
                </div>
              </div>
            )}

            {/* ─── RESULTS ─── */}
            {!loading && result && (
              <div className="fade-in">
                <StatusBanner result={result} />
                <SceneComparabilityCard result={result} />
                <AccuracyPanel result={result} />
                <ReliabilityCauses result={result} />

                {/* SSIM warning */}
                {result.ssim < 0.40 && (
                  <div style={{
                    background: result.ssim < 0.20 ? "rgba(251,71,101,0.14)" : "rgba(245,158,11,0.1)",
                    border: result.ssim < 0.20 ? "1px solid #fb4765" : "1px solid #f59e0b",
                    color: result.ssim < 0.20 ? "#ffd6df" : "#facc15",
                    padding: "12px 16px", borderRadius: 8, marginBottom: 16,
                    fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 10
                  }}>
                    <span style={{ fontSize: 11, letterSpacing: "0.12em", color: result.ssim < 0.20 ? "#fb4765" : "#f59e0b" }}>ALERT</span>
                    <span>
                      {result.ssim < 0.20
                        ? result.scoringNote
                        : `Low image similarity (SSIM: ${result.ssim.toFixed(4)}) - images may be from different sensors, seasons, or locations. Results show strongest local change signals only.`}
                    </span>
                  </div>
                )}

                {/* Alignment warning */}
                {(!result.alignmentUsed && (!result.alignmentScore || isNaN(result.alignmentScore))) && (
                  <div style={{
                    background: "rgba(245,158,11,0.1)", border: "1px solid #f59e0b",
                    color: "#facc15", padding: "12px 16px", borderRadius: 8, marginBottom: 16,
                    fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 10
                  }}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <span>Image registration failed — direct comparison used. Some review regions may reflect viewpoint differences.</span>
                  </div>
                )}

                {/* Metrics */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                    gap: "10px",
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "0",
                  }}
                >
                  <MetricCard
                    label={preliminaryReview ? "Review Surface" : "Changed Area"}
                    subtext={preliminaryReview ? "Visual difference coverage only; not confirmed ground change." : undefined}
                    value={Number.isFinite(result.changedAreaPct) ? `${result.changedAreaPct.toFixed(3)}%` : "—"}
                  />
                  <MetricCard label={preliminaryReview ? "Review Regions" : "Detections"} value={result.detectionCount ?? "—"} />
                  <MetricCard
                    label="High Flags"
                    value={highFlagCount.toString()}
                    valueColor={highFlagCount > 0 ? "#ef4444" : "#3ab5ff"}
                  />
                  <MetricCard
                    label="Max Score"
                    value={Number.isFinite(result.maxScore) ? `${result.maxScore}/100` : "—"}
                  />
                  <MetricCard
                    label="Confidence"
                    value={Number.isFinite(result.confidence) ? `${result.confidence}/100` : "—"}
                  />
                  <MetricCard
                    label="SSIM"
                    value={Number.isFinite(result.ssim) ? result.ssim.toFixed(4) : "—"}
                  />
                </div>

                {/* Summary Line */}
                <div style={{
                  fontSize: 12,
                  color: "#4a7a9b",
                  fontFamily: "monospace",
                  marginBottom: 16,
                  letterSpacing: "0.03em"
                }}>
                  {preliminaryReview ? (
                    <>
                      {result.detectionCount} review |{" "}
                      preliminary review |{" "}
                      manual verification required |{" "}
                      Geo metadata: {result.geoMetadata.available ? "Available" : "Not available"}
                    </>
                  ) : (
                    <>
                      {result.detections.filter(d => d.priority === "HIGH").length} high-priority |{" "}
                      {result.detections.filter(d => d.priority === "MEDIUM").length} medium |{" "}
                      {result.detections.filter(d => d.priority === "LOW").length} low |{" "}
                      Alignment: {result.alignmentScore || 0}% |{" "}
                      Geo metadata: {result.geoMetadata.available ? "Available" : "Not available"}
                    </>
                  )}
                </div>

                {/* Alignment caption */}
                <div style={{ color: "#4a6a85", fontSize: 11, marginBottom: 16, display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <span>Alignment used: <span style={{ color: result.alignmentUsed ? "#34d399" : "#f59e0b" }}>{result.alignmentUsed ? "YES" : "NO"}</span></span>
                  <span>Alignment score: <span style={{ color: "#4fc3ff" }}>{result.alignmentScore}/100</span></span>
                  <span>Brightness delta: <span style={{ color: "#4fc3ff" }}>{result.brightnessDelta}</span></span>
                  <span>Contrast delta: <span style={{ color: "#4fc3ff" }}>{result.contrastDelta}</span></span>
                </div>

                <QualityNotes notes={result.qualityNotes} />

                {/* Image viewer */}
                <SectionHeader label="Imagery Analysis" />
                <ImageViewer result={result} showHeatmap={showHeatmap} />
                {preliminaryReview && (
                  <div style={{ color: "#7dd3fc", fontSize: 12, marginTop: -16, marginBottom: 22 }}>
                    Showing top review regions. Full list available in exports.
                  </div>
                )}

                {/* Before/After Slider */}
                <SectionHeader label="Interactive Comparison" />
                {preliminaryReview && (
                  <PreliminaryNotice>
                    Preliminary review - scene comparability is very low. Showing top review regions. Full list available in exports.
                  </PreliminaryNotice>
                )}
                <div style={{ marginBottom: 24 }}>
                  {(() => {
                    console.log(
                      "slider src types:",
                      typeof result.images.baseImage,
                      typeof result.images.annotatedImage,
                      result.images.baseImage?.slice(0, 30),
                    );
                    return null;
                  })()}
                  <BeforeAfterSlider
                    beforeSrc={result.images.baseImage}
                    afterSrc={result.images.recentImage}
                    afterLabel={preliminaryReview ? "REVIEW OVERLAY" : "AI ANNOTATED"}
                    regions={result.detections}
                    selectedRegionId={selected}
                    onSelectRegion={(id) => handleSelectRegion(id)}
                    preliminaryMode={preliminaryReview}
                    showLabels={showLabels}
                  />
                </div>

                {/* Heatmap */}
                {showHeatmap && (
                  <>
                    <div ref={surfaceRef}>
                      <SectionHeader label={preliminaryReview ? "Global Difference Surface" : "Change-Priority Heatmap"} />
                      {preliminaryReview && (
                        <div style={{ color: "#8ba3bd", fontSize: 12, marginTop: -4, marginBottom: 10 }}>
                          Visual difference surface; not confirmed ground change.
                          <span style={{ color: "#7dd3fc", marginLeft: 10 }}>Showing top review regions. Full list available in exports.</span>
                        </div>
                      )}
                      <GlobalDifferenceSurface
                        result={result}
                        selected={selected}
                        onSelectRegion={(id) => handleSelectRegion(id)}
                        onAnalystWorkflowChange={updateAnalystWorkflow}
                      />
                    </div>
                  </>
                )}

                {/* Detection log */}
                <SectionHeader label={preliminaryReview ? "Preliminary Review Log" : "Detection Log"} />
                <div style={{
                  fontSize: 18, fontWeight: 800, color: "#e8f2ff", marginBottom: 16,
                  borderBottom: "1px solid #18283e", paddingBottom: 12
                }}>
                  {preliminaryReview
                    ? `${result.detectionCount} visual review region(s) identified. Manual verification required.`
                    : `${result.detectionCount} change candidate(s) identified for analyst inspection`}
                </div>
                <div style={{ marginBottom: 24 }}>
                  <DetectionTable
                    result={result}
                    detections={result.detections}
                    selected={selected}
                    setSelected={(id) => handleSelectRegion(id, id !== null)}
                    onAnalystWorkflowChange={updateAnalystWorkflow}
                  />
                </div>

                <ValidationMetrics
                  result={result}
                  groundTruth={validationGroundTruth}
                  onGroundTruthChange={setValidationGroundTruth}
                />
                <TimelineAnalysis />

                {/* Export */}
                <SectionHeader label="Export Report" />
                <ExportSection
                  result={result}
                  validationMetrics={buildValidationMetrics(result, validationGroundTruth)}
                />
              </div>
            )}
          </div>
        )}
      </main>

    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
    }}>
      <div style={{ width: 3, height: 18, borderRadius: 2, background: "#38bdf8" }} />
      <h2 style={{ fontSize: 15, fontWeight: 800, color: "#e8f2ff", letterSpacing: "-0.01em" }}>{label}</h2>
    </div>
  );
}

function PreliminaryNotice({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(125,211,252,0.08)",
        border: "1px solid rgba(125,211,252,0.28)",
        borderRadius: 8,
        color: "#bdefff",
        fontSize: 12,
        fontWeight: 700,
        padding: "9px 12px",
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function SceneComparabilityCard({ result }: { result: AnalysisResult }) {
  const isVeryLow = result.sceneComparability === "VERY LOW";
  const tone = isVeryLow ? "#ffcc00" : result.sceneComparability === "LOW" ? "#f59e0b" : "#38bdf8";

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #0d1a2b 0%, #08111d 100%)",
        border: `1px solid ${isVeryLow ? "rgba(251,71,101,0.65)" : "#1e4870"}`,
        borderLeft: `5px solid ${tone}`,
        borderRadius: "0 10px 10px 0",
        padding: "13px 16px",
        marginBottom: 12,
        display: "grid",
        gridTemplateColumns: "minmax(160px, 0.8fr) minmax(0, 2.2fr)",
        gap: 14,
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ color: "#7db7e5", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800, marginBottom: 4 }}>
          Scene Comparability
        </div>
        <div
          style={{
            color: isVeryLow ? "#ffcc00" : tone,
            fontSize: isVeryLow ? "1.4rem" : 20,
            fontWeight: isVeryLow ? 700 : 900,
            letterSpacing: "0.02em",
          }}
        >
          {result.sceneComparability}
        </div>
      </div>
      <div style={{ color: isVeryLow ? "#ffd6df" : "#9fb5cc", fontSize: 12, lineHeight: 1.5 }}>
        {result.scoringNote}
      </div>
    </div>
  );
}
