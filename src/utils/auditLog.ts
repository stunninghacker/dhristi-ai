export interface AuditLogEntry {
  id: string;
  timestamp: string;
  t1Filename: string;
  t2Filename: string;
  profile: string;
  ssim: number;
  regionsDetected: number;
  pipelineMode: string;
  processingTimeMs: number;
}

const STORAGE_KEY = "satenna_audit_log";

export function getAuditLog(): AuditLogEntry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function appendAuditLog(entry: AuditLogEntry): AuditLogEntry[] {
  const log = getAuditLog();
  log.unshift(entry);
  const trimmed = log.slice(0, 20);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* storage full - silently ignore */
  }
  return trimmed;
}

export function clearAuditLog(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function copyAuditLogAsJson(): void {
  const log = getAuditLog();
  const json = JSON.stringify(log, null, 2);
  navigator.clipboard.writeText(json).catch(() => {
    /* clipboard unavailable */
  });
}
