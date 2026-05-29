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

export default function ExportSection({
  result,
  validationMetrics,
  secureMode = false,
  classificationLevel = "UNCLASSIFIED",
  analystName = "",
  analystOrg = "",
  caseReference = "",
}: {
  result: AnalysisResult;
  validationMetrics: ValidationMetricsReport;
  secureMode?: boolean;
  classificationLevel?: string;
  analystName?: string;
  analystOrg?: string;
  caseReference?: string;
}) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [fullJsonOpen, setFullJsonOpen] = useState(false);
  const reliabilityPossibleCauses = getReliabilityPossibleCauses(result.sceneComparability);
  const visualFlagCount = countVisualFlagRegions(result.detections);

  const exportPayload = {
    ...result,
    reportMetadata: {
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
      downloadBlob("id,type,priority,score,area_px,geo_center,geo_bbox,area_m2,assessment,analyst_decision,analyst_notes,reviewed_status,ssim,sceneComparability,reliability,preliminaryMode,manualVerificationRequired,detectionsAreConfirmed,visibleRegionLimit,totalReviewRegions\n", "satellite_detection_log.csv", "text/csv");
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
    downloadBlob([headers.join(","), ...rows].join("\n"), "satellite_detection_log.csv", "text/csv");
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

      if (secureMode) {
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(251, 191, 36);
        doc.text(safeText(`CLASSIFICATION: ${classificationLevel} — PRELIMINARY — NOT FOR DISTRIBUTION`), ML, y);
        doc.text(safeText(headerId), W - MR, y, { align: "right" });
        y += 6;
      }

      doc.setFillColor(8, 13, 22);
      doc.rect(0, 0, 210, 297, "F");
      doc.setDrawColor(56, 189, 248);
      doc.setLineWidth(1.2);
      doc.line(ML, y - 4, ML + TW, y - 4);

      line("AI-BASED SATELLITE INTELLIGENCE SYSTEM", 18, true, [255, 255, 255]);
      line("Formal Analysis Report", 10, false, [139, 163, 189]);
      gap(2);
      doc.setDrawColor(30, 53, 84);
      doc.setLineWidth(0.4);
      doc.line(ML, y, ML + TW, y);
      gap(5);

      line(`Document ID: ${headerId}`, 9, false, [139, 163, 189]);
      line(`Analyst: ${analystName || "Unnamed"}`, 9, false, [139, 163, 189]);
      line(`Organization: ${analystOrg || "N/A"}`, 9, false, [139, 163, 189]);
      line(`Case Ref: ${caseReference || "N/A"}`, 9, false, [139, 163, 189]);
      line(`Profile: ${result.profile}`, 9, false, [139, 163, 189]);
      gap(4);

      line("ANALYSIS SUMMARY", 12, true, [56, 189, 248]);
      gap(1);
      const summaryItems = [
        ["Analysis priority", result.analysisPriority],
        [result.sceneComparability === "VERY LOW" ? "Review surface" : "Changed area", `${result.changedAreaPct.toFixed(3)}%`],
        [result.sceneComparability === "VERY LOW" ? "Review regions" : "Detections", String(result.detectionCount)],
        ["Visual flags", String(visualFlagCount)],
        ["Max score", `${result.maxScore}/100`],
        ["Confidence", `${result.confidence}/100`],
        ["SSIM", result.ssim.toFixed(4)],
        ["Reliability", result.reliability],
        ["Scene comparability", result.sceneComparability],
        ["Gate applied", result.reliabilityGateApplied ? "true" : "false"],
        ["Preliminary mode", result.preliminaryMode ? "true" : "false"],
        ["Manual verification", result.manualVerificationRequired ? "true" : "false"],
        ["Detections confirmed", result.detectionsAreConfirmed ? "true" : "false"],
        ["Geo metadata", result.geoMetadata.available ? "Available" : "Not available"],
        ["Geo CRS", result.geoMetadata.crs ?? ""],
        ["Visible region limit", String(result.visibleRegionLimit)],
        ["Total review regions", String(result.totalReviewRegions)],
        ["Alignment score", `${result.alignmentScore}/100`],
        ["Brightness delta", String(result.brightnessDelta)],
        ["Contrast delta", String(result.contrastDelta)],
      ];
      for (const [k, v] of summaryItems) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(127, 183, 229);
        doc.text(safeText(`${k}:`), ML, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(230, 242, 255);
        doc.text(safeText(v), ML + 55, y);
        y += 5.5;
      }
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(127, 183, 229);
      doc.text("Scoring note:", ML, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(230, 242, 255);
      const scoringLines = doc.splitTextToSize(safeText(result.scoringNote), TW - 55);
      for (const l of scoringLines) {
        doc.text(l, ML + 55, y);
        y += 5;
        if (y > 270) { doc.addPage(); y = 20; }
      }
      gap(4);

      line("VALIDATION METRICS", 12, true, [56, 189, 248]);
      gap(1);
      const validationItems = [
        ["SSIM score", validationMetrics.ssimScore.toFixed(4)],
        ["Mean absolute difference", `${validationMetrics.meanAbsoluteDifference.toFixed(2)} intensity units`],
        ["PSNR", validationMetrics.psnr === null ? "Infinity dB" : `${validationMetrics.psnr.toFixed(2)} dB`],
        ["Registration shift", `X: ${validationMetrics.registrationShift[0]}px, Y: ${validationMetrics.registrationShift[1]}px`],
        ["Review region density", `${validationMetrics.reviewRegionDensityPct.toFixed(3)}%`],
        ["Confidence band", validationMetrics.confidenceBand],
        ["Confidence score", `${validationMetrics.confidenceScore}/100`],
        ["Manual verification required", validationMetrics.manualVerificationRequired ? "Yes" : "No"],
        ["True positives", valueOrBlank(validationMetrics.groundTruth.truePositives)],
        ["False positives", valueOrBlank(validationMetrics.groundTruth.falsePositives)],
        ["False negatives", valueOrBlank(validationMetrics.groundTruth.falseNegatives)],
        ["Precision", metricOrBlank(validationMetrics.precision)],
        ["Recall", metricOrBlank(validationMetrics.recall)],
        ["F1 score", metricOrBlank(validationMetrics.f1Score)],
      ];
      for (const [k, v] of validationItems) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(127, 183, 229);
        doc.text(safeText(`${k}:`), ML, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(230, 242, 255);
        doc.text(safeText(v), ML + 55, y);
        y += 5.5;
        if (y > 270) { doc.addPage(); y = 20; }
      }
      gap(4);

      line("QUALITY & RELIABILITY NOTES", 12, true, [56, 189, 248]);
      gap(1);
      if (reliabilityPossibleCauses.length > 0) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(253, 230, 138);
        const explanation = doc.splitTextToSize(
          "Low scene comparability may reflect one or more unmeasured factors. The following items are possible causes only.",
          TW,
        );
        for (const l of explanation) {
          doc.text(l, ML, y);
          y += 5;
          if (y > 270) { doc.addPage(); y = 20; }
        }
        for (const { status, cause } of reliabilityPossibleCauses) {
          doc.setTextColor(200, 220, 240);
          doc.text(safeText(`- ${status}: ${cause}`), ML, y);
          y += 5;
          if (y > 270) { doc.addPage(); y = 20; }
        }
        gap(2);
      }
      for (const note of result.qualityNotes) {
        doc.setFontSize(9);
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

      if (result.detections.length > 0) {
        line("DETECTION LOG", 12, true, [56, 189, 248]);
        gap(1);
        for (const d of result.detections) {
          const noteStr = d.analystNote ? ` | Note: ${d.analystNote}` : "";
          const assessment = result.sceneComparability === "VERY LOW" ? " | Not confirmed change" : "";
          const regionLabel = result.sceneComparability === "VERY LOW" ? "Review region" : "Zone";
          const geoCenter = d.geoCenter ? ` | geo_center ${formatGeoPoint(d.geoCenter)}` : "";
          const areaM2 = d.areaM2 === null ? "" : ` | area_m2 ${formatAreaM2(d.areaM2)}`;
          const analystDecision = ` | Decision: ${d.analystDecision}`;
          const reviewed = ` | Reviewed: ${d.reviewed ? "true" : "false"}`;
          const entry = `[${regionLabel} ${d.id}] ${d.type} | ${d.priority} | score ${d.score} | area ${d.areaPx}px | MGRS ${d.gridRef}${geoCenter}${areaM2}${assessment}${analystDecision}${reviewed}${noteStr}`;
          doc.setFontSize(8.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(200, 220, 240);
          const wrapped = doc.splitTextToSize(safeText(entry), TW);
          for (const l of wrapped) {
            doc.text(l, ML, y);
            y += 5;
            if (y > 270) { doc.addPage(); y = 20; }
          }
          gap(1);
        }
      }

      gap(6);
      if (y > 220) { doc.addPage(); y = 20; }
      line("SCENE IMAGERY OVERVIEW", 12, true, [56, 189, 248]);
      gap(2);

      const imgW = 46;
      const imgH = 50;

      if (result.images.baseImage) doc.addImage(result.images.baseImage, "JPEG", 12, y, imgW, imgH);
      if (result.images.recentImage) doc.addImage(result.images.recentImage, "JPEG", 62, y, imgW, imgH);
      if (result.images.annotatedImage) doc.addImage(result.images.annotatedImage, "JPEG", 112, y, imgW, imgH);
      if (result.images.heatmapImage) doc.addImage(result.images.heatmapImage, "JPEG", 162, y, imgW, imgH);

      y += imgH + 8;

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

function valueOrBlank(value: number | null): string {
  return value === null ? "" : String(value);
}

function metricOrBlank(value: number | null): string {
  return value === null ? "" : value.toFixed(4);
}
