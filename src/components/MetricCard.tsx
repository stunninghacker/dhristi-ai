interface MetricCardProps {
  label: string;
  value?: string | number | null;
  subtext?: string;
  valueColor?: string;
}

function formatValue(value?: string | number | null): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "number" && isNaN(value)) return "—";
  return String(value);
}

export default function MetricCard({ label, value, subtext, valueColor = "#3ab5ff" }: MetricCardProps) {
  return (
    <div
      style={{
        background: "#091422",
        border: "1px solid #12293d",
        borderRadius: "8px",
        padding: "16px 14px",
        minWidth: "0",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          color: "#4a8aaa",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: "8px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "1.5rem",
          fontWeight: 900,
          color: valueColor,
          lineHeight: 1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {formatValue(value)}
      </div>
      {subtext && (
        <div
          style={{
            color: "#7f96ad",
            fontSize: 13,
            lineHeight: 1.35,
            marginTop: 8,
          }}
        >
          {subtext}
        </div>
      )}
    </div>
  );
}
