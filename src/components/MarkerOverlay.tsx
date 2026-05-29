import { useEffect, useMemo, useRef, useState } from "react";
import type { Detection } from "../types";

interface Props {
  regions: Detection[];
  selectedRegionId: number | null;
  onSelectRegion: (id: number | null) => void;
  imageWidth: number;
  imageHeight: number;
  preliminaryMode: boolean;
  showLabels?: boolean;
  tooltipRegionLabel?: (region: Detection, displayNumber: number) => string;
}

interface DisplayRect {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

interface OverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface MarkerLayout {
  region: Detection;
  index: number;
  marker: OverlayRect;
  badge: OverlayRect;
}

interface BadgeCluster {
  id: string;
  members: MarkerLayout[];
  badge: OverlayRect;
}

export default function MarkerOverlay({
  regions,
  selectedRegionId,
  onSelectRegion,
  imageWidth,
  imageHeight,
  preliminaryMode,
  showLabels = true,
  tooltipRegionLabel,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const display = useMemo<DisplayRect>(() => {
    if (!size.width || !size.height || !imageWidth || !imageHeight) {
      return { width: 0, height: 0, offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 };
    }

    const imageRatio = imageWidth / imageHeight;
    const containerRatio = size.width / size.height;
    const displayedImageWidth = containerRatio > imageRatio ? size.height * imageRatio : size.width;
    const displayedImageHeight = containerRatio > imageRatio ? size.height : size.width / imageRatio;

    return {
      width: displayedImageWidth,
      height: displayedImageHeight,
      offsetX: (size.width - displayedImageWidth) / 2,
      offsetY: (size.height - displayedImageHeight) / 2,
      scaleX: displayedImageWidth / imageWidth,
      scaleY: displayedImageHeight / imageHeight,
    };
  }, [imageHeight, imageWidth, size.height, size.width]);

  const uniqueRegions = useMemo(() => {
    const seenRegionIds = new Set<number>();

    return regions.filter(region => {
      if (seenRegionIds.has(region.id)) return false;
      seenRegionIds.add(region.id);
      return true;
    });
  }, [regions]);

  const layouts = useMemo<MarkerLayout[]>(() => {
    const markerLayouts = uniqueRegions.map((region, index) => {
      const [x, y, w, h] = region.bbox;

      return {
        region,
        index,
        marker: {
          left: display.offsetX + x * display.scaleX,
          top: display.offsetY + y * display.scaleY,
          width: w * display.scaleX,
          height: h * display.scaleY,
        },
      };
    });
    const usedBadges: OverlayRect[] = [];
    const badges = new Map<number, OverlayRect>();
    const badgeOrder = [...markerLayouts].sort((a, b) => {
      if (a.region.id === selectedRegionId) return -1;
      if (b.region.id === selectedRegionId) return 1;
      return a.index - b.index;
    });

    badgeOrder.forEach(layout => {
      const badge = placeBadge(
        layout.marker,
        display,
        usedBadges,
        markerLayouts.map(candidate => candidate.marker),
        layout.index,
        layout.index + 1,
      );
      usedBadges.push(badge);
      badges.set(layout.region.id, badge);
    });

    return markerLayouts.map(layout => ({
      ...layout,
      badge: badges.get(layout.region.id) ?? placeBadge(
        layout.marker,
        display,
        usedBadges,
        markerLayouts.map(candidate => candidate.marker),
        layout.index,
        layout.index + 1,
      ),
    }));
  }, [display, selectedRegionId, uniqueRegions]);

  const clusters = useMemo<BadgeCluster[]>(
    () => preliminaryMode ? clusterBadges(layouts, display) : [],
    [display, layouts, preliminaryMode],
  );
  const clusteredRegionIds = useMemo(
    () => new Set(clusters.flatMap(cluster => cluster.members.map(member => member.region.id))),
    [clusters],
  );
  const activeTooltipId = hoveredId ?? selectedRegionId;

  return (
    <div
      ref={ref}
      aria-label={preliminaryMode ? "Visual review regions" : "Review regions"}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {layouts.map(({ region, index, marker, badge }) => {
        const selected = selectedRegionId === region.id;
        const active = activeTooltipId === region.id;
        const occupiedRects = [
          ...layouts.flatMap(layout => layout.region.id === region.id ? [] : [layout.marker]),
          ...layouts.filter(layout => !clusteredRegionIds.has(layout.region.id)).map(layout => layout.badge),
          ...clusters.map(cluster => cluster.badge),
        ];
        const tooltip = showLabels && active ? placeTooltip(marker, display, occupiedRects) : null;
        const displayNumber = index + 1;

        return (
          <span key={region.id}>
            <button
              type="button"
              data-marker-control="true"
              aria-label={`${preliminaryMode ? "Review region" : "Region"} ${displayNumber}. ${region.type}. Score ${region.score}.`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectRegion(selected ? null : region.id);
              }}
              onFocus={() => setHoveredId(region.id)}
              onBlur={() => setHoveredId(current => current === region.id ? null : current)}
              onMouseEnter={() => setHoveredId(region.id)}
              onMouseLeave={() => setHoveredId(current => current === region.id ? null : current)}
              style={{
                position: "absolute",
                left: marker.left,
                top: marker.top,
                width: marker.width,
                height: marker.height,
                boxSizing: "border-box",
                appearance: "none",
                padding: 0,
                margin: 0,
                background: preliminaryMode
                  ? selected ? "rgba(125,211,252,0.14)" : "rgba(125,211,252,0.06)"
                  : "rgba(58,181,255,0.10)",
                border: preliminaryMode
                  ? `${selected ? 3 : 2}px dashed ${selected ? "#bdf4ff" : "#7dd3fc"}`
                  : `${selected ? 3 : 2}px solid ${selected ? "#ffffff" : "#3ab5ff"}`,
                borderRadius: 4,
                boxShadow: selected ? "0 0 0 3px rgba(125,211,252,0.22), 0 0 22px rgba(125,211,252,0.68)" : "none",
                cursor: "pointer",
                pointerEvents: "auto",
                outline: "none",
                lineHeight: 1,
                transition: "border-color 0.16s, box-shadow 0.16s, background 0.16s",
                zIndex: selected ? 3 : 1,
              }}
            />

            {!clusteredRegionIds.has(region.id) && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: badge.left,
                  top: badge.top,
                  width: badge.width,
                  height: badge.height,
                  boxSizing: "border-box",
                  borderRadius: 999,
                  background: preliminaryMode ? "#7dd3fc" : selected ? "#7dd3fc" : "rgba(2,6,23,0.84)",
                  border: preliminaryMode ? "1px solid #bdf4ff" : "1px solid rgba(125,211,252,0.86)",
                  color: preliminaryMode || selected ? "#03101a" : "#dff9ff",
                  fontSize: 13,
                  lineHeight: `${badge.height - 1}px`,
                  fontWeight: 900,
                  fontFamily: "monospace",
                  textAlign: "center",
                  pointerEvents: "none",
                  boxShadow: selected ? "0 0 14px rgba(125,211,252,0.55)" : "0 2px 8px rgba(0,0,0,0.30)",
                  zIndex: selected ? 5 : 4,
                }}
              >
                #{displayNumber}
              </span>
            )}

            {tooltip && (
              <MarkerTooltip
                region={region}
                preliminaryMode={preliminaryMode}
                label={
                  tooltipRegionLabel?.(region, displayNumber) ??
                  `${preliminaryMode ? "Review region" : "Region"} #${displayNumber}`
                }
                tooltip={tooltip}
              />
            )}
          </span>
        );
      })}
      {clusters.map(cluster => {
        const selectedIndex = cluster.members.findIndex(member => member.region.id === selectedRegionId);
        const containsSelection = selectedIndex >= 0;
        const nextMember = cluster.members[(selectedIndex + 1 + cluster.members.length) % cluster.members.length];

        return (
          <button
            key={cluster.id}
            type="button"
            data-marker-control="true"
            aria-label={`${cluster.members.length} grouped review regions. Select grouped region.`}
            onClick={(event) => {
              event.stopPropagation();
              onSelectRegion(nextMember.region.id);
            }}
            style={{
              position: "absolute",
              left: cluster.badge.left,
              top: cluster.badge.top,
              width: cluster.badge.width,
              height: cluster.badge.height,
              boxSizing: "border-box",
              appearance: "none",
              padding: 0,
              borderRadius: 999,
              border: "1px solid #bdf4ff",
              background: containsSelection ? "#bdf4ff" : "#7dd3fc",
              color: "#03101a",
              boxShadow: containsSelection
                ? "0 0 0 3px rgba(125,211,252,0.18), 0 0 18px rgba(125,211,252,0.62)"
                : "0 3px 10px rgba(0,0,0,0.34)",
              cursor: "pointer",
              pointerEvents: "auto",
              fontSize: 13,
              fontWeight: 900,
              fontFamily: "monospace",
              lineHeight: 1,
              zIndex: containsSelection ? 7 : 6,
            }}
          >
            +{cluster.members.length}
          </button>
        );
      })}
    </div>
  );
}

function MarkerTooltip({
  region,
  preliminaryMode,
  label,
  tooltip,
}: {
  region: Detection;
  preliminaryMode: boolean;
  label?: string;
  tooltip: OverlayRect;
}) {
  return (
    <span
      style={{
        position: "absolute",
        left: tooltip.left,
        top: tooltip.top,
        width: tooltip.width,
        height: tooltip.height,
        boxSizing: "border-box",
        pointerEvents: "none",
        background: "rgba(2,8,23,0.95)",
        border: "1px solid rgba(125,211,252,0.55)",
        borderRadius: 8,
        boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
        color: "#dff9ff",
        padding: "8px 9px",
        textAlign: "left",
        whiteSpace: "normal",
        zIndex: 8,
      }}
    >
      <span style={{ display: "block", color: "#7dd3fc", fontSize: 13, fontWeight: 900, marginBottom: 3 }}>
        {label ?? (preliminaryMode ? "Review region" : "Region")}
      </span>
      <span style={{ display: "block", color: "#c8dce8", fontSize: 13, lineHeight: 1.35 }}>
        Score: {region.score}
      </span>
      <span style={{ display: "block", color: preliminaryMode ? "#cbd5e1" : "#8ba3bd", fontSize: 13, lineHeight: 1.35 }}>
        {preliminaryMode ? "Assessment: Not confirmed change" : region.type}
      </span>
    </span>
  );
}

function placeBadge(
  marker: OverlayRect,
  display: DisplayRect,
  usedBadges: OverlayRect[],
  markers: OverlayRect[],
  markerIndex: number,
  displayNumber: number,
): OverlayRect {
  const diameter = displayNumber > 99 ? 28 : displayNumber > 9 ? 23 : 20;
  const width = diameter;
  const height = diameter;
  const gap = 8;
  const shift = 6;
  const candidates = [
    { left: marker.left, top: marker.top - height - gap, width, height },
    { left: marker.left + marker.width - width, top: marker.top - height - gap, width, height },
    { left: marker.left + marker.width / 2 - width / 2, top: marker.top - height - gap, width, height },
    { left: marker.left - shift, top: marker.top - height - gap - shift, width, height },
    { left: marker.left + marker.width - width + shift, top: marker.top - height - gap - shift, width, height },
    { left: marker.left, top: marker.top + marker.height + gap, width, height },
    { left: marker.left + marker.width - width, top: marker.top + marker.height + gap, width, height },
    { left: marker.left + marker.width / 2 - width / 2, top: marker.top + marker.height + gap, width, height },
    { left: marker.left - shift, top: marker.top + marker.height + gap + shift, width, height },
    { left: marker.left + marker.width - width + shift, top: marker.top + marker.height + gap + shift, width, height },
    { left: marker.left - width - gap, top: marker.top, width, height },
    { left: marker.left - width - gap, top: marker.top + marker.height - height, width, height },
    { left: marker.left - width - gap - shift, top: marker.top + marker.height / 2 - height / 2, width, height },
    { left: marker.left + marker.width + gap, top: marker.top, width, height },
    { left: marker.left + marker.width + gap, top: marker.top + marker.height - height, width, height },
    { left: marker.left + marker.width + gap + shift, top: marker.top + marker.height / 2 - height / 2, width, height },
    { left: marker.left + 4, top: marker.top + 4, width, height },
    { left: marker.left + marker.width - width - 4, top: marker.top + 4, width, height },
    { left: marker.left + 4, top: marker.top + marker.height - height - 4, width, height },
    { left: marker.left + marker.width - width - 4, top: marker.top + marker.height - height - 4, width, height },
  ];

  const safeCandidates = candidates
    .map(candidate => clampToImage(candidate, display))
    .filter(candidate => !coversMarkerCenter(candidate, marker))
    .filter(candidate => !markers.some((other, index) => index !== markerIndex && rectsOverlap(candidate, other)));
  const outsideCandidates = safeCandidates.filter(candidate => !rectsOverlap(candidate, marker));
  const hasBadgeRoom = (candidate: OverlayRect) =>
    usedBadges.every(used => !rectsOverlap(expandRect(candidate, 3), expandRect(used, 3)));
  const fallbackCandidate = safeCandidates.find(candidate => !usedBadges.some(used => rectsOverlap(candidate, used))) ??
    safeCandidates[0] ??
    clampToImage(candidates[candidates.length - 1], display);

  return outsideCandidates.find(hasBadgeRoom) ??
    safeCandidates.find(hasBadgeRoom) ??
    fallbackCandidate;
}

function placeTooltip(marker: OverlayRect, display: DisplayRect, occupiedRects: OverlayRect[]): OverlayRect | null {
  const width = Math.min(210, Math.max(154, display.width - 12));
  const height = 74;
  const gap = 8;
  const centeredLeft = marker.left + marker.width / 2 - width / 2;
  const centeredTop = marker.top + marker.height / 2 - height / 2;
  const candidates = [
    { left: centeredLeft, top: marker.top - height - gap, width, height },
    { left: centeredLeft, top: marker.top + marker.height + gap, width, height },
    { left: marker.left + marker.width + gap, top: centeredTop, width, height },
    { left: marker.left - width - gap, top: centeredTop, width, height },
  ];

  for (const candidate of candidates) {
    const clamped = clampToImage(candidate, display);
    const overlapsOccupied = occupiedRects.some(rect => rectsOverlap(clamped, rect));
    if (!rectsOverlap(clamped, marker) && !coversMarkerCenter(clamped, marker) && !overlapsOccupied) {
      return clamped;
    }
  }

  return null;
}

function clusterBadges(layouts: MarkerLayout[], display: DisplayRect): BadgeCluster[] {
  const clusters: BadgeCluster[] = [];
  const visited = new Set<number>();

  layouts.forEach(layout => {
    if (visited.has(layout.region.id)) return;

    const members: MarkerLayout[] = [];
    const queue = [layout];
    visited.add(layout.region.id);

    while (queue.length > 0) {
      const member = queue.shift()!;
      members.push(member);

      layouts.forEach(candidate => {
        if (visited.has(candidate.region.id) || !badgesCrowd(member, candidate)) return;
        visited.add(candidate.region.id);
        queue.push(candidate);
      });
    }

    if (members.length < 2) return;

    const badgeBounds = boundsFor(members.map(member => member.badge));
    const width = members.length > 9 ? 42 : 32;
    const height = 24;
    const badge = clampToImage({
      left: badgeBounds.left + badgeBounds.width / 2 - width / 2,
      top: badgeBounds.top + badgeBounds.height / 2 - height / 2,
      width,
      height,
    }, display);

    clusters.push({
      id: members.map(member => member.region.id).join("-"),
      members,
      badge,
    });
  });

  return clusters;
}

function badgesCrowd(a: MarkerLayout, b: MarkerLayout): boolean {
  return rectsOverlap(expandRect(a.badge, 7), expandRect(b.badge, 7)) ||
    rectsOverlap(expandRect(a.marker, 8), expandRect(b.marker, 8));
}

function boundsFor(rects: OverlayRect[]): OverlayRect {
  const left = Math.min(...rects.map(rect => rect.left));
  const top = Math.min(...rects.map(rect => rect.top));
  const right = Math.max(...rects.map(rect => rect.left + rect.width));
  const bottom = Math.max(...rects.map(rect => rect.top + rect.height));

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

function clampToImage(rect: OverlayRect, display: DisplayRect): OverlayRect {
  const maxLeft = display.offsetX + Math.max(0, display.width - rect.width);
  const maxTop = display.offsetY + Math.max(0, display.height - rect.height);

  return {
    ...rect,
    left: clamp(rect.left, display.offsetX, maxLeft),
    top: clamp(rect.top, display.offsetY, maxTop),
  };
}

function coversMarkerCenter(rect: OverlayRect, marker: OverlayRect): boolean {
  const centerX = marker.left + marker.width / 2;
  const centerY = marker.top + marker.height / 2;
  return centerX >= rect.left && centerX <= rect.left + rect.width && centerY >= rect.top && centerY <= rect.top + rect.height;
}

function rectsOverlap(a: OverlayRect, b: OverlayRect): boolean {
  return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}

function expandRect(rect: OverlayRect, padding: number): OverlayRect {
  return {
    left: rect.left - padding,
    top: rect.top - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}
