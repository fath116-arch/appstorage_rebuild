/**
 * Frontend Timezone Utility (Strict UTC Storage -> Asia/Jakarta WIB Display)
 * FieldOps IT — Single Canonical Timezone Policy
 */

export const APP_TIMEZONE = 'Asia/Jakarta';
export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export function parseDateSafe(input?: string | Date | number | null): Date {
  if (!input) return new Date();
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? new Date() : input;
  }
  if (typeof input === 'number') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }
  const raw = String(input).trim();
  if (!raw) return new Date();

  // Handle MySQL "YYYY-MM-DD HH:MM:SS" strings as UTC explicitly
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw)) {
    const parsed = new Date(raw.replace(' ', 'T') + 'Z');
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function getWibParts(input?: string | Date | number | null): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
} {
  const date = parseDateSafe(input);
  const wibWall = new Date(date.getTime() + WIB_OFFSET_MS);
  return {
    year: wibWall.getUTCFullYear(),
    month: wibWall.getUTCMonth() + 1,
    day: wibWall.getUTCDate(),
    hour: wibWall.getUTCHours(),
    minute: wibWall.getUTCMinutes(),
    second: wibWall.getUTCSeconds(),
    weekday: wibWall.getUTCDay()
  };
}

export function getCurrentWibYear(): number {
  return getWibParts(new Date()).year;
}

export function formatWibDateTime(input?: string | Date | number | null, withSuffix = true): string {
  if (!input) return '-';
  const date = parseDateSafe(input);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const base = `${map.day}/${map.month}/${map.year} ${map.hour}:${map.minute}`;
  return withSuffix ? `${base} WIB` : base;
}

export function formatWibDate(input?: string | Date | number | null): string {
  if (!input) return '-';
  const date = parseDateSafe(input);
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

export function formatWibShortDate(input?: string | Date | number | null): string {
  if (!input) return '-';
  const date = parseDateSafe(input);
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: APP_TIMEZONE,
    day: 'numeric',
    month: 'short'
  }).format(date);
}

export function formatWibTimeOnly(input?: string | Date | number | null): string {
  if (!input) return '-';
  const date = parseDateSafe(input);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.hour}:${map.minute} WIB`;
}

export function getWibDateKey(input?: string | Date | number | null): string {
  const { year, month, day } = getWibParts(input || new Date());
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function getWibWeekRange(weekOffset = 0, reference = new Date()): {
  startUtcIso: string;
  endUtcIso: string;
  startDateWib: string;
  endDateWib: string;
  label: string;
} {
  const p = getWibParts(reference);
  const daysFromMonday = (p.weekday + 6) % 7;

  const wibMondayMidnightMs =
    Date.UTC(p.year, p.month - 1, p.day - daysFromMonday + weekOffset * 7, 0, 0, 0, 0) - WIB_OFFSET_MS;
  const wibSundayEndMs = wibMondayMidnightMs + 7 * 24 * 3600 * 1000 - 1;

  const startDate = new Date(wibMondayMidnightMs);
  const endDate = new Date(wibSundayEndMs);

  const fmt = new Intl.DateTimeFormat('id-ID', {
    timeZone: APP_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return {
    startUtcIso: startDate.toISOString(),
    endUtcIso: endDate.toISOString(),
    startDateWib: getWibDateKey(startDate),
    endDateWib: getWibDateKey(endDate),
    label: `${fmt.format(startDate)} – ${fmt.format(endDate)} (WIB)`
  };
}

export function getWibDaysRange(daysCount: number, reference = new Date()): {
  startUtcIso: string;
  endUtcIso: string;
  dayKeys: string[];
} {
  const p = getWibParts(reference);
  const endMs = Date.UTC(p.year, p.month - 1, p.day, 23, 59, 59, 999) - WIB_OFFSET_MS;
  const startMs = Date.UTC(p.year, p.month - 1, p.day - (daysCount - 1), 0, 0, 0, 0) - WIB_OFFSET_MS;

  const dayKeys: string[] = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    const dayStartUtc = Date.UTC(p.year, p.month - 1, p.day - i, 0, 0, 0, 0) - WIB_OFFSET_MS;
    dayKeys.push(getWibDateKey(new Date(dayStartUtc)));
  }

  return {
    startUtcIso: new Date(startMs).toISOString(),
    endUtcIso: new Date(endMs).toISOString(),
    dayKeys
  };
}

/**
 * Menghasilkan nilai default untuk <input type="datetime-local" /> dalam zona waktu WIB
 */
export function getCurrentWibDateTimeLocalInput(date: Date = new Date()): string {
  const p = getWibParts(date);
  const yyyy = String(p.year).padStart(4, '0');
  const mm = String(p.month).padStart(2, '0');
  const dd = String(p.day).padStart(2, '0');
  const hh = String(p.hour).padStart(2, '0');
  const min = String(p.minute).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * Mengonversi nilai dari <input type="datetime-local" /> (dianggap waktu WIB) menjadi ISO UTC string
 */
export function wibLocalInputToUtcIso(localValue: string): string {
  const cleaned = String(localValue || '').trim();
  const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return new Date().toISOString();
  }
  const [, y, m, d, hh, mm, ss] = match;
  const utcMs = Date.UTC(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    Number(ss || '0'),
    0
  ) - WIB_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

/**
 * Menghitung durasi pemegangan alat sejak taken_at hingga sekarang
 */
export function formatDurationSince(input?: string | Date | null, durationMsOverride?: number | null): string {
  const diffMs =
    typeof durationMsOverride === 'number' && durationMsOverride >= 0
      ? durationMsOverride
      : input
      ? Math.max(0, Date.now() - parseDateSafe(input).getTime())
      : 0;

  const totalMinutes = Math.floor(diffMs / 60000);
  if (totalMinutes < 1) return 'Baru saja';
  if (totalMinutes < 60) return `${totalMinutes} menit`;
  const totalHours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;
  if (totalHours < 24) {
    return remMinutes > 0 ? `${totalHours} jam ${remMinutes} mnt` : `${totalHours} jam`;
  }
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  return remHours > 0 ? `${days} hari ${remHours} jam` : `${days} hari`;
}

/**
 * Mengonversi UTC ISO/Date ke Date object bertema wall-clock WIB khusus ExcelJS
 * (karena Excel tidak menyimpan timezone sehingga waktu WIB ditulis sebagai UTC wall-clock serial)
 */
export function toExcelWibWallDate(input?: string | Date | number | null): Date {
  const date = parseDateSafe(input);
  return new Date(date.getTime() + WIB_OFFSET_MS);
}
