import { fromBlob } from "geotiff";
import type {
  Detection,
  GeoBBox,
  GeoMetadataSummary,
  GeoModelType,
  GeoPoint,
  GeoReferenceMetadata,
  GeoReferencePair,
  GeoSourceImage,
  GeoTransform,
} from "./types";

interface TIFFDirectory {
  ModelTransformation?: ArrayLike<number>;
}

export interface AnalysisGeoFrame {
  analysisWidth: number;
  analysisHeight: number;
  baselineScale: number;
  baselineCropX: number;
  recentScale: number;
  recentCropX: number;
  recentScaledHeight: number;
  alignmentShift: [number, number];
}

export function isTiffFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type === "image/tiff" || file.type === "image/geotiff" || name.endsWith(".tif") || name.endsWith(".tiff");
}

export async function extractGeoMetadata(file: File, sourceImage: GeoSourceImage): Promise<GeoReferenceMetadata | null> {
  if (!isTiffFile(file)) return null;

  try {
    const tiff = await fromBlob(file);
    const image = await tiff.getImage();
    const transform = getImageTransform(image);
    const boundingBox = toBBox(image.getBoundingBox());

    if (!transform || !boundingBox) return null;

    const resolution = image.getResolution();
    const geoKeys = image.getGeoKeys();

    return {
      sourceImage,
      crs: readCrs(geoKeys),
      transform,
      pixelResolution: [roundGeo(resolution[0]), roundGeo(resolution[1])],
      boundingBox,
      width: image.getWidth(),
      height: image.getHeight(),
      modelType: readModelType(geoKeys),
    };
  } catch (error) {
    console.warn(`Geo metadata unavailable for ${file.name}.`, error);
    return null;
  }
}

export async function renderTiffToCanvas(file: File): Promise<HTMLCanvasElement> {
  const tiff = await fromBlob(file);
  const image = await tiff.getImage();
  const rgb = await image.readRGB({ interleave: true });
  const width = rgb.width;
  const height = rgb.height;
  const channels = Math.max(3, Math.round(rgb.length / Math.max(1, width * height)));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d")!;
  const pixels = ctx.createImageData(width, height);

  for (let pixel = 0; pixel < width * height; pixel++) {
    const rasterOffset = pixel * channels;
    const canvasOffset = pixel * 4;
    pixels.data[canvasOffset] = toByte(rgb[rasterOffset]);
    pixels.data[canvasOffset + 1] = toByte(rgb[rasterOffset + 1]);
    pixels.data[canvasOffset + 2] = toByte(rgb[rasterOffset + 2]);
    pixels.data[canvasOffset + 3] = channels > 3 ? toByte(rgb[rasterOffset + 3]) : 255;
  }

  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

export function applyGeoMetadata(
  detections: Detection[],
  references: GeoReferencePair | undefined,
  frame: AnalysisGeoFrame,
): GeoMetadataSummary {
  const baseline = references?.baseline ?? null;
  const recent = references?.recent ?? null;
  const reference = baseline ?? recent;

  if (!reference) return summarizeGeoMetadata(null, baseline, recent);

  const mapAnalysisPixel = createPixelMapper(reference.sourceImage, frame);

  detections.forEach(detection => {
    const geoCenter = pixelToGeo(reference.transform, mapAnalysisPixel(...detection.pixelCenter));
    const geoCorners = bboxCorners(detection.bbox)
      .map(([x, y]) => pixelToGeo(reference.transform, mapAnalysisPixel(x, y)));

    detection.geoCenter = roundPoint(geoCenter);
    detection.geoBBox = boundsForGeoPoints(geoCorners);
    detection.areaM2 = approximateAreaM2(detection, geoCenter, reference, frame);
  });

  return summarizeGeoMetadata(reference, baseline, recent);
}

function summarizeGeoMetadata(
  reference: GeoReferenceMetadata | null,
  baseline: GeoReferenceMetadata | null,
  recent: GeoReferenceMetadata | null,
): GeoMetadataSummary {
  return {
    available: Boolean(reference),
    referenceImage: reference?.sourceImage ?? null,
    crs: reference?.crs ?? null,
    transform: reference?.transform ?? null,
    pixelResolution: reference?.pixelResolution ?? null,
    boundingBox: reference?.boundingBox ?? null,
    baseline,
    recent,
  };
}

function getImageTransform(image: {
  getFileDirectory: () => unknown;
  getOrigin: () => number[];
  getResolution: () => number[];
}): GeoTransform | null {
  const directory = image.getFileDirectory() as TIFFDirectory;
  const matrix = directory.ModelTransformation;

  if (matrix && matrix.length >= 8) {
    return [
      roundGeo(Number(matrix[3])),
      roundGeo(Number(matrix[0])),
      roundGeo(Number(matrix[1])),
      roundGeo(Number(matrix[7])),
      roundGeo(Number(matrix[4])),
      roundGeo(Number(matrix[5])),
    ];
  }

  try {
    const origin = image.getOrigin();
    const resolution = image.getResolution();
    return [
      roundGeo(origin[0]),
      roundGeo(resolution[0]),
      0,
      roundGeo(origin[1]),
      0,
      roundGeo(resolution[1]),
    ];
  } catch {
    return null;
  }
}

function createPixelMapper(sourceImage: GeoSourceImage, frame: AnalysisGeoFrame) {
  if (sourceImage === "T1") {
    return (x: number, y: number): GeoPoint => [
      x / frame.baselineScale + frame.baselineCropX,
      y / frame.baselineScale,
    ];
  }

  const [shiftX, shiftY] = frame.alignmentShift;
  const recentYScale = frame.recentScaledHeight / Math.max(1, frame.analysisHeight);

  return (x: number, y: number): GeoPoint => [
    (x - shiftX) / frame.recentScale + frame.recentCropX,
    ((y - shiftY) * recentYScale) / frame.recentScale,
  ];
}

function pixelToGeo(transform: GeoTransform, [x, y]: GeoPoint): GeoPoint {
  return [
    transform[0] + transform[1] * x + transform[2] * y,
    transform[3] + transform[4] * x + transform[5] * y,
  ];
}

function bboxCorners([x, y, width, height]: [number, number, number, number]): GeoPoint[] {
  return [
    [x, y],
    [x + width, y],
    [x, y + height],
    [x + width, y + height],
  ];
}

function boundsForGeoPoints(points: GeoPoint[]): GeoBBox {
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);

  return [
    roundGeo(Math.min(...xs)),
    roundGeo(Math.min(...ys)),
    roundGeo(Math.max(...xs)),
    roundGeo(Math.max(...ys)),
  ];
}

function approximateAreaM2(
  detection: Detection,
  center: GeoPoint,
  reference: GeoReferenceMetadata,
  frame: AnalysisGeoFrame,
): number {
  const sourceAreaPerPixel = Math.abs(
    reference.transform[1] * reference.transform[5] -
    reference.transform[2] * reference.transform[4]
  );
  const analysisToSourceArea = reference.sourceImage === "T1"
    ? 1 / Math.max(frame.baselineScale ** 2, Number.EPSILON)
    : (frame.recentScaledHeight / Math.max(1, frame.analysisHeight)) /
      Math.max(frame.recentScale ** 2, Number.EPSILON);
  const coordinateArea = detection.areaPx * sourceAreaPerPixel * analysisToSourceArea;

  if (reference.modelType === "geographic" || reference.crs === "EPSG:4326") {
    const latitudeRadians = center[1] * Math.PI / 180;
    const metersPerDegreeLatitude = 111132.92 - 559.82 * Math.cos(2 * latitudeRadians) + 1.175 * Math.cos(4 * latitudeRadians);
    const metersPerDegreeLongitude = 111412.84 * Math.cos(latitudeRadians) - 93.5 * Math.cos(3 * latitudeRadians);
    return roundArea(Math.abs(coordinateArea * metersPerDegreeLatitude * metersPerDegreeLongitude));
  }

  return roundArea(coordinateArea);
}

function readCrs(geoKeys: Record<string, unknown> | null): string | null {
  if (!geoKeys) return null;

  const projected = epsgValue(geoKeys.ProjectedCSTypeGeoKey);
  if (projected) return `EPSG:${projected}`;

  const geographic = epsgValue(geoKeys.GeographicTypeGeoKey);
  if (geographic) return `EPSG:${geographic}`;

  const citation = geoKeys.GTCitationGeoKey ?? geoKeys.GeogCitationGeoKey;
  return typeof citation === "string" && citation.trim() ? citation.trim() : null;
}

function readModelType(geoKeys: Record<string, unknown> | null): GeoModelType {
  const modelType = geoKeys?.GTModelTypeGeoKey;
  if (modelType === 1 || modelType === "ModelTypeProjected") return "projected";
  if (modelType === 2 || modelType === "ModelTypeGeographic") return "geographic";
  if (epsgValue(geoKeys?.ProjectedCSTypeGeoKey)) return "projected";
  if (epsgValue(geoKeys?.GeographicTypeGeoKey)) return "geographic";
  return "unknown";
}

function epsgValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function toBBox(values: number[]): GeoBBox | null {
  if (!Array.isArray(values) || values.length < 4 || values.some(value => !Number.isFinite(value))) return null;
  return [roundGeo(values[0]), roundGeo(values[1]), roundGeo(values[2]), roundGeo(values[3])];
}

function roundPoint([x, y]: GeoPoint): GeoPoint {
  return [roundGeo(x), roundGeo(y)];
}

function roundGeo(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundArea(value: number): number {
  return Math.round(Math.abs(value) * 100) / 100;
}

function toByte(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value ?? 0)));
}
