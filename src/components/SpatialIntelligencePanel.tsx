import { useState, useEffect, useMemo } from "react";
import type { AnalysisResult } from "../types";
import { parseGeoBounds, pixelToLatLng } from "../utils/geoBounds";

interface Props {
  result: AnalysisResult;
  topLeftCoord: string;
  bottomRightCoord: string;
}

function downloadBlob(data: string, filename: string, mime: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function quote(s: string): string {
  return `"${s.replace(/"/g, "\"\"")}"`;
}

export default function SpatialIntelligencePanel({ result, topLeftCoord, bottomRightCoord }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = result.images.annotatedImage || result.images.baseImage;
  }, [result.images.annotatedImage, result.images.baseImage]);

  const geoBounds = useMemo(
    () => parseGeoBounds(topLeftCoord, bottomRightCoord),
    [topLeftCoord, bottomRightCoord],
  );

  const rows = useMemo(() => {
    return result.detections.map((d) => {
      const [, , bw, bh] = d.bbox;
      const aspect = bh > 0 ? (bw / bh).toFixed(3) : "—";
      let geo: { lat: number; lng: number } | null = null;
      if (geoBounds && imgSize) {
        geo = pixelToLatLng(d.pixelCenter[0], d.pixelCenter[1], imgSize.w, imgSize.h, geoBounds);
      }
      return { d, aspect, geo };
    });
  }, [result.detections, geoBounds, imgSize]);

  const handleExportCSV = () => {
    const hasGeo = geoBounds !== null && imgSize !== null;
    const headers = [
      "Object ID",
      "Pixel X",
      "Pixel Y",
      "Size px2",
      "Aspect Ratio",
      "Confidence",
    ];
    if (hasGeo) headers.push("Latitude", "Longitude");

    const dataRows = rows.map(({ d, aspect, geo }) => {
      const vals = [
        `OBJ-${String(d.id).padStart(3, "0")}`,
        String(d.pixelCenter[0]),
        String(d.pixelCenter[1]),
        String(d.areaPx),
        aspect,
        `${d.score}/100`,
      ];
      if (hasGeo && geo) vals.push(geo.lat.toFixed(6), geo.lng.toFixed(6));
      return vals.map((v) => quote(v)).join(",");
    });

    const csv = [headers.join(","), ...dataRows].join("\n");
    downloadBlob(csv, "spatial_intelligence_data.csv", "text/csv");
  };

  return (
    <div
      style={{
        background: "#0a1624",
        border: "1px solid #18283e",
        borderRadius: 8,
        marginTop: 20,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          cursor: "pointer",
          userSelect: "none",
          background: "#0d1f35",
          borderBottom: collapsed ? "none" : "1px solid #18283e",
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🌐</span>
          <span style={{ fontWeight: 800, fontSize: 13, color: "#38bdf8", letterSpacing: "0.06em" }}>
            SPATIAL PARAMETERS
          </span>
          <span style={{ fontSize: 11, color: "#4a6a85", fontWeight: 400 }}>
            ({result.detections.length} object{result.detections.length !== 1 ? "s" : ""})
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setCollapsed((c) => !c); }}
          style={{
            background: "none",
            border: "none",
            color: "#4a6a85",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 700,
            padding: "2px 8px",
          }}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? "▲" : "▼"}
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: "14px" }}>
          {result.detections.length === 0 ? (
            <div style={{ color: "#4a6a85", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
              No spatial data available.
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 500, fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #18283e" }}>
                      <th style={{ textAlign: "left", padding: "6px 8px", color: "#7db7e5", fontWeight: 700 }}>Object ID</th>
                      <th style={{ textAlign: "left", padding: "6px 8px", color: "#7db7e5", fontWeight: 700 }}>Pixel (x, y)</th>
                      <th style={{ textAlign: "right", padding: "6px 8px", color: "#7db7e5", fontWeight: 700 }}>Size (px²)</th>
                      <th style={{ textAlign: "right", padding: "6px 8px", color: "#7db7e5", fontWeight: 700 }}>Aspect Ratio</th>
                      <th style={{ textAlign: "right", padding: "6px 8px", color: "#7db7e5", fontWeight: 700 }}>Confidence</th>
                      {geoBounds && imgSize && (
                        <th style={{ textAlign: "left", padding: "6px 8px", color: "#7db7e5", fontWeight: 700 }}>
                          Geographic (lat, lng)
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ d, aspect, geo }) => (
                      <tr key={d.id} style={{ borderBottom: "1px solid #0f1e30" }}>
                        <td style={{ padding: "6px 8px", color: "#38bdf8", fontWeight: 700, fontFamily: "monospace" }}>
                          OBJ-{String(d.id).padStart(3, "0")}
                        </td>
                        <td style={{ padding: "6px 8px", color: "#9fb5cc", fontFamily: "monospace" }}>
                          [{d.pixelCenter[0]}, {d.pixelCenter[1]}]
                        </td>
                        <td style={{ padding: "6px 8px", color: "#9fb5cc", textAlign: "right", fontFamily: "monospace" }}>
                          {d.areaPx.toLocaleString()}
                        </td>
                        <td style={{ padding: "6px 8px", color: "#9fb5cc", textAlign: "right", fontFamily: "monospace" }}>
                          {aspect}
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace" }}>
                          <span style={{ color: d.score > 70 ? "#34d399" : d.score >= 50 ? "#f59e0b" : "#fb4765", fontWeight: 700 }}>
                            {d.score}/100
                          </span>
                        </td>
                        {geoBounds && imgSize && geo && (
                          <td style={{ padding: "6px 8px", color: "#22d3ee", fontFamily: "monospace" }}>
                            {geo.lat.toFixed(4)}, {geo.lng.toFixed(4)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={handleExportCSV}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    background: "#0d1f35",
                    border: "1px solid #1e4870",
                    borderRadius: 6,
                    color: "#38bdf8",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    fontFamily: "inherit",
                  }}
                >
                  <span>📤</span>
                  EXPORT SPATIAL DATA
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
