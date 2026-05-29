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
import { SpinnerIcon, PlayIcon, SatelliteIcon, CheckCircleIcon } from "./components/Icons";
import { analysePair, loadImageFromFile } from "./engine";
import { extractGeoMetadata } from "./geospatial";
import type { AnalysisResult, ProfileKey, ActiveTab, GeoReferencePair, ValidationGroundTruth, TimelineMetadata } from "./types";
import { extractExifDate } from "./utils/exifDate";
import { isPreliminaryReview } from "./utils/preliminary";
import { runQualityCheck } from "./utils/qualityCheck";
import type { QualityWarning } from "./utils/qualityCheck";
import { getAuditLog, appendAuditLog } from "./utils/auditLog";
import { parseGeoBounds, pixelToLatLng } from "./utils/geoBounds";
import type { AuditLogEntry } from "./utils/auditLog";
import AuditLogPanel from "./components/AuditLogPanel";
import MilitaryHeader from "./components/MilitaryHeader";
import SpatialIntelligencePanel from "./components/SpatialIntelligencePanel";

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${url}`));
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}

export default function App() {
  // ── Sidebar parameters ──
  const [resolution, setResolution] = useState(720);
  const [sensitivity, setSensitivity] = useState(45);
  const [minArea, setMinArea] = useState(400);
  const [profile, setProfile] = useState<ProfileKey>("Defence / Security");
  const [showLabels, setShowLabels] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [normalize, setNormalize] = useState(true);
  const [falsePositiveFilter, setFalsePositiveFilter] = useState(0);
  const [secureMode, setSecureMode] = useState(false);
  const [classificationLevel, setClassificationLevel] = useState<string>("UNCLASSIFIED");
  const [analystName, setAnalystName] = useState("");
  const [analystOrg] = useState("");
  const [caseReference] = useState("");
  const [reportId, setReportId] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("drishti_sidebar_collapsed") === "true");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // ── Upload state ──
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [preview1, setPreview1] = useState<string>("");
  const [preview2, setPreview2] = useState<string>("");
  const [useDemo, setUseDemo] = useState(false);
  const [topLeftCoord, setTopLeftCoord] = useState("");
  const [bottomRightCoord, setBottomRightCoord] = useState("");

  // ── Analysis state ──
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ pct: number; stage: number; startTime: number } | null>(null);

  const STAGES = [
    "Normalizing images…",
    "Registering T1 → T2…",
    "Computing SSIM…",
    "Detecting change regions…",
    "Scoring & filtering…",
    "Generating report…",
  ];

  const stageForPct = (pct: number) => {
    if (pct < 15) return 0;
    if (pct < 35) return 1;
    if (pct < 55) return 2;
    if (pct < 75) return 3;
    if (pct < 90) return 4;
    return 5;
  };
  const [error, setError] = useState<string>("");
  const [qualityWarnings, setQualityWarnings] = useState<QualityWarning[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("analyse");
  const [selected, setSelected] = useState<number | null>(null);
  const [, refreshAnalystWorkflow] = useState(0);
  const [validationGroundTruth, setValidationGroundTruth] = useState<ValidationGroundTruth>({
    truePositives: null,
    falsePositives: null,
    falseNegatives: null,
  });
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(() => getAuditLog());

  // Signature for auto-recompute
  const signatureRef = useRef<string>("");
  const currentSignature = [
    file1?.name ?? "", file2?.name ?? "", useDemo,
    resolution, sensitivity, minArea, profile, showLabels, normalize, falsePositiveFilter,
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
    setQualityWarnings([]);
    setProgress({ pct: 0, stage: 0, startTime: performance.now() });

    try {
      let img1: HTMLImageElement | HTMLCanvasElement;
      let img2: HTMLImageElement | HTMLCanvasElement;
      let geoReferences: GeoReferencePair | undefined;
      let timeline: TimelineMetadata = {
        baselineDate: null,
        recentDate: null,
      };

      if (useDemo) {
        const [imgA, imgB] = await Promise.all([
          loadImageFromUrl("/demo/lko_before.jpeg"),
          loadImageFromUrl("/demo/lko_after.jpeg"),
        ]);
        img1 = imgA; img2 = imgB;
        setPreview1(imgA.src);
        setPreview2(imgB.src);
        timeline = { baselineDate: "May 2025", recentDate: "May 2026" };
      } else if (file1 && file2) {
        const [loadedT1, loadedT2, baselineGeo, recentGeo, baselineDate, recentDate] = await Promise.all([
          loadImageFromFile(file1),
          loadImageFromFile(file2),
          extractGeoMetadata(file1, "T1"),
          extractGeoMetadata(file2, "T2"),
          extractExifDate(file1),
          extractExifDate(file2),
        ]);
        img1 = loadedT1;
        img2 = loadedT2;
        geoReferences = { baseline: baselineGeo, recent: recentGeo };
        timeline = { baselineDate, recentDate };
      } else {
        setError("Please upload both images or enable demo images.");
        setLoading(false);
        return;
      }

      signatureRef.current = currentSignature;

      const warnings = runQualityCheck(
        img1 instanceof HTMLCanvasElement ? img1 : img1,
        img2 instanceof HTMLCanvasElement ? img2 : img2,
      );
      setQualityWarnings(warnings);

      const startTime = performance.now();
      const res = await analysePair(img1, img2, profile, resolution, sensitivity, minArea, showLabels, geoReferences, normalize, falsePositiveFilter, (pct) => {
        setProgress({ pct, stage: stageForPct(pct), startTime });
      });
      const processingTimeMs = Math.round(performance.now() - startTime);

      const geoBounds = parseGeoBounds(topLeftCoord, bottomRightCoord);
      if (geoBounds) {
        res.detections.forEach(d => {
          const [cx, cy] = d.pixelCenter;
          const imgW = res.parameters.resolution;
          const imgH = Math.round(
            ((img2 instanceof HTMLImageElement ? img2.naturalHeight : img2.width) / Math.max(1, (img2 instanceof HTMLImageElement ? img2.naturalWidth : img2.width))) * imgW
          ) || 1;
          const { lat, lng } = pixelToLatLng(cx, cy, imgW, imgH, geoBounds);
          d.geoCenter = [lat, lng];
        });
      }
      const newReportId = `DRS-${Array.from({ length: 6 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]).join("")}`;
      setReportId(newReportId);
      setResult({ ...res, timeline });

      const entry: AuditLogEntry = {
        id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        t1Filename: useDemo ? "demo-T1" : (file1?.name ?? "unknown"),
        t2Filename: useDemo ? "demo-T2" : (file2?.name ?? "unknown"),
        profile: res.profile,
        ssim: res.ssim,
        regionsDetected: res.detectionCount,
        pipelineMode: res.analysisMode,
        processingTimeMs,
      };
      setAuditLog(appendAuditLog(entry));
    } catch (e) {
      console.error(e);
      setError("Analysis failed. Please check your images and try again.");
    } finally {
      setLoading(false);
      setProgress(null);
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

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && !sidebarCollapsed) {
        setSidebarCollapsed(true);
        localStorage.setItem("drishti_sidebar_collapsed", "true");
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [sidebarCollapsed]);

  const toggleCollapse = () => {
    setSidebarCollapsed(c => {
      const next = !c;
      localStorage.setItem("drishti_sidebar_collapsed", next ? "true" : "false");
      return next;
    });
  };

  const preliminaryReview = result ? isPreliminaryReview(result) : false;
  const highFlagCount = result ? result.highPriorityFlags : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#080d16" }}>
      <MilitaryHeader />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <Sidebar
          resolution={resolution} setResolution={setResolution}
          sensitivity={sensitivity} setSensitivity={setSensitivity}
          minArea={minArea} setMinArea={setMinArea}
          profile={profile} setProfile={setProfile}
          showLabels={showLabels} setShowLabels={setShowLabels}
          showHeatmap={showHeatmap} setShowHeatmap={setShowHeatmap}
          normalize={normalize} setNormalize={setNormalize}
          falsePositiveFilter={falsePositiveFilter} setFalsePositiveFilter={setFalsePositiveFilter}
          secureMode={secureMode} setSecureMode={setSecureMode}
          classificationLevel={classificationLevel} setClassificationLevel={setClassificationLevel}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleCollapse}
          disabled={loading}
        />
      )}

      {/* Mobile overlay backdrop */}
      {isMobile && mobileSidebarOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 998,
            background: "rgba(0,0,0,0.55)",
          }}
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      {isMobile && (
        <div style={{
          position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 999,
          transform: mobileSidebarOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
          boxShadow: mobileSidebarOpen ? "4px 0 24px rgba(0,0,0,0.4)" : "none",
        }}>
          <Sidebar
            resolution={resolution} setResolution={setResolution}
            sensitivity={sensitivity} setSensitivity={setSensitivity}
            minArea={minArea} setMinArea={setMinArea}
            profile={profile} setProfile={setProfile}
            showLabels={showLabels} setShowLabels={setShowLabels}
            showHeatmap={showHeatmap} setShowHeatmap={setShowHeatmap}
            normalize={normalize} setNormalize={setNormalize}
            falsePositiveFilter={falsePositiveFilter} setFalsePositiveFilter={setFalsePositiveFilter}
            secureMode={secureMode} setSecureMode={setSecureMode}
            classificationLevel={classificationLevel} setClassificationLevel={setClassificationLevel}
            collapsed={false}
            onToggleCollapse={() => setMobileSidebarOpen(false)}
            disabled={loading}
          />
        </div>
      )}

      {/* Mobile menu button */}
      {isMobile && !mobileSidebarOpen && (
        <button
          onClick={() => setMobileSidebarOpen(true)}
          style={{
            position: "fixed", top: 12, left: 12, zIndex: 100,
            width: 36, height: 36, borderRadius: 8, border: "1px solid #18283e",
            background: "#0a1624", color: "#7dd3fc", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}
          title="Open menu"
        >
          ☰
        </button>
      )}

      {/* Main content */}
      <main style={{
        flex: 1, minWidth: 0, overflowY: "auto",
        padding: isMobile ? "56px 14px 24px" : "24px 28px",
        maxWidth: isMobile ? "100vw" : sidebarCollapsed ? "calc(100vw - 84px)" : "calc(100vw - 300px)",
      }}>

        {/* Hero */}
        <div className="hero-header">
          <div style={{
            width: 50, height: 50, borderRadius: 8, flexShrink: 0,
            background: "linear-gradient(135deg, #0c2a44, #0b4870)",
            border: "1px solid #1e5d84",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <SatelliteIcon size={24} color="#38bdf8" />
          </div>
          {secureMode && (
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center", marginRight: 12,
              fontSize: 16,
            }} title="Secure Mode Active">
              🔒
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ color: "#7dd3fc", fontSize: 13, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
              Satellite Analysis Platform
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "white", letterSpacing: "-0.02em", marginBottom: 4, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span>AI-Based Satellite Intelligence System</span>
              <span style={{ fontSize: 24, display: "inline-flex", alignItems: "center" }}>🛰️</span>
            </div>
            <div style={{ color: "#9fb5cc", fontSize: 13 }}>
              Before/after imagery comparison · Profile-aware change detection · Analyst review · Exportable reporting
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs-container">
          {([["analyse", "Analyse"], ["how", "How It Works"], ["summary", "Solution Summary"]] as [ActiveTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`tab-btn ${activeTab === key ? "tab-btn-active" : ""}`}
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
                disabled={loading}
              />
              <UploadZone
                label="T2 — Recent Image"
                sublabel="The comparison image taken after potential changes"
                file={file2} onFile={handleFile2}
                previewUrl={preview2}
                disabled={loading}
              />
            </div>

            {/* Demo image captions */}
            {useDemo && preview1 && preview2 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: -8, marginBottom: 16 }}>
                <div style={{ color: "#4fc3ff", fontSize: 12, fontWeight: 600, fontFamily: "monospace", paddingLeft: 4 }}>
                  lko_before.jpeg — Lucknow, May 2025
                </div>
                <div style={{ color: "#4fc3ff", fontSize: 12, fontWeight: 600, fontFamily: "monospace", paddingLeft: 4 }}>
                  lko_after.jpeg — Lucknow, May 2026
                </div>
              </div>
            )}

            {/* Coordinate input */}
            <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#7dd3fc", fontSize: 12, fontWeight: 700, marginBottom: 4, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Top-Left Corner
                </div>
                <input
                  type="text"
                  placeholder="e.g. 28.6139, 77.2090"
                  value={topLeftCoord}
                  onChange={e => setTopLeftCoord(e.target.value)}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "#0a1624", border: "1px solid #18283e",
                    borderRadius: 6, padding: "8px 12px",
                    color: "#e8f2ff", fontSize: 13, outline: "none",
                    fontFamily: "monospace",
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#7dd3fc", fontSize: 12, fontWeight: 700, marginBottom: 4, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Bottom-Right Corner
                </div>
                <input
                  type="text"
                  placeholder="e.g. 28.5100, 77.3500"
                  value={bottomRightCoord}
                  onChange={e => setBottomRightCoord(e.target.value)}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "#0a1624", border: "1px solid #18283e",
                    borderRadius: 6, padding: "8px 12px",
                    color: "#e8f2ff", fontSize: 13, outline: "none",
                    fontFamily: "monospace",
                  }}
                />
              </div>
              {topLeftCoord && bottomRightCoord && (
                <div style={{
                  padding: "8px 14px", borderRadius: 6,
                  background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)",
                  color: "#34d399", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                  height: 36, display: "flex", alignItems: "center",
                }}>
                  Geo-referenced
                </div>
              )}
            </div>

            {/* Demo toggle + Run button */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox" checked={useDemo}
                  onChange={e => {
                    setUseDemo(e.target.checked);
                    if (e.target.checked) {
                      setTopLeftCoord("26.8467, 80.9462");
                      setBottomRightCoord("26.8200, 80.9750");
                    }
                  }}
                />
                <span style={{ color: "#9fb5cc", fontSize: 13 }}>
                  Use built-in demo images<br />
                  <span style={{ fontSize: 11, color: "#4a6a85" }}>(Lucknow Urban Area — Multi-temporal Satellite Analysis)</span>
                </span>
              </label>

              <button
                onClick={runAnalysis}
                disabled={loading}
                className={`run-analysis-btn ${loading ? "running" : ""} ${result && !loading ? "complete" : ""}`}
              >
                {loading ? (
                  <SpinnerIcon size={18} color="#e0f2fe" />
                ) : result ? (
                  <CheckCircleIcon size={18} color="#6ee7b7" />
                ) : (
                  <PlayIcon size={18} color="white" />
                )}
                {loading ? "Running Analysis…" : result ? "Analysis Complete" : "Run Analysis"}
              </button>

              {error && (
                <div style={{
                  color: "#fb4765", fontSize: 13, fontWeight: 600,
                  background: "rgba(251,71,101,0.1)", border: "1px solid rgba(251,71,101,0.3)",
                  borderRadius: 8, padding: "6px 12px",
                }}>
                  {error}
                </div>
              )}
            </div>

            {/* Loading skeleton */}
            {loading && <ProgressPanel stages={STAGES} progress={progress} />}

            {/* No result yet */}
            {!loading && !result && !error && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "60px 40px", gap: 16,
                background: "#0a1624", border: "1px dashed #18283e",
                borderRadius: 8, textAlign: "center",
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 12,
                  background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <SatelliteIcon size={32} color="#2563eb" />
                </div>
                <div style={{ color: "#587a9e", fontSize: 15, fontWeight: 700 }}>
                  No Analysis Results Yet
                </div>
                <div style={{ color: "#3a5a7a", fontSize: 13, maxWidth: 300, lineHeight: 1.5 }}>
                  Upload a base image (older) and a recent image of the same area using the upload zone above, then configure the analysis profile and click <strong style={{ color: "#7dd3fc" }}>"Run Analysis"</strong>.
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  {[["📸", "Upload Base"], ["🛰️", "Upload Recent"]].map(([icon, label]) => (
                    <div key={label} style={{
                      padding: "6px 14px", borderRadius: 6,
                      background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.15)",
                      color: "#5a8db0", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <span>{icon}</span>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── RESULTS ─── */}
            {!loading && result && (
              <div className="fade-in">
                <StatusBanner result={result} />

                {secureMode && (
                  <div style={{
                    background: "rgba(251,191,36,0.08)",
                    border: "1px solid rgba(251,191,36,0.3)",
                    color: "#fbbf24",
                    padding: "10px 16px", borderRadius: 8, marginBottom: 12,
                    fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <span style={{ fontSize: 16 }}>🔒</span>
                    <span>OFFLINE MODE — No data leaves this device</span>
                    <span style={{
                      marginLeft: "auto", padding: "2px 10px", borderRadius: 4,
                      background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)",
                      fontSize: 11, fontWeight: 800, letterSpacing: "0.12em",
                    }}>
                      {classificationLevel}
                    </span>
                  </div>
                )}

                {qualityWarnings.map((w, i) => (
                  <div key={i} style={{
                    background: w.type === "cloud"
                      ? "rgba(148,163,184,0.12)"
                      : "rgba(245,158,11,0.1)",
                    border: w.type === "cloud"
                      ? "1px solid rgba(148,163,184,0.4)"
                      : "1px solid #f59e0b",
                    color: w.type === "cloud" ? "#cbd5e1" : "#facc15",
                    padding: "12px 16px", borderRadius: 8, marginBottom: 12,
                    fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 10
                  }}>
                    <span style={{ fontSize: 16 }}>
                      {w.type === "cloud" ? "☁️" : "🌫️"}
                    </span>
                    <span>{w.message}</span>
                  </div>
                ))}

                {(() => {
                  const highConfRegions = result.detections.filter(d => d.score > 68).length;
                  const totalRegions = result.detectionCount;
                  const isHighConf = totalRegions > 0 && result.confidence > 60;
                  const lowSsim = result.ssim < 0.3;
                  const severity = highConfRegions > 10 ? "CRITICAL" : (totalRegions > 0 || lowSsim) ? "WARNING" : "INFO";

                  return (
                    <>
                      {isHighConf && totalRegions > 0 && (
                        <div style={{
                          background: "rgba(239,68,68,0.12)",
                          border: "1px solid rgba(239,68,68,0.4)",
                          color: "#fca5a5",
                          padding: "14px 18px", borderRadius: 8, marginBottom: 12,
                          fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 12,
                        }}>
                          <span style={{ fontSize: 22 }}>🚨</span>
                          <div>
                            <div>HIGH CONFIDENCE CHANGE DETECTED — {totalRegions} region{totalRegions > 1 ? "s" : ""} require review</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#f87171", marginTop: 2 }}>
                              Severity: {severity} {highConfRegions > 0 ? `· ${highConfRegions} high-confidence region${highConfRegions > 1 ? "s" : ""}` : ""}
                            </div>
                          </div>
                        </div>
                      )}
                      {lowSsim && (
                        <div style={{
                          background: "rgba(245,158,11,0.12)",
                          border: "1px solid rgba(245,158,11,0.4)",
                          color: "#fbbf24",
                          padding: "12px 18px", borderRadius: 8, marginBottom: 12,
                          fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 10,
                        }}>
                          <span style={{ fontSize: 18 }}>⚠️</span>
                          <span>SIGNIFICANT SCENE CHANGE — possible major event or data quality issue (SSIM: {result.ssim.toFixed(4)})</span>
                        </div>
                      )}
                      {severity === "INFO" && totalRegions === 0 && !lowSsim && (
                        <div style={{
                          background: "rgba(52,211,153,0.1)",
                          border: "1px solid rgba(52,211,153,0.3)",
                          color: "#34d399",
                          padding: "12px 18px", borderRadius: 8, marginBottom: 12,
                          fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 10,
                        }}>
                          <span style={{ fontSize: 18 }}>✅</span>
                          <span>Clean analysis — no significant changes detected above threshold</span>
                        </div>
                      )}
                    </>
                  );
                })()}

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
                    <span style={{ fontSize: 13, letterSpacing: "0.12em", color: result.ssim < 0.20 ? "#fb4765" : "#f59e0b" }}>ALERT</span>
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
                    label="Visual Flags"
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
                  fontSize: 13,
                  color: "#4a7a9b",
                  fontFamily: "monospace",
                  marginBottom: 16,
                  letterSpacing: "0.03em"
                }}>
                  {preliminaryReview ? (
                    <>
                      {highFlagCount} visual flags |{" "}
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

                {/* All filtered message */}
                {highFlagCount === 0 && result.regionsFiltered > 0 && (
                  <div style={{
                    background: "rgba(245,158,11,0.1)", border: "1px solid #f59e0b",
                    color: "#facc15", padding: "12px 16px", borderRadius: 8, marginBottom: 12,
                    fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <span>All regions filtered — lower False Positive Filter to see candidates</span>
                  </div>
                )}

                {/* Alignment caption */}
                <div style={{ color: "#4a6a85", fontSize: 13, marginBottom: 16, display: "flex", gap: 16, flexWrap: "wrap" }}>
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
                  <div style={{ color: "#7dd3fc", fontSize: 13, marginTop: -16, marginBottom: 22 }}>
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
                        <div style={{ color: "#8ba3bd", fontSize: 13, marginTop: -4, marginBottom: 10 }}>
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
                  {preliminaryReview && highFlagCount === 0 && result.detectionCount > 0
                    ? `✓ 0 high-confidence flags — ${result.detectionCount} preliminary candidates below threshold. Adjust False Positive Filter or Confidence slider to review.`
                    : preliminaryReview && highFlagCount === 0
                      ? "✓ 0 high-confidence flags — no candidates above threshold."
                      : preliminaryReview
                        ? `${highFlagCount} visual flag(s) identified. Manual verification required.`
                        : `${result.detectionCount} change candidate(s) identified for analyst inspection`}
                  {result.regionsFiltered > 0 && (
                    <span style={{ color: "#f59e0b", fontSize: 13, fontWeight: 600, marginLeft: 12 }}>
                      ({result.regionsFiltered} regions filtered as noise)
                    </span>
                  )}
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
                <TimelineAnalysis result={result} />

                <SpatialIntelligencePanel
                  result={result}
                  topLeftCoord={topLeftCoord}
                  bottomRightCoord={bottomRightCoord}
                />

                {/* Export */}
                <SectionHeader label="Export Report" />
                <div style={{
                  display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap",
                }}>
                  <input
                    value={analystName}
                    onChange={e => setAnalystName(e.target.value)}
                    placeholder="Enter analyst name"
                    style={{
                      flex: "1 1 200px", minWidth: 180,
                      background: "#0a1624", border: "1px solid #18283e",
                      borderRadius: 6, padding: "8px 12px",
                      color: "#e8f2ff", fontSize: 13, outline: "none",
                      fontFamily: "inherit",
                    }}
                  />
                  {reportId && (
                    <div
                      onClick={() => navigator.clipboard.writeText(reportId)}
                      title="Click to copy"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.25)",
                        borderRadius: 6, padding: "6px 12px",
                        color: "#7dd3fc", fontSize: 13, fontWeight: 700,
                        cursor: "pointer", fontFamily: "monospace", letterSpacing: "0.06em",
                        userSelect: "none",
                      }}
                    >
                      <span>{reportId}</span>
                      <span style={{ fontSize: 12, color: "#4a6a85" }}>📋</span>
                    </div>
                  )}
                </div>
                <ExportSection
                  result={result}
                  validationMetrics={buildValidationMetrics(result, validationGroundTruth)}
                  secureMode={secureMode}
                  classificationLevel={classificationLevel}
                  analystName={analystName}
                  analystOrg={analystOrg}
                  caseReference={caseReference}
                  reportId={reportId}
                />

                <AuditLogPanel
                  entries={auditLog}
                  onClear={() => setAuditLog([])}
                />
              </div>
            )}
          </div>
        )}
      </main>

    </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      marginTop: 24,
      marginBottom: 12,
      paddingTop: 14,
      paddingLeft: 10,
      borderTop: "1px solid #12293d",
      borderLeft: "2px solid #38bdf8",
    }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: "#e8f2ff", letterSpacing: "0" }}>{label}</h2>
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
        fontSize: 13,
        fontWeight: 700,
        padding: "9px 12px",
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function ProgressPanel({ stages, progress }: { stages: string[]; progress: { pct: number; stage: number; startTime: number } | null }) {
  const elapsed = progress ? Math.round(performance.now() - progress.startTime) : 0;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "50px 40px", gap: 20,
      background: "#0a1624", border: "1px solid #18283e",
      borderRadius: 8,
    }}>
      <div style={{ color: "#7db7e5", fontSize: 14, fontWeight: 700 }}>Running analysis…</div>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{
          width: "100%", height: 8, background: "#18283e", borderRadius: 4, overflow: "hidden",
          marginBottom: 12,
        }}>
          <div style={{
            width: `${progress?.pct ?? 0}%`, height: "100%",
            background: "linear-gradient(90deg, #38bdf8, #7dd3fc)",
            borderRadius: 4, transition: "width 0.2s ease",
          }} />
        </div>
        {stages.map((label, i) => {
          const done = (progress?.pct ?? 0) >= stagePctBoundary(i + 1);
          const active = progress?.stage === i;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "6px 0",
              color: done ? "#34d399" : active ? "#e0f2fe" : "#4a6a85",
              fontWeight: done || active ? 700 : 400,
              fontSize: 13,
              transition: "color 0.3s ease",
            }}>
              <span style={{ fontSize: 14 }}>{done ? "✅" : active ? "⏳" : "⏺"}</span>
              <span>{label}</span>
              {active && (
                <span style={{ marginLeft: "auto", color: "#38bdf8", fontSize: 12, fontWeight: 700 }}>
                  {Math.round(progress?.pct ?? 0)}%
                </span>
              )}
              {done && i === stages.length - 1 && (
                <span style={{ marginLeft: "auto", color: "#34d399", fontSize: 12, fontWeight: 600 }}>
                  {elapsed}ms
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ color: "#4a6a85", fontSize: 12, fontFamily: "monospace" }}>
        {elapsed}ms elapsed
      </div>
    </div>
  );

  function stagePctBoundary(stage: number) {
    const boundaries = [0, 15, 35, 55, 75, 90, 100];
    return boundaries[stage] ?? 100;
  }
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
        borderRadius: "0 8px 8px 0",
        padding: "13px 16px",
        marginBottom: 12,
        display: "grid",
        gridTemplateColumns: "minmax(160px, 0.8fr) minmax(0, 2.2fr)",
        gap: 14,
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ color: "#7db7e5", fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800, marginBottom: 4 }}>
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
      <div style={{ color: isVeryLow ? "#ffd6df" : "#9fb5cc", fontSize: 13, lineHeight: 1.5 }}>
        {result.scoringNote}
      </div>
    </div>
  );
}
