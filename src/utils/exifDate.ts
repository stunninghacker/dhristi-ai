const JPEG_SOI = 0xffd8;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

interface IfdDates {
  dateTime: string | null;
  original: string | null;
  digitized: string | null;
}

export async function extractExifDate(file: File): Promise<string | null> {
  try {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);

    if (view.byteLength < 8) return null;
    if (view.getUint16(0, false) === JPEG_SOI) return parseJpegExifDate(view);
    if (isPng(view)) return parsePngExifDate(view);
    return parseTiffExifDate(view, 0, view.byteLength);
  } catch {
    return null;
  }
}

function parseJpegExifDate(view: DataView): string | null {
  let offset = 2;

  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = view.getUint8(offset + 1);
    offset += 2;
    if (marker === 0xda || marker === 0xd9) break;
    if (offset + 2 > view.byteLength) break;

    const segmentLength = view.getUint16(offset, false);
    const segmentStart = offset + 2;
    if (segmentLength < 2 || segmentStart + segmentLength - 2 > view.byteLength) break;

    if (marker === 0xe1 && readAscii(view, segmentStart, 6) === "Exif\u0000\u0000") {
      const tiffStart = segmentStart + 6;
      return parseTiffExifDate(view, tiffStart, segmentLength - 8);
    }

    offset += segmentLength;
  }

  return null;
}

function parsePngExifDate(view: DataView): string | null {
  let offset = 8;

  while (offset + 12 <= view.byteLength) {
    const length = view.getUint32(offset, false);
    const type = readAscii(view, offset + 4, 4);
    const dataStart = offset + 8;
    if (dataStart + length + 4 > view.byteLength) break;

    if (type === "eXIf") {
      return parseTiffExifDate(view, dataStart, length);
    }

    offset = dataStart + length + 4;
  }

  return null;
}

function parseTiffExifDate(view: DataView, tiffStart: number, tiffLength: number): string | null {
  if (!isInBounds(view, tiffStart, 8, tiffStart, tiffLength)) return null;

  const byteOrder = readAscii(view, tiffStart, 2);
  const littleEndian = byteOrder === "II";
  if (!littleEndian && byteOrder !== "MM") return null;
  if (view.getUint16(tiffStart + 2, littleEndian) !== 42) return null;

  const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
  const ifd0 = readIfdDates(view, tiffStart, tiffLength, ifd0Offset, littleEndian);
  if (!ifd0) return null;

  const exif = ifd0.exifIfdOffset === null
    ? null
    : readIfdDates(view, tiffStart, tiffLength, ifd0.exifIfdOffset, littleEndian);

  return parseExifDateValue(exif?.original ?? null) ??
    parseExifDateValue(exif?.digitized ?? null) ??
    parseExifDateValue(ifd0.dates.original) ??
    parseExifDateValue(ifd0.dates.digitized) ??
    parseExifDateValue(ifd0.dates.dateTime);
}

function readIfdDates(
  view: DataView,
  tiffStart: number,
  tiffLength: number,
  relativeOffset: number,
  littleEndian: boolean,
): { dates: IfdDates; exifIfdOffset: number | null } | null {
  const ifdStart = tiffStart + relativeOffset;
  if (!isInBounds(view, ifdStart, 2, tiffStart, tiffLength)) return null;

  const entryCount = view.getUint16(ifdStart, littleEndian);
  const dates: IfdDates = { dateTime: null, original: null, digitized: null };
  let exifIfdOffset: number | null = null;

  for (let i = 0; i < entryCount; i += 1) {
    const entry = ifdStart + 2 + i * 12;
    if (!isInBounds(view, entry, 12, tiffStart, tiffLength)) break;

    const tag = view.getUint16(entry, littleEndian);
    const type = view.getUint16(entry + 2, littleEndian);
    const count = view.getUint32(entry + 4, littleEndian);
    const value = readTagValue(view, tiffStart, tiffLength, entry, type, count, littleEndian);

    if (tag === 0x0132 && typeof value === "string") dates.dateTime = value;
    if (tag === 0x9003 && typeof value === "string") dates.original = value;
    if (tag === 0x9004 && typeof value === "string") dates.digitized = value;
    if (tag === 0x8769 && typeof value === "number") exifIfdOffset = value;
  }

  return { dates, exifIfdOffset };
}

function readTagValue(
  view: DataView,
  tiffStart: number,
  tiffLength: number,
  entry: number,
  type: number,
  count: number,
  littleEndian: boolean,
): string | number | null {
  if (type === 2) {
    const valueStart = count <= 4 ? entry + 8 : tiffStart + view.getUint32(entry + 8, littleEndian);
    if (!isInBounds(view, valueStart, count, tiffStart, tiffLength)) return null;
    return readAscii(view, valueStart, count).replace(/\u0000+$/g, "").trim();
  }

  if (type === 3 && count === 1) return view.getUint16(entry + 8, littleEndian);
  if (type === 4 && count === 1) return view.getUint32(entry + 8, littleEndian);
  return null;
}

function parseExifDateValue(value: string | null): string | null {
  if (!value) return null;

  const normalized = value.trim();
  const exifMatch = normalized.match(/^(\d{4}):(\d{2}):(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/);
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/);
  const match = exifMatch ?? isoMatch;
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText = "0", minuteText = "0", secondText = "0"] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day, Number(hourText), Number(minuteText), Number(secondText)));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isPng(view: DataView): boolean {
  return PNG_SIGNATURE.every((byte, index) => view.getUint8(index) === byte);
}

function isInBounds(view: DataView, offset: number, length: number, start: number, totalLength: number): boolean {
  return offset >= start &&
    length >= 0 &&
    offset + length <= start + totalLength &&
    offset + length <= view.byteLength;
}

function readAscii(view: DataView, offset: number, length: number): string {
  let text = "";
  for (let i = 0; i < length && offset + i < view.byteLength; i += 1) {
    text += String.fromCharCode(view.getUint8(offset + i));
  }
  return text;
}
