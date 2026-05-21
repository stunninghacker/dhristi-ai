import { useEffect, useRef } from "react";
import type { Detection } from "../types";

interface Props {
  imageSrc: string;
  region: Detection | null;
}

export default function RegionPreview({ imageSrc, region }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !region) return;

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;

      const [x, y, w, h] = region.bbox;
      const pad = Math.max(24, Math.round(Math.max(w, h) * 0.45));
      const sx = Math.max(0, x - pad);
      const sy = Math.max(0, y - pad);
      const sw = Math.min(img.naturalWidth - sx, w + pad * 2);
      const sh = Math.min(img.naturalHeight - sy, h + pad * 2);

      canvas.width = 280;
      canvas.height = 150;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const scale = Math.min(canvas.width / sw, canvas.height / sh);
      const dw = sw * scale;
      const dh = sh * scale;
      const dx = (canvas.width - dw) / 2;
      const dy = (canvas.height - dh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    };
    img.src = imageSrc;

    return () => {
      cancelled = true;
    };
  }, [imageSrc, region]);

  if (!region) return null;

  return (
    <div style={{ marginBottom: 14, minWidth: 0 }}>
      <div style={{ color: "#4a8aaa", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 7 }}>
        Selected region preview
      </div>
      <canvas
        ref={canvasRef}
        width={280}
        height={150}
        style={{
          display: "block",
          width: "100%",
          maxWidth: "100%",
          height: 150,
          boxSizing: "border-box",
          background: "#020617",
          border: "1px solid #1e3a5a",
          borderRadius: 8,
          objectFit: "contain",
        }}
      />
    </div>
  );
}
