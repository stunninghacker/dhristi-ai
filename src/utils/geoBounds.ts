export interface GeoBounds {
  topLeft: { lat: number; lng: number };
  bottomRight: { lat: number; lng: number };
}

export function parseCoordInput(input: string): { lat: number; lng: number } | null {
  const cleaned = input.replace(/\s/g, "");
  const parts = cleaned.split(",");
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function parseGeoBounds(topLeftStr: string, bottomRightStr: string): GeoBounds | null {
  const tl = parseCoordInput(topLeftStr);
  const br = parseCoordInput(bottomRightStr);
  if (!tl || !br) return null;
  return { topLeft: tl, bottomRight: br };
}

export function pixelToLatLng(
  px: number,
  py: number,
  imgWidth: number,
  imgHeight: number,
  bounds: GeoBounds,
): { lat: number; lng: number } {
  const lng = bounds.topLeft.lng + (px / imgWidth) * (bounds.bottomRight.lng - bounds.topLeft.lng);
  const lat = bounds.topLeft.lat - (py / imgHeight) * (bounds.topLeft.lat - bounds.bottomRight.lat);
  return { lat, lng };
}
