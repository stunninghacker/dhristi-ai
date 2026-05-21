/** Translational registration via coarse-to-fine normalized cross-correlation. */

export function estimateTranslationShift(
  g1: Float32Array,
  g2: Float32Array,
  w: number,
  h: number,
  maxShiftPx: number,
): { dx: number; dy: number; score: number } {
  const maxShift = Math.max(4, Math.min(maxShiftPx, Math.floor(Math.min(w, h) * 0.08)));
  const margin = maxShift + 4;

  const sample = (dx: number, dy: number) => {
    let corr = 0;
    let s1 = 0;
    let s2 = 0;
    let n = 0;
    const step = Math.max(2, Math.floor(Math.min(w, h) / 180));
    for (let y = margin; y < h - margin; y += step) {
      for (let x = margin; x < w - margin; x += step) {
        const x2 = x + dx;
        const y2 = y + dy;
        if (x2 < margin || x2 >= w - margin || y2 < margin || y2 >= h - margin) continue;
        const a = g1[y * w + x];
        const b = g2[y2 * w + x2];
        corr += a * b;
        s1 += a * a;
        s2 += b * b;
        n++;
      }
    }
    const denom = Math.sqrt(s1 * s2) || 1;
    return { ncc: n > 0 ? corr / denom : 0, n };
  };

  let bestDx = 0;
  let bestDy = 0;
  let bestNcc = -2;
  const coarse = Math.max(2, Math.floor(maxShift / 8));

  for (let dy = -maxShift; dy <= maxShift; dy += coarse) {
    for (let dx = -maxShift; dx <= maxShift; dx += coarse) {
      const { ncc } = sample(dx, dy);
      if (ncc > bestNcc) {
        bestNcc = ncc;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }

  for (let dy = bestDy - coarse; dy <= bestDy + coarse; dy++) {
    for (let dx = bestDx - coarse; dx <= bestDx + coarse; dx++) {
      if (Math.abs(dx) > maxShift || Math.abs(dy) > maxShift) continue;
      const { ncc } = sample(dx, dy);
      if (ncc > bestNcc) {
        bestNcc = ncc;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }

  const zeroNcc = sample(0, 0).ncc;
  const gain = bestNcc - zeroNcc;
  const score = Math.round(Math.max(0, Math.min(100, (bestNcc + 1) * 50 + gain * 120)));

  return { dx: bestDx, dy: bestDy, score };
}

export function shiftCanvas(src: HTMLCanvasElement, dx: number, dy: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(src, dx, dy);
  return out;
}
