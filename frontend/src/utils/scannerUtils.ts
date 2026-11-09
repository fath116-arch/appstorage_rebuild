/**
 * Scanner Utility & Barcode Normalizer for Router/Modem SN Labels
 * FieldOps IT Inventory - v1.2.5 UPDATE 2
 * - Primary Pathway: Client-Side Photo File Barcode Decoding (Opsi A)
 * - Experimental Pathway: Live Camera WebRTC Stream with Flexible Fallbacks
 * - Pattern Matching: Active SN Pattern Filter (#, A, ?, *) from Settings
 * - Multi-barcode Filtering: Distinguishes Serial Number (SN) from MAC Address and PIN/WPA
 */

import { BrowserMultiFormatReader, BarcodeFormat } from '@zxing/browser';
import * as ZXingLib from '@zxing/library';
import { SNPattern, DEFAULT_SN_PATTERNS, normalizeSNString, validatePatternMatch } from './snPatternUtils';

export interface ScanResultFilter {
  isSN: boolean;
  cleanValue: string;
  rawType: 'SN' | 'MAC' | 'PIN' | 'UNKNOWN';
  originalRaw: string;
  matchedPatternName?: string;
  allRawCandidates?: string[];
}

/**
 * 1. Filter Multi-Barcode Label Results (Extract SN, Ignore MAC / PIN, Match Active Patterns)
 */
export function extractSNFromBarcode(rawResult: string, activePatterns?: SNPattern[]): ScanResultFilter {
  if (!rawResult || typeof rawResult !== 'string') {
    return { isSN: false, cleanValue: '', rawType: 'UNKNOWN', originalRaw: '' };
  }

  // Normalisasi: trim spasi, hapus karakter kontrol non-printable (\x00-\x1F\x7F)
  const trimmed = rawResult.replace(/[\x00-\x1F\x7F]/g, '').trim();
  if (!trimmed) {
    return { isSN: false, cleanValue: '', rawType: 'UNKNOWN', originalRaw: rawResult };
  }

  // Debug Log
  console.log('[ScannerDebug] Evaluating barcode candidate:', trimmed);

  // A. Deteksi MAC Address
  const isMacPattern =
    /^MAC[:\s-]/i.test(trimmed) ||
    /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(trimmed) ||
    (/^(?:MAC\s*)?[0-9A-Fa-f]{12}$/i.test(trimmed) && /^MAC/i.test(trimmed));

  if (isMacPattern) {
    return { isSN: false, cleanValue: trimmed, rawType: 'MAC', originalRaw: rawResult };
  }

  // B. Deteksi PIN / WPA Password / SSID
  const isPinPattern = /^(?:PIN|WPA|WPA2|SSID|PASS|PWD|PASSWORD)[:\s-]/i.test(trimmed);
  if (isPinPattern) {
    return { isSN: false, cleanValue: trimmed, rawType: 'PIN', originalRaw: rawResult };
  }

  // C. Ekstraksi SN dari Prefix (S/N:, SN:, SERIAL:, SERIAL NO:) & Normalisasi
  const cleanSN = normalizeSNString(trimmed, {
    auto_uppercase: true,
    strip_spaces: true,
    strip_prefixes: true
  });

  // D. Cocokkan dengan Pola SN Aktif
  const patternsToTest = activePatterns && activePatterns.length > 0 ? activePatterns : DEFAULT_SN_PATTERNS;
  const activeOnly = patternsToTest.filter(p => p.aktif);

  for (const pat of activeOnly) {
    if (pat.pola_regex && validatePatternMatch(cleanSN, pat.pola_regex)) {
      console.log(`[ScannerDebug] Matched active pattern "${pat.nama}":`, cleanSN);
      return {
        isSN: true,
        cleanValue: cleanSN,
        rawType: 'SN',
        originalRaw: rawResult,
        matchedPatternName: pat.nama
      };
    }
  }

  // Jika tidak ada pola spesifik yang cocok tetapi nilainya valid (minimal 3 karakter & bukan MAC/PIN)
  if (cleanSN.length >= 3) {
    return {
      isSN: true,
      cleanValue: cleanSN,
      rawType: 'SN',
      originalRaw: rawResult
    };
  }

  return { isSN: false, cleanValue: cleanSN, rawType: 'UNKNOWN', originalRaw: rawResult };
}

/**
 * 2. Diagnosa Akses Kamera Live (Eksperimental) & Context HTTPS dengan Kode Error Spesifik
 */
export function diagnoseCameraError(err: any): { type: 'insecure' | 'denied' | 'not_found' | 'not_readable' | 'overconstrained' | 'general'; message: string; errorName: string } {
  const errName = err?.name || (err instanceof Error ? err.name : 'UnknownError');

  if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return {
      type: 'insecure',
      errorName: 'SecurityError',
      message: '⚠️ Kamera live (Eksperimental) membutuhkan koneksi HTTPS atau domain aman. Gunakan jalur utama "Scan dari Foto / Galeri" atau ketik SN manual.'
    };
  }

  if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
    return {
      type: 'denied',
      errorName: errName,
      message: '❌ Izin akses kamera ditolak (NotAllowedError). Gunakan jalur utama "Scan dari Foto / Galeri" atau izinkan kamera di browser.'
    };
  }

  if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
    return {
      type: 'not_found',
      errorName: errName,
      message: '❌ Kamera tidak ditemukan pada perangkat ini (NotFoundError). Gunakan jalur utama "Scan dari Foto / Galeri".'
    };
  }

  if (errName === 'NotReadableError' || errName === 'TrackStartError') {
    return {
      type: 'not_readable',
      errorName: errName,
      message: '❌ Kamera sedang digunakan aplikasi lain (NotReadableError). Gunakan jalur utama "Scan dari Foto / Galeri".'
    };
  }

  if (errName === 'OverconstrainedError') {
    return {
      type: 'overconstrained',
      errorName: errName,
      message: '❌ Resolusi / fokus kamera tidak didukung (OverconstrainedError). Gunakan jalur utama "Scan dari Foto / Galeri".'
    };
  }

  return {
    type: 'general',
    errorName: errName,
    message: `❌ Kamera live tidak aktif (${errName}: ${err?.message || 'Izin ditolak atau HTTP non-aman'}). Gunakan jalur utama "Scan dari Foto / Galeri" atau ketik SN manual.`
  };
}

/**
 * 3. Setup Kamera Stream dengan Constraint Ideal & Fallback (Eksperimental)
 */
export async function startCameraStream(videoElement: HTMLVideoElement): Promise<MediaStream> {
  if (videoElement.srcObject) {
    const oldStream = videoElement.srcObject as MediaStream;
    oldStream.getTracks().forEach(track => track.stop());
    videoElement.srcObject = null;
  }

  if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    const diag = diagnoseCameraError(null);
    throw new Error(diag.message);
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('API Kamera tidak didukung oleh browser ini. Gunakan jalur utama "Scan dari Foto / Galeri".');
  }

  let stream: MediaStream | null = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 }
      }
    });
  } catch {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true
      });
    }
  }

  videoElement.srcObject = stream;
  await videoElement.play();

  try {
    const track = stream.getVideoTracks()[0];
    if (track && 'applyConstraints' in track) {
      const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
      if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] } as any);
      }
    }
  } catch {}

  return stream;
}

/**
 * 4. Live Camera Scanner Controller (Eksperimental)
 */
export class UniversalBarcodeScanner {
  private videoElement: HTMLVideoElement;
  private scanInterval: number | null = null;
  private zxingReader: BrowserMultiFormatReader | null = null;
  private isScanning: boolean = false;
  private onDetectedCallback: (filter: ScanResultFilter) => void;
  private onIgnoredCallback?: (filter: ScanResultFilter) => void;
  private activePatterns?: SNPattern[];

  constructor(
    videoElement: HTMLVideoElement,
    onDetected: (filter: ScanResultFilter) => void,
    onIgnored?: (filter: ScanResultFilter) => void,
    activePatterns?: SNPattern[]
  ) {
    this.videoElement = videoElement;
    this.onDetectedCallback = onDetected;
    this.onIgnoredCallback = onIgnored;
    this.activePatterns = activePatterns;
  }

  public startScanning() {
    if (this.isScanning) return;
    this.isScanning = true;

    const hints = new Map();
    const formats = [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.UPC_A,
      BarcodeFormat.ITF
    ];
    hints.set(ZXingLib.DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(ZXingLib.DecodeHintType.TRY_HARDER, true);

    this.zxingReader = new BrowserMultiFormatReader(hints);

    let nativeDetector: any = null;
    if ('BarcodeDetector' in window) {
      try {
        nativeDetector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'data_matrix', 'upc_a', 'itf']
        });
      } catch {
        nativeDetector = null;
      }
    }

    this.scanInterval = window.setInterval(async () => {
      if (!this.isScanning || !this.videoElement || this.videoElement.readyState < 2) {
        return;
      }

      let detectedText: string | null = null;

      if (nativeDetector) {
        try {
          const barcodes = await nativeDetector.detect(this.videoElement);
          if (barcodes && barcodes.length > 0) {
            for (const b of barcodes) {
              if (b.rawValue) {
                const filter = extractSNFromBarcode(b.rawValue, this.activePatterns);
                if (filter.isSN) {
                  detectedText = filter.originalRaw;
                  break;
                } else if (filter.rawType === 'MAC' || filter.rawType === 'PIN') {
                  if (this.onIgnoredCallback) this.onIgnoredCallback(filter);
                }
              }
            }
            if (!detectedText && barcodes[0]?.rawValue) {
              detectedText = barcodes[0].rawValue;
            }
          }
        } catch {}
      }

      if (!detectedText && this.zxingReader) {
        try {
          const reader = this.zxingReader as any;
          const result = await reader.decodeFromVideoElement(this.videoElement);
          if (result && typeof result.getText === 'function') {
            detectedText = result.getText();
          } else if (result && result.text) {
            detectedText = result.text;
          }
        } catch {}
      }

      if (detectedText) {
        const filter = extractSNFromBarcode(detectedText, this.activePatterns);
        if (filter.isSN) {
          this.onDetectedCallback(filter);
        } else if (filter.rawType === 'MAC' || filter.rawType === 'PIN') {
          if (this.onIgnoredCallback) {
            this.onIgnoredCallback(filter);
          }
        } else {
          this.onDetectedCallback(filter);
        }
      }
    }, 200);
  }

  public stopScanning() {
    this.isScanning = false;
    if (this.scanInterval !== null) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    if (this.zxingReader) {
      try {
        if (typeof (this.zxingReader as any).reset === 'function') {
          (this.zxingReader as any).reset();
        }
      } catch {}
      this.zxingReader = null;
    }
  }
}

/**
 * 5. Decode Barcode 1D / QR dari Foto (Jalur Utama - Client Side Opsi A)
 * Ekstraksi Barcode & Cocokkan dengan Pola SN Aktif
 */
export async function scanBarcodeFromImageFile(file: File, activePatterns?: SNPattern[]): Promise<ScanResultFilter> {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('File yang dipilih bukan berkas gambar yang valid.');
  }

  console.log('[ScannerDebug] Processing primary photo scan:', file.name, 'Size:', file.size);
  const rawCandidates: string[] = [];

  // A. Native BarcodeDetector
  if ('BarcodeDetector' in window) {
    try {
      const nativeDetector = new (window as any).BarcodeDetector({
        formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'data_matrix', 'upc_a', 'itf']
      });
      const imageBitmap = await createImageBitmap(file);
      const barcodes = await nativeDetector.detect(imageBitmap);

      if (barcodes && barcodes.length > 0) {
        for (const b of barcodes) {
          if (b.rawValue && !rawCandidates.includes(b.rawValue)) {
            rawCandidates.push(b.rawValue);
          }
        }
      }
    } catch {}
  }

  // B. Fallback Canvas & ZXing
  const imageUrl = URL.createObjectURL(file);
  try {
    const hints = new Map();
    hints.set(ZXingLib.DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.UPC_A,
      BarcodeFormat.ITF
    ]);
    hints.set(ZXingLib.DecodeHintType.TRY_HARDER, true);

    const zxingReader = new BrowserMultiFormatReader(hints);
    try {
      const result = await zxingReader.decodeFromImageUrl(imageUrl);
      if (result && result.getText() && !rawCandidates.includes(result.getText())) {
        rawCandidates.push(result.getText());
      }
    } catch {
      const preprocessResults = await preprocessCanvasAndScanAll(imageUrl);
      for (const resStr of preprocessResults) {
        if (resStr && !rawCandidates.includes(resStr)) {
          rawCandidates.push(resStr);
        }
      }
    }
  } finally {
    URL.revokeObjectURL(imageUrl);
  }

  console.log('[ScannerDebug] All raw detected barcode candidates from image:', rawCandidates);

  if (rawCandidates.length === 0) {
    throw new Error('Barcode 1D (SN) tidak terbaca dari foto. Coba foto lebih dekat, tegak lurus, dan terang, atau gunakan input manual.');
  }

  // C. Evaluasi Candidate Terhadap Pola SN Aktif
  for (const candidate of rawCandidates) {
    const filter = extractSNFromBarcode(candidate, activePatterns);
    if (filter.isSN) {
      filter.allRawCandidates = rawCandidates;
      return filter;
    }
  }

  // D. Jika tidak ada yang cocok dengan Pola SN Aktif, kembalikan hasil mentah pertama beserta seluruh kandidat
  const fallbackFilter = extractSNFromBarcode(rawCandidates[0], activePatterns);
  fallbackFilter.allRawCandidates = rawCandidates;
  return fallbackFilter;
}

/**
 * Helper: Pra-pemrosesan Canvas (Grayscale, Kontras & Rotasi) mengembalikan seluruh hasil kandidat
 */
async function preprocessCanvasAndScanAll(imageUrl: string): Promise<string[]> {
  return new Promise((resolve) => {
    const results: string[] = [];
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(results);

        let w = img.width;
        let h = img.height;
        const maxDim = 1920;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
          const contrastVal = avg > 128 ? Math.min(255, avg * 1.2) : Math.max(0, avg * 0.8);
          d[i] = contrastVal;
          d[i + 1] = contrastVal;
          d[i + 2] = contrastVal;
        }
        ctx.putImageData(imgData, 0, 0);

        const processedUrl = canvas.toDataURL('image/jpeg', 0.9);
        const hints = new Map();
        hints.set(ZXingLib.DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.EAN_13,
          BarcodeFormat.QR_CODE
        ]);
        hints.set(ZXingLib.DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints);
        try {
          const res = await reader.decodeFromImageUrl(processedUrl);
          if (res && res.getText()) {
            results.push(res.getText());
          }
        } catch {}

        // Rotasi 90 Derajat
        const rotCanvas = document.createElement('canvas');
        rotCanvas.width = h;
        rotCanvas.height = w;
        const rotCtx = rotCanvas.getContext('2d');
        if (rotCtx) {
          rotCtx.translate(h / 2, w / 2);
          rotCtx.rotate((90 * Math.PI) / 180);
          rotCtx.drawImage(canvas, -w / 2, -h / 2);
          const rotUrl = rotCanvas.toDataURL('image/jpeg', 0.9);
          try {
            const rotRes = await reader.decodeFromImageUrl(rotUrl);
            if (rotRes && rotRes.getText() && !results.includes(rotRes.getText())) {
              results.push(rotRes.getText());
            }
          } catch {}
        }

        resolve(results);
      } catch {
        resolve(results);
      }
    };
    img.onerror = () => resolve(results);
    img.src = imageUrl;
  });
}
