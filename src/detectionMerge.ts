import type { Detection } from "./types";

function bboxIoU(a: [number, number, number, number], b: [number, number, number, number]): number {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;
  const x1 = Math.max(ax, bx);
  const y1 = Math.max(ay, by);
  const x2 = Math.min(ax + aw, bx + bw);
  const y2 = Math.min(ay + ah, by + bh);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = aw * ah + bw * bh - inter;
  return union > 0 ? inter / union : 0;
}

function mergePair(a: Detection, b: Detection): Detection {
  const score = Math.max(a.score, b.score);
  const ax = Math.min(a.bbox[0], b.bbox[0]);
  const ay = Math.min(a.bbox[1], b.bbox[1]);
  const ax2 = Math.max(a.bbox[0] + a.bbox[2], b.bbox[0] + b.bbox[2]);
  const ay2 = Math.max(a.bbox[1] + a.bbox[3], b.bbox[1] + b.bbox[3]);
  const bw = ax2 - ax;
  const bh = ay2 - ay;
  const cx = ax + Math.round(bw / 2);
  const cy = ay + Math.round(bh / 2);
  return {
    ...a,
    score,
    areaPx: a.areaPx + b.areaPx,
    bbox: [ax, ay, bw, bh],
    pixelCenter: [cx, cy],
    type: score >= b.score ? a.type : b.type,
    meanDelta: Math.max(a.meanDelta, b.meanDelta),
  };
}

/** Merge overlapping review zones so analysts see one box per change cluster. */
export function mergeOverlappingDetections(detections: Detection[], iouThreshold = 0.28): Detection[] {
  const sorted = [...detections].sort((a, b) => b.score - a.score);
  const kept: Detection[] = [];

  for (const d of sorted) {
    let merged = false;
    for (let i = 0; i < kept.length; i++) {
      if (bboxIoU(d.bbox, kept[i].bbox) >= iouThreshold) {
        kept[i] = mergePair(kept[i], d);
        merged = true;
        break;
      }
    }
    if (!merged) kept.push({ ...d });
  }

  return kept.map((d, i) => ({ ...d, id: i + 1 }));
}

function bboxProximity(a: [number, number, number, number], b: [number, number, number, number]): number {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;
  const aRight = ax + aw;
  const aBottom = ay + ah;
  const bRight = bx + bw;
  const bBottom = by + bh;

  const xDist = Math.max(0, Math.max(ax, bx) - Math.min(aRight, bRight));
  const yDist = Math.max(0, Math.max(ay, by) - Math.min(aBottom, bBottom));

  return Math.sqrt(xDist * xDist + yDist * yDist);
}

/** Merge detections whose bounding boxes are within `proximityPx` of each other. */
export function mergeProximateDetections(detections: Detection[], proximityPx = 10): Detection[] {
  const sorted = [...detections].sort((a, b) => b.score - a.score);
  const kept: Detection[] = [];

  for (const d of sorted) {
    let merged = false;
    for (let i = 0; i < kept.length; i++) {
      if (bboxProximity(d.bbox, kept[i].bbox) <= proximityPx) {
        kept[i] = mergePair(kept[i], d);
        merged = true;
        break;
      }
    }
    if (!merged) kept.push({ ...d });
  }

  return kept.map((d, i) => ({ ...d, id: i + 1 }));
}
