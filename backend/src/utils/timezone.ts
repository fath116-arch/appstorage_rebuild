/**
 * Timezone & Timestamp Policy Helper (UTC Storage <-> Asia/Jakarta WIB Display)
 * Single source of truth for all backend date calculations, boundaries, and validations.
 */

import { isAdminOrDev } from './permissions';

export const APP_TIMEZONE = 'Asia/Jakarta';
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta is permanently UTC+7 (no DST)
const MAX_FUTURE_SKEW_MS = 60 * 1000; // 60 seconds tolerance
const MAX_BACKDATE_DAYS_STANDARD = 7;

export function nowUtcIso(): string {
  return new Date().toISOString();
}

export function parseToDate(input: Date | string | number | null | undefined): Date | null {
  if (input === null || input === undefined || input === '') return null;
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  const raw = String(input).trim();
  if (!raw) return null;

  // Handle SQL datetime format "YYYY-MM-DD HH:MM:SS(.SSS)" stored in UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(raw)) {
    const isoUtc = raw.replace(' ', 'T') + 'Z';
    const d = new Date(isoUtc);
    return isNaN(d.getTime()) ? null : d;
  }

  // Handle ISO string without timezone offset -> treat as UTC
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(raw)) {
    const d = new Date(raw + 'Z');
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export function normalizeDbDateToIso(input: Date | string | number | null | undefined): string | null {
  const d = parseToDate(input);
  return d ? d.toISOString() : null;
}

export function toMysqlUtcDatetime(input: Date | string | number = new Date()): string {
  const d = parseToDate(input) || new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  const ms = String(d.getUTCMilliseconds()).padStart(3, '0');
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}.${ms}`;
}

export function toMysqlUtcSeconds(input: Date | string | number = new Date()): string {
  const d = parseToDate(input) || new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

export function getWibDateParts(input: Date | string | number = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 1 = Monday .. 7 = Sunday
} {
  const d = parseToDate(input) || new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false
  });
  const parts = formatter.formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  const wdMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7
  };
  const hourVal = Number(map.hour);
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: hourVal === 24 ? 0 : hourVal,
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: wdMap[map.weekday] || 1
  };
}

export function getWibDateKey(input: Date | string | number = new Date()): string {
  const p = getWibDateParts(input);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function getWibCompactDate(input: Date | string | number = new Date()): string {
  const p = getWibDateParts(input);
  return `${p.year}${String(p.month).padStart(2, '0')}${String(p.day).padStart(2, '0')}`;
}

export function formatWibTimeHHmm(input: Date | string | number = new Date()): string {
  const p = getWibDateParts(input);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

export function formatWibDateTime(input: Date | string | number | null | undefined): string {
  const d = parseToDate(input);
  if (!d) return '-';
  const p = getWibDateParts(d);
  return `${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}/${p.year} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')} WIB`;
}

export function formatWibDateLabel(input: Date | string | number): string {
  const d = parseToDate(input) || new Date();
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(d);
}

/**
 * Converts a WIB wall-clock date/time into exact UTC Date
 */
export function wibWallClockToUtcDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms) - WIB_OFFSET_MS);
}

/**
 * Computes Monday 00:00:00.000 WIB - Sunday 23:59:59.999 WIB range.
 * weekOffset = 0 -> current week, -1 -> previous week.
 */
export function getWibWeekRange(weekOffset = 0, nowInput: Date | string | number = new Date()): {
  startUtc: Date;
  endUtc: Date;
  startUtcIso: string;
  endUtcIso: string;
  startDateWib: string;
  endDateWib: string;
  label: string;
} {
  const parts = getWibDateParts(nowInput);
  // Compute UTC midnight for current WIB date, then subtract (weekday - 1) days + weekOffset*7
  const daysFromMonday = parts.weekday - 1;
  const mondayBase = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - daysFromMonday + weekOffset * 7, 0, 0, 0, 0));
  const sundayBase = new Date(Date.UTC(
    mondayBase.getUTCFullYear(),
    mondayBase.getUTCMonth(),
    mondayBase.getUTCDate() + 6,
    23,
    59,
    59,
    999
  ));

  const startUtc = new Date(mondayBase.getTime() - WIB_OFFSET_MS);
  const endUtc = new Date(sundayBase.getTime() - WIB_OFFSET_MS);

  const startDateWib = getWibDateKey(startUtc);
  const endDateWib = getWibDateKey(endUtc);
  const label = `${formatWibDateLabel(startUtc)} - ${formatWibDateLabel(endUtc)} (WIB)`;

  return {
    startUtc,
    endUtc,
    startUtcIso: startUtc.toISOString(),
    endUtcIso: endUtc.toISOString(),
    startDateWib,
    endDateWib,
    label
  };
}

/**
 * Returns WIB calendar date range for last N days (inclusive of today in WIB).
 */
export function getWibDaysRange(days: number, nowInput: Date | string | number = new Date()): {
  startUtcIso: string;
  endUtcIso: string;
  dayKeys: string[];
} {
  const parts = getWibDateParts(nowInput);
  const startBase = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - (days - 1), 0, 0, 0, 0));
  const endBase = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999));

  const startUtc = new Date(startBase.getTime() - WIB_OFFSET_MS);
  const endUtc = new Date(endBase.getTime() - WIB_OFFSET_MS);

  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - i, 12, 0, 0, 0) - WIB_OFFSET_MS);
    dayKeys.push(getWibDateKey(d));
  }

  return {
    startUtcIso: startUtc.toISOString(),
    endUtcIso: endUtc.toISOString(),
    dayKeys
  };
}

/**
 * Validates occurred_at timestamp supplied by client:
 * - Never allows future timestamps (> 60s skew)
 * - Limits past timestamps to 7 days unless user role is developer or admin
 */
export function validateOccurredAt(options: {
  occurredAt?: string | Date | null;
  role?: string | null;
  now?: Date;
}): {
  valid: boolean;
  utcIso: string;
  mysqlDatetimeUtc: string;
  isBackdated: boolean;
  message?: string;
} {
  const nowDate = options.now || new Date();
  if (!options.occurredAt) {
    return {
      valid: true,
      utcIso: nowDate.toISOString(),
      mysqlDatetimeUtc: toMysqlUtcDatetime(nowDate),
      isBackdated: false
    };
  }

  const parsed = parseToDate(options.occurredAt);
  if (!parsed) {
    return {
      valid: false,
      utcIso: nowDate.toISOString(),
      mysqlDatetimeUtc: toMysqlUtcDatetime(nowDate),
      isBackdated: false,
      message: 'Format waktu kejadian (occurred_at) tidak valid.'
    };
  }

  const diffFromNow = parsed.getTime() - nowDate.getTime();
  if (diffFromNow > MAX_FUTURE_SKEW_MS) {
    return {
      valid: false,
      utcIso: nowDate.toISOString(),
      mysqlDatetimeUtc: toMysqlUtcDatetime(nowDate),
      isBackdated: false,
      message: 'Waktu kejadian tidak boleh di masa depan.'
    };
  }

  const maxBackMs = MAX_BACKDATE_DAYS_STANDARD * 24 * 60 * 60 * 1000;
  const ageMs = nowDate.getTime() - parsed.getTime();
  if (ageMs > maxBackMs && !isAdminOrDev(options.role)) {
    return {
      valid: false,
      utcIso: nowDate.toISOString(),
      mysqlDatetimeUtc: toMysqlUtcDatetime(nowDate),
      isBackdated: true,
      message: `Admin Gudang hanya dapat mencatat waktu kejadian maksimal ${MAX_BACKDATE_DAYS_STANDARD} hari ke belakang. Hubungi Admin/Developer untuk tanggal lebih lama.`
    };
  }

  return {
    valid: true,
    utcIso: parsed.toISOString(),
    mysqlDatetimeUtc: toMysqlUtcDatetime(parsed),
    isBackdated: ageMs > 120 * 1000
  };
}
