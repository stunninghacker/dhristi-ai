import { useRef, useState } from "react";
import { UploadIcon } from "./Icons";

interface UploadZoneProps {
  label: string;
  sublabel: string;
  file: File | null;
  onFile: (f: File) => void;
  previewUrl?: string;
}

export default function UploadZone({ label, sublabel, file, onFile, previewUrl }: UploadZoneProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleFile = (f: File) => {
    if (f && (f.type.startsWith("image/") || f.name.endsWith(".tif") || f.name.endsWith(".tiff"))) {
      onFile(f);
    }
  };

  return (
    <div
      className={`drop-zone${drag ? " drag-over" : ""}`}
      onClick={() => ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
    >
      <input
        ref={ref} type="file" accept="image/png,image/jpeg,image/jpg,.tif,.tiff"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      {previewUrl ? (
        <div>
          <img
            src={previewUrl}
            alt={label}
            style={{
              maxHeight: 120,
              maxWidth: "100%",
              borderRadius: 8,
              objectFit: "contain",
              background: "#020617",
              marginBottom: 8,
            }}
          />
          <div style={{ color: "#4fc3ff", fontSize: 12, fontWeight: 600 }}>{file?.name}</div>
          <div style={{ color: "#8ba3bd", fontSize: 11, marginTop: 2 }}>Click to replace</div>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <UploadIcon size={20} color="#38bdf8" />
            </div>
          </div>
          <div style={{ color: "#e8f2ff", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{label}</div>
          <div style={{ color: "#8ba3bd", fontSize: 12, marginBottom: 6 }}>{sublabel}</div>
          <div style={{ color: "#4a6a85", fontSize: 11 }}>PNG · JPG · TIFF · Click or drag & drop</div>
        </div>
      )}
    </div>
  );
}
