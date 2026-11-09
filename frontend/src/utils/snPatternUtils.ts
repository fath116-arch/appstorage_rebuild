/**
 * SN Pattern Utility & Converter
 * FieldOps IT Inventory - UPDATE 2
 * Simple Pattern format (#, A, ?, *), Sample Generator, Pattern Validation & Normalizer
 */

export interface SNPattern {
  id: string;
  nama: string;
  pola_sederhana: string;
  contoh_sn: string;
  pola_regex: string;
  is_advanced?: boolean;
  aktif: boolean;
  auto_uppercase?: boolean;
  strip_spaces?: boolean;
  strip_prefixes?: boolean;
  dibuat_pada?: string;
  diperbarui_pada?: string;
}

/**
 * Default initial SN patterns seeded in system
 */
export const DEFAULT_SN_PATTERNS: SNPattern[] = [
  {
    id: 'pat-tplink',
    nama: 'TP-Link Router (EN020-F5)',
    pola_sederhana: '#############',
    contoh_sn: '3213067005147',
    pola_regex: '^[0-9]{13}$',
    is_advanced: false,
    aktif: true,
    auto_uppercase: true,
    strip_spaces: true,
    strip_prefixes: true
  },
  {
    id: 'pat-fiberhome',
    nama: 'FiberHome ONU / Modem',
    pola_sederhana: 'FHTT########',
    contoh_sn: 'FHTT12345678',
    pola_regex: '^FHTT[0-9A-Z]{8}$',
    is_advanced: false,
    aktif: true,
    auto_uppercase: true,
    strip_spaces: true,
    strip_prefixes: true
  },
  {
    id: 'pat-zte',
    nama: 'ZTE Router / ONU',
    pola_sederhana: 'ZTEG########',
    contoh_sn: 'ZTEG12345678',
    pola_regex: '^ZTEG[0-9A-Z]{8}$',
    is_advanced: false,
    aktif: true,
    auto_uppercase: true,
    strip_spaces: true,
    strip_prefixes: true
  },
  {
    id: 'pat-huawei',
    nama: 'Huawei ONU / Router',
    pola_sederhana: '48575443########',
    contoh_sn: '4857544312345678',
    pola_regex: '^48575443[0-9A-Z]{8}$',
    is_advanced: false,
    aktif: true,
    auto_uppercase: true,
    strip_spaces: true,
    strip_prefixes: true
  }
];

/**
 * 1. Convert simple pattern string to regex pattern
 * Symbols:
 * # -> 1 digit [0-9]
 * A -> 1 uppercase letter [A-Z]
 * ? -> 1 letter/digit [a-zA-Z0-9]
 * * -> 0 or more any characters .*
 * others -> literal escaped
 */
export function convertSimplePatternToRegex(simplePattern: string): string {
  if (!simplePattern || !simplePattern.trim()) return '^.*$';

  let regex = '^';
  let i = 0;
  const str = simplePattern.trim();

  while (i < str.length) {
    const char = str[i];

    if (char === '#') {
      let count = 0;
      while (i < str.length && str[i] === '#') {
        count++;
        i++;
      }
      regex += count === 1 ? '[0-9]' : `[0-9]{${count}}`;
      continue;
    }

    if (char === 'A') {
      let count = 0;
      while (i < str.length && str[i] === 'A') {
        count++;
        i++;
      }
      regex += count === 1 ? '[A-Z]' : `[A-Z]{${count}}`;
      continue;
    }

    if (char === '?') {
      let count = 0;
      while (i < str.length && str[i] === '?') {
        count++;
        i++;
      }
      regex += count === 1 ? '[a-zA-Z0-9]' : `[a-zA-Z0-9]{${count}}`;
      continue;
    }

    if (char === '*') {
      regex += '.*';
      i++;
      continue;
    }

    if (/[.*+?^${}()|[\]\\-]/i.test(char)) {
      regex += '\\' + char;
    } else {
      regex += char;
    }
    i++;
  }

  regex += '$';
  return regex;
}

/**
 * 2. Generate simple pattern from sample SN string ("Buat pola dari contoh")
 */
export function generateSimplePatternFromSample(sampleSN: string): string {
  if (!sampleSN) return '';
  const trimmed = sampleSN.trim();
  let pattern = '';

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (/[0-9]/.test(ch)) {
      pattern += '#';
    } else if (/[a-zA-Z]/.test(ch)) {
      pattern += 'A';
    } else {
      pattern += ch;
    }
  }

  return pattern;
}

/**
 * 3. Validate if sample SN matches pattern/regex
 */
export function validatePatternMatch(sampleSN: string, regexStr: string): boolean {
  if (!sampleSN || !regexStr) return false;
  try {
    const reg = new RegExp(regexStr, 'i');
    return reg.test(sampleSN.trim());
  } catch {
    return false;
  }
}

/**
 * 4. Normalisasi SN
 */
export function normalizeSNString(
  rawSN: string,
  options?: { auto_uppercase?: boolean; strip_spaces?: boolean; strip_prefixes?: boolean }
): string {
  if (!rawSN) return '';
  let result = rawSN.replace(/[\x00-\x1F\x7F]/g, '').trim();

  if (options?.strip_prefixes ?? true) {
    result = result.replace(/^(?:S\/N|SN|SERIAL\s*NO|SERIAL)[:\s-]*/i, '').trim();
  }

  if (options?.strip_spaces ?? true) {
    result = result.replace(/\s+/g, '');
  }

  if (options?.auto_uppercase ?? true) {
    result = result.toUpperCase();
  }

  return result;
}
