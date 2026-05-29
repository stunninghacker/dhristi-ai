import { useState } from "react";
import type { AnalysisResult, ValidationMetricsReport } from "../types";
import { jsPDF } from "jspdf";
import { getReliabilityPossibleCauses } from "../utils/reliabilityCauses";
import { countVisualFlagRegions } from "../utils/preliminary";

function downloadBlob(data: string | Blob, filename: string, mime: string) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function safeText(s: string): string {
  return s.replace(/[^\x00-\x7E]/g, (c) => {
    const map: Record<string, string> = { "—": "-", "–": "-", "•": "-", "→": "->", "²": "2" };
    return map[c] ?? "?";
  });
}

function quoteCSV(value: string): string {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function formatGeoPoint(point: [number, number] | null): string {
  return point ? `[${point.join(", ")}]` : "";
}

function formatGeoBBox(bbox: [number, number, number, number] | null): string {
  return bbox ? `[${bbox.join(", ")}]` : "";
}

function formatAreaM2(areaM2: number | null): string {
  return areaM2 === null ? "" : areaM2.toFixed(2);
}

function classifyDetection(areaPx: number, compactness: number): string {
  if (compactness < 0.25) return "MOVEMENT CORRIDOR";
  if (areaPx > 1200 && compactness < 0.45) return "TERRAIN CHANGE";
  if (areaPx < 400 && compactness > 0.55) return "VEHICLE/EQUIPMENT";
  if (areaPx > 800) return "INFRASTRUCTURE";
  if (compactness > 0.75) return "FORTIFICATION";
  return "UNKNOWN OBJECT";
}

export default function ExportSection({
  result,
  validationMetrics,
  secureMode = false,
  classificationLevel = "UNCLASSIFIED",
  analystName = "",
  analystOrg = "",
  caseReference = "",
  reportId = "",
}: {
  result: AnalysisResult;
  validationMetrics: ValidationMetricsReport;
  secureMode?: boolean;
  classificationLevel?: string;
  analystName?: string;
  analystOrg?: string;
  caseReference?: string;
  reportId?: string;
}) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [fullJsonOpen, setFullJsonOpen] = useState(false);
  const reliabilityPossibleCauses = getReliabilityPossibleCauses(result.sceneComparability);
  const visualFlagCount = countVisualFlagRegions(result.detections);

  const exportPayload = {
    ...result,
    reportMetadata: {
      reportId,
      analyst: analystName,
      organization: analystOrg,
      caseReference,
      classificationLevel: secureMode ? classificationLevel : undefined,
      secureMode,
    },
    highPriorityFlags: visualFlagCount,
    images: undefined,
    detections: result.detections.map(detection => ({
      ...detection,
      geo_center: detection.geoCenter,
      geo_bbox: detection.geoBBox,
      area_m2: detection.areaM2,
      analyst_decision: detection.analystDecision,
      analyst_notes: detection.analystNote,
      reviewed_status: detection.reviewed,
    })),
    reliabilityPossibleCauses,
    validationMetrics,
  };

  const downloadCSV = () => {
    if (!result.detections.length) {
      const metaCsv = [
        `# Report ID,${quoteCSV(reportId)}`,
        `# Analyst,${quoteCSV(analystName || "Unnamed")}`,
        `# Generated,${quoteCSV(result.timestampUtc)}`,
        "",
        "id,type,priority,score,area_px,assessment,analyst_decision,analyst_notes,reviewed_status,ssim,sceneComparability,reliability\n",
      ].join("\n");
      downloadBlob(metaCsv, "satellite_detection_log.csv", "text/csv");
      return;
    }
    const headers = ["id", "type", "priority", "score", "areaPx", "compactness", "meanDelta", "pixelCenter", "geo_center", "geo_bbox", "area_m2", "gridRef", "assessment", "analyst_decision", "analyst_notes", "reviewed_status", "ssim", "sceneComparability", "reliability", "preliminaryMode", "manualVerificationRequired", "detectionsAreConfirmed", "visibleRegionLimit", "totalReviewRegions"];
    const rows = result.detections.map(d =>
      [
        d.id,
        quoteCSV(d.type),
        d.priority,
        d.score,
        d.areaPx,
        d.compactness,
        d.meanDelta,
        quoteCSV(`[${d.pixelCenter.join(", ")}]`),
        quoteCSV(formatGeoPoint(d.geoCenter)),
        quoteCSV(formatGeoBBox(d.geoBBox)),
        formatAreaM2(d.areaM2),
        quoteCSV(d.gridRef),
        quoteCSV(result.sceneComparability === "VERY LOW" ? "Not confirmed change" : "Analyst review"),
        quoteCSV(d.analystDecision),
        quoteCSV(d.analystNote),
        d.reviewed,
        result.ssim,
        quoteCSV(result.sceneComparability),
        result.reliability,
        result.preliminaryMode,
        result.manualVerificationRequired,
        result.detectionsAreConfirmed,
        result.visibleRegionLimit,
        result.totalReviewRegions,
      ].join(",")
    );
    const metaRows = [
      `# Report ID,${quoteCSV(reportId)}`,
      `# Analyst,${quoteCSV(analystName || "Unnamed")}`,
      `# Generated,${quoteCSV(result.timestampUtc)}`,
      `# Profile,${quoteCSV(result.profile)}`,
      "",
    ];
    downloadBlob([...metaRows, headers.join(","), ...rows].join("\n"), "satellite_detection_log.csv", "text/csv");
  };

  const downloadAnnotated = () => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      if (secureMode) {
        ctx.save();
        ctx.font = `bold ${Math.max(14, c.width * 0.025)}px monospace`;
        ctx.fillStyle = "rgba(255,200,50,0.35)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const watermarkText = `PRELIMINARY — NOT FOR DISTRIBUTION [${classificationLevel}]`;
        const cx = c.width / 2, cy = c.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(-Math.PI / 6);
        ctx.fillText(watermarkText, 0, 0);
        ctx.restore();
      }
      c.toBlob(blob => {
        if (blob) downloadBlob(blob, "annotated_review_zones.png", "image/png");
      });
    };
    img.src = result.images.annotatedImage;
  };

  const downloadJSON = () => {
    downloadBlob(JSON.stringify(exportPayload, null, 2), "satellite_analysis_report.json", "application/json");
  };

  const downloadPDF = async () => {
    setPdfLoading(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210, ML = 15, MR = 15, TW = W - ML - MR;
      let y = 20;

      const line = (text: string, size = 10, bold = false, color = [230, 242, 255] as [number, number, number]) => {
        doc.setFontSize(size);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(...color);
        doc.text(safeText(text), ML, y);
        y += size * 0.45 + 3;
        if (y > 270) { doc.addPage(); y = 20; }
      };

      const gap = (mm = 4) => { y += mm; };

      const headerId = `${caseReference || "N/A"} / ${result.timestampUtc.replace(/[/:]/g, "-")}`;

      // ── Page background ──
      doc.setFillColor(8, 13, 22);
      doc.rect(0, 0, 210, 297, "F");

      // ── Security banner ──
      if (secureMode) {
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(251, 191, 36);
        doc.text(safeText(`CLASSIFICATION: ${classificationLevel} — PRELIMINARY — NOT FOR DISTRIBUTION`), ML, y);
        doc.text(safeText(headerId), W - MR, y, { align: "right" });
        y += 6;
      }

      // ═══════════════════════════════════════════════
      // HEADER
      // ═══════════════════════════════════════════════
      doc.setDrawColor(56, 189, 248);
      doc.setLineWidth(1.2);
      doc.line(ML, y, ML + TW, y);
      y += 4;

      line("DHRISTI INTELLIGENCE REPORT", 20, true, [255, 255, 255]);
      line(`Classification: ${secureMode ? classificationLevel : "UNCLASSIFIED"} // FOR TRAINING USE ONLY`, 8, false, [251, 191, 36]);
      gap(2);
      doc.setDrawColor(30, 53, 84);
      doc.setLineWidth(0.4);
      doc.line(ML, y, ML + TW, y);
      gap(4);
      line(`Report ID: ${reportId || "N/A"}`, 9, false, [180, 200, 220]);
      line(`Date/Time: ${result.timestampUtc} UTC`, 9, false, [180, 200, 220]);
      line(`Analyst: ${analystName || "Unnamed"}`, 9, false, [180, 200, 220]);
      line(`Organization: ${analystOrg || "N/A"}`, 9, false, [180, 200, 220]);
      line(`Profile: ${result.profile}`, 9, false, [180, 200, 220]);
      gap(6);

      // ═══════════════════════════════════════════════
      // 1. EXECUTIVE SUMMARY
      // ═══════════════════════════════════════════════
      line("1. EXECUTIVE SUMMARY", 13, true, [56, 189, 248]);
      gap(2);
      doc.setDrawColor(56, 189, 248);
      doc.setLineWidth(0.3);
      doc.line(ML, y, ML + 24, y);
      gap(3);

      const imagePairDesc = result.timeline
        ? `${result.timeline.baselineDate || "T1"} / ${result.timeline.recentDate || "T2"}`
        : "the provided satellite imagery";
      const summarySentences = [
        `Analysis of ${imagePairDesc} identified ${result.detectionCount} object(s) across ${result.changedAreaPct.toFixed(3)}% of the scene.`,
        `Confidence rating: ${result.confidence}/100. Reliability tier: ${result.reliability}.`,
        `This assessment is based on automated SSIM-based change detection and requires human analyst verification before operational use.`,
      ];
      for (const s of summarySentences) {
        doc.setFontSize(9.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(200, 220, 240);
        const wrapped = doc.splitTextToSize(safeText(s), TW);
        for (const l of wrapped) {
          doc.text(l, ML, y);
          y += 5;
          if (y > 270) { doc.addPage(); y = 20; }
        }
        gap(1);
      }
      gap(4);

      // ═══════════════════════════════════════════════
      // 2. DETECTED OBJECTS TABLE
      // ═══════════════════════════════════════════════
      line("2. DETECTED OBJECTS", 13, true, [56, 189, 248]);
      gap(2);
      doc.setDrawColor(56, 189, 248);
      doc.setLineWidth(0.3);
      doc.line(ML, y, ML + 24, y);
      gap(3);

      if (result.detections.length === 0) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(180, 200, 220);
        doc.text("No objects detected above the selected threshold.", ML, y);
        y += 6;
      } else {
        const colX = [ML, ML + 10, ML + 50, ML + 80, ML + 105, ML + 130, ML + 165];
        const headers = ["#", "Object Type", "Priority", "Score", "Coord X", "Coord Y"];
        const hdrColor: [number, number, number] = [56, 189, 248];
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...hdrColor);
        for (let i = 0; i < headers.length; i++) {
          doc.text(safeText(headers[i]), colX[i], y);
        }
        y += 5.5;
        doc.setDrawColor(56, 189, 248);
        doc.setLineWidth(0.2);
        doc.line(ML, y, ML + TW, y);
        y += 2;

        for (const d of result.detections) {
          const objType = classifyDetection(d.areaPx, d.compactness);
          const row = [
            String(d.id),
            objType,
            d.priority,
            `${d.score}/100`,
            String(Math.round(d.pixelCenter[0])),
            String(Math.round(d.pixelCenter[1])),
          ];
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(200, 220, 240);
          for (let i = 0; i < row.length; i++) {
            doc.text(safeText(row[i]), colX[i], y);
          }
          y += 5;
          if (y > 270) { doc.addPage(); y = 20; }
        }
      }
      gap(5);

      // ═══════════════════════════════════════════════
      // 3. CHANGE ANALYSIS
      // ═══════════════════════════════════════════════
      if (y > 240) { doc.addPage(); y = 20; }
      line("3. CHANGE ANALYSIS METRICS", 13, true, [56, 189, 248]);
      gap(2);
      doc.setDrawColor(56, 189, 248);
      doc.setLineWidth(0.3);
      doc.line(ML, y, ML + 24, y);
      gap(3);

      const changeMetrics: [string, string][] = [
        ["SSIM Score", result.ssim.toFixed(4)],
        ["Mean Absolute Difference (MAD)", `${validationMetrics.meanAbsoluteDifference.toFixed(2)} intensity units`],
        ["PSNR", validationMetrics.psnr === null ? "Infinity dB" : `${validationMetrics.psnr.toFixed(2)} dB`],
        ["Registration Shift", `X: ${validationMetrics.registrationShift[0]}px, Y: ${validationMetrics.registrationShift[1]}px`],
        ["Changed Area", `${result.changedAreaPct.toFixed(3)}% of scene`],
        ["Max Detection Score", `${result.maxScore}/100`],
        ["Detection Count", String(result.detectionCount)],
        ["Alignment Score", `${result.alignmentScore}/100`],
        ["Brightness Delta", String(result.brightnessDelta)],
        ["Contrast Delta", String(result.contrastDelta)],
      ];
      doc.setFontSize(8.5);
      for (const [k, v] of changeMetrics) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(127, 183, 229);
        doc.text(safeText(k), ML, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(200, 220, 240);
        doc.text(safeText(v), ML + 90, y);
        y += 5.5;
        if (y > 270) { doc.addPage(); y = 20; }
      }
      gap(5);

      // ── Scene imagery ──
      line("SCENE IMAGERY", 12, true, [56, 189, 248]);
      gap(3);
      const imgW = 44;
      const imgH = 48;
      if (result.images.baseImage) doc.addImage(result.images.baseImage, "JPEG", ML, y, imgW, imgH);
      if (result.images.recentImage) doc.addImage(result.images.recentImage, "JPEG", ML + imgW + 4, y, imgW, imgH);
      if (result.images.annotatedImage) doc.addImage(result.images.annotatedImage, "JPEG", ML + (imgW + 4) * 2, y, imgW, imgH);
      if (result.images.heatmapImage) doc.addImage(result.images.heatmapImage, "JPEG", ML + (imgW + 4) * 3, y, imgW, imgH);
      y += imgH + 4;
      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100, 130, 160);
      doc.text("Base Image    Recent Image    Annotated    Heatmap", ML, y);
      gap(8);

      // ═══════════════════════════════════════════════
      // QUALITY NOTES
      // ═══════════════════════════════════════════════
      if (result.qualityNotes.length > 0) {
        line("QUALITY NOTES", 11, true, [56, 189, 248]);
        gap(1);
        for (const note of result.qualityNotes) {
          doc.setFontSize(8.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(200, 220, 240);
          const wrapped = doc.splitTextToSize(safeText(`- ${note}`), TW);
          for (const l of wrapped) {
            doc.text(l, ML, y);
            y += 5;
            if (y > 270) { doc.addPage(); y = 20; }
          }
        }
        gap(4);
      }

      // ═══════════════════════════════════════════════
      // 4. ANALYST ASSESSMENT
      // ═══════════════════════════════════════════════
      if (y > 230) { doc.addPage(); y = 20; }
      line("4. ANALYST ASSESSMENT", 13, true, [56, 189, 248]);
      gap(2);
      doc.setDrawColor(56, 189, 248);
      doc.setLineWidth(0.3);
      doc.line(ML, y, ML + 24, y);
      gap(3);

      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(127, 183, 229);
      doc.text("Manual notes and assessment:", ML, y);
      y += 5;
      doc.setDrawColor(56, 189, 248);
      doc.setLineWidth(0.3);
      doc.setFillColor(10, 20, 35);
      doc.roundedRect(ML, y, TW, 40, 2, 2, "FD");
      y += 44;
      gap(2);

      // ═══════════════════════════════════════════════
      // 5. DISCLAIMER
      // ═══════════════════════════════════════════════
      if (y > 240) { doc.addPage(); y = 20; }
      line("5. DISCLAIMER", 13, true, [56, 189, 248]);
      gap(2);
      doc.setDrawColor(56, 189, 248);
      doc.setLineWidth(0.3);
      doc.line(ML, y, ML + 24, y);
      gap(3);

      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(180, 200, 220);
      const disclaimer = "This report was generated by automated AI analysis. All findings require human analyst verification before operational use.";
      const disclaimerWrapped = doc.splitTextToSize(safeText(disclaimer), TW);
      for (const l of disclaimerWrapped) {
        doc.text(l, ML, y);
        y += 5;
      }

      y = Math.max(y, 275);
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 110, 140);
      doc.text(safeText(`DHRISTI — Defence Satellite Intelligence Platform — Report ${reportId || "N/A"} — ${result.timestampUtc}`), ML, y);

      doc.save("satellite_analysis_report.pdf");
    } catch (e) {
      console.error("PDF export error:", e);
      alert("PDF export failed. Please try downloading JSON instead.");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownload = (i: number) => {
    if (i === 0) downloadCSV();
    else if (i === 1) downloadAnnotated();
    else if (i === 2) downloadJSON();
    else if (i === 3 && !pdfLoading) downloadPDF();
  };

  const compact = {
    timestampUtc: result.timestampUtc,
    profile: result.profile,
    analysisPriority: result.analysisPriority,
    changedAreaPct: result.changedAreaPct,
    detectionCount: result.detectionCount,
    highPriorityFlags: visualFlagCount,
    confidence: result.confidence,
    ssim: result.ssim,
    reliability: result.reliability,
    sceneComparability: result.sceneComparability,
    reliabilityGateApplied: result.reliabilityGateApplied,
    scoringNote: result.scoringNote,
    manualVerificationRequired: result.manualVerificationRequired,
    detectionsAreConfirmed: result.detectionsAreConfirmed,
    preliminaryMode: result.preliminaryMode,
    visibleRegionLimit: result.visibleRegionLimit,
    totalReviewRegions: result.totalReviewRegions,
    qualityNotes: result.qualityNotes,
    reliabilityPossibleCauses,
    geoMetadata: result.geoMetadata,
    validationMetrics,
  };

  const buttons = [
    { label: "Download CSV", sub: result.sceneComparability === "VERY LOW" ? "Review log" : "Detection log", icon: "📊" },
    { label: "Download Image", sub: "Annotated Map", icon: "🖼" },
    { label: "Download JSON", sub: "Full report", icon: "📋" },
    { label: pdfLoading ? "Generating…" : "Download PDF", sub: "Analysis report", icon: "📄" },
  ];

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          padding: "20px 0",
        }}
      >
        {buttons.map((btn, i) => (
          <button
            key={i}
            onClick={() => handleDownload(i)}
            disabled={i === 3 && pdfLoading}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "18px 12px",
              background: "#0d1f35",
              border: "1px solid #1e4870",
              borderRadius: 8,
              color: "#3ab5ff",
              cursor: i === 3 && pdfLoading ? "wait" : "pointer",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.06em",
              fontFamily: "inherit",
              opacity: i === 3 && pdfLoading ? 0.7 : 1,
            }}
          >
            <span style={{ fontSize: 24 }}>{btn.icon}</span>
            <span style={{ color: "#3ab5ff" }}>{btn.label}</span>
            <span style={{ fontSize: 13, color: "#4a7a9b", fontWeight: 400 }}>{btn.sub}</span>
          </button>
        ))}
      </div>

      <Expander label="Compact JSON Summary" open={jsonOpen} onToggle={() => setJsonOpen(o => !o)}>
        <pre
          style={{
            color: "#7dd3fc",
            fontSize: 13,
            overflowX: "auto",
            lineHeight: 1.6,
            margin: 0,
            fontFamily: "monospace",
            background: "#06101a",
          }}
        >
          {JSON.stringify(compact, null, 2)}
        </pre>
      </Expander>

      <Expander label="Full JSON Analysis Output" open={fullJsonOpen} onToggle={() => setFullJsonOpen(o => !o)}>
        <pre
          style={{
            color: "#9fb5cc",
            fontSize: 13,
            overflowX: "auto",
            lineHeight: 1.5,
            maxHeight: 420,
            margin: 0,
            fontFamily: "monospace",
            background: "#06101a",
          }}
        >
          {JSON.stringify(exportPayload, null, 2)}
        </pre>
      </Expander>
    </div>
  );
}

function Expander({ label, open, onToggle, children }: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ border: "1px solid #18283e", borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          background: "#0a1420",
          border: "none",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          padding: "10px 14px",
          color: "#9fb5cc",
          fontFamily: "inherit",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13, color: "#9fb5cc" }}>{label}</span>
        <span style={{ fontSize: 13, color: "#4a6a85" }}>{open ? "▲ collapse" : "▼ expand"}</span>
      </button>
      {open && (
        <div style={{ background: "#06101a", padding: "12px 14px" }}>
          {children}
        </div>
      )}
    </div>
  );
}


