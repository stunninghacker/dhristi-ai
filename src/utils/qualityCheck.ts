export interface QualityWarning {
  type: "cloud" | "haze";
  message: string;
}

function getImageData(img: HTMLImageElement | HTMLCanvasElement): ImageData {
  let canvas: HTMLCanvasElement;
  if (img instanceof HTMLImageElement) {
    canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
  } else {
    canvas = img;
  }
  return canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
}

function sampleImageData(data: Uint8ClampedArray, width: number, height: number, sampleRate: number): ImageData {
  const sw = Math.max(1, Math.floor(width * sampleRate));
  const sh = Math.max(1, Math.floor(height * sampleRate));
  const out = new ImageData(sw, sh);
  const stepX = Math.floor(width / sw);
  const stepY = Math.floor(height / sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const srcIdx = (y * stepY * width + x * stepX) * 4;
      const dstIdx = (y * sw + x) * 4;
      out.data[dstIdx] = data[srcIdx];
      out.data[dstIdx + 1] = data[srcIdx + 1];
      out.data[dstIdx + 2] = data[srcIdx + 2];
      out.data[dstIdx + 3] = 255;
    }
  }
  return out;
}

export function detectCloudCoverage(img: HTMLImageElement | HTMLCanvasElement, thresholdPct: number = 20): boolean {
  const imageData = getImageData(img);
  const { data, width, height } = imageData;
  const totalPixels = width * height;

  if (totalPixels > 200000) {
    const sampled = sampleImageData(data, width, height, 0.25);
    return detectCloudsInData(sampled.data, sampled.width * sampled.height, thresholdPct);
  }
  return detectCloudsInData(data, totalPixels, thresholdPct);
}

function detectCloudsInData(data: Uint8ClampedArray, pixelCount: number, thresholdPct: number): boolean {
  let brightCount = 0;

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    if (r > 200 && g > 200 && b > 200) {
      const localVar = localVariance(data, i, pixelCount, 3);
      if (localVar < 2500) {
        brightCount++;
      }
    }
  }

  return (brightCount / pixelCount) * 100 > thresholdPct;
}

function localVariance(data: Uint8ClampedArray, pixelIdx: number, totalPixels: number, halfWindow: number): number {
  let sum = 0;
  let count = 0;
  const start = Math.max(0, pixelIdx - halfWindow);
  const end = Math.min(totalPixels - 1, pixelIdx + halfWindow);

  for (let i = start; i <= end; i++) {
    const idx = i * 4;
    const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    sum += gray;
    count++;
  }

  const mean = sum / count;
  let variance = 0;
  for (let i = start; i <= end; i++) {
    const idx = i * 4;
    const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    variance += (gray - mean) ** 2;
  }

  return variance / count;
}

export function detectHaze(img: HTMLImageElement | HTMLCanvasElement, stdThreshold: number = 40): boolean {
  const imageData = getImageData(img);
  const { data, width, height } = imageData;
  const totalPixels = width * height;

  let rSum = 0, gSum = 0, bSum = 0;
  let rSumSq = 0, gSumSq = 0, bSumSq = 0;

  const step = totalPixels > 500000 ? 2 : 1;

  for (let i = 0; i < totalPixels; i += step) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    rSum += r; gSum += g; bSum += b;
    rSumSq += r * r; gSumSq += g * g; bSumSq += b * b;
  }

  const n = Math.ceil(totalPixels / step);
  const rMean = rSum / n;
  const gMean = gSum / n;
  const bMean = bSum / n;

  const rStd = Math.sqrt(rSumSq / n - rMean * rMean);
  const gStd = Math.sqrt(gSumSq / n - gMean * gMean);
  const bStd = Math.sqrt(bSumSq / n - bMean * bMean);

  const avgStd = (rStd + gStd + bStd) / 3;

  return avgStd < stdThreshold;
}

export function runQualityCheck(img1: HTMLImageElement | HTMLCanvasElement, img2: HTMLImageElement | HTMLCanvasElement): QualityWarning[] {
  const warnings: QualityWarning[] = [];

  const img1Clouds = detectCloudCoverage(img1);
  const img2Clouds = detectCloudCoverage(img2);

  if (img1Clouds || img2Clouds) {
    warnings.push({
      type: "cloud",
      message: "Cloud coverage detected — results may be unreliable",
    });
  }

  const img1Haze = detectHaze(img1);
  const img2Haze = detectHaze(img2);

  if (img1Haze || img2Haze) {
    warnings.push({
      type: "haze",
      message: "Haze or low contrast detected — consider preprocessing",
    });
  }

  return warnings;
}
