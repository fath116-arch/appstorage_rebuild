/**
 * Scanner Utility & Barcode Normalizer for Router/Modem SN Labels
 * FieldOps IT Inventory
 * - Supports BarcodeDetector API + ZXing Fallback (@zxing/library)
 * - Formats: CODE_128, CODE_39, EAN_13, EAN_8, QR_CODE, DATA_MATRIX, UPC_A, ITF
 * - Multi-barcode Filtering: Distinguishes Serial Number (SN) from MAC Address and PIN/WPA
 * - Camera Diagnostics & Secure Context Handling
 */

import { BrowserMultiFormatReader, BarcodeFormat } from '@zxing/browser';
import * as ZXingLib from '@zxing/library';

export interface ScanResultFilter {
  isSN: boolean;
  cleanValue: string;
  rawType: 'SN' | 'MAC' | 'PIN' | 'UNKNOWN';
  originalRaw: string;
}

/**
 * 1. Filter Multi-Barcode Label Results (Extract SN, Ignore MAC / PIN)
 */
export function extractSNFromBarcode(rawResult: string): ScanResultFilter {
  if (!rawResult || typeof rawResult !== 'string') {
    return { isSN: false, cleanValue: '', rawType: 'UNKNOWN', originalRaw: '' };
  }

  // Normalisasi: trim spasi, hapus karakter kontrol non-printable (\x00-\x1F\x7F)
  const trimmed = rawResult.replace(/[\x00-\x1F\x7F]/g, '').trim();
  if (!trimmed) {
    return { isSN: false, cleanValue: '', rawType: 'UNKNOWN', originalRaw: rawResult };
  }

  // A. Deteksi MAC Address
  // Contoh: MAC: FC-EC-DA-11-22-33, FC:EC:DA:11:22:33, MAC 001122334455, 00-11-22-33-44-55
  const isMacPattern =
    /^MAC[:\s-]/i.test(trimmed) ||
    /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(trimmed) ||
    /^(?:MAC\s*)?[0-9A-Fa-f]{12}$/i.test(trimmed) && /^MAC/i.test(trimmed);

  if (isMacPattern) {
    return { isSN: false, cleanValue: trimmed, rawType: 'MAC', originalRaw: rawResult };
  }

  // B. Deteksi PIN / WPA Password / SSID
  // Contoh: PIN: 12345678, WPA: abc12345, WPA2: 87654321
  const isPinPattern = /^(?:PIN|WPA|WPA2|SSID|PASS|PWD|PASSWORD)[:\s-]/i.test(trimmed);
  if (isPinPattern) {
    return { isSN: false, cleanValue: trimmed, rawType: 'PIN', originalRaw: rawResult };
  }

  // C. Ekstraksi SN dari Prefix (S/N:, SN:, SERIAL:, SERIAL NO:)
  let cleanSN = trimmed;
  const snPrefixMatch = trimmed.match(/^(?:S\/N|SN|SERIAL\s*NO|SERIAL)[:\s-]*(.+)$/i);
  if (snPrefixMatch && snPrefixMatch[1]) {
    cleanSN = snPrefixMatch[1].trim();
  }

  // Jika setelah dibersihkan nilainya valid (minimal 3 karakter)
  if (cleanSN.length >= 3) {
    return { isSN: true, cleanValue: cleanSN, rawType: 'SN', originalRaw: rawResult };
  }

  return { isSN: false, cleanValue: cleanSN, rawType: 'UNKNOWN', originalRaw: rawResult };
}

/**
 * 2. Diagnosa Akses Kamera & Context HTTPS
 */
export function diagnoseCameraError(err: any): { type: 'insecure' | 'denied' | 'not_found' | 'general'; message: string } {
  // Cek apakah dibuka di non-secure context (HTTP biasa)
  if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return {
      type: 'insecure',
      message: '⚠️ Fitur kamera membutuhkan koneksi HTTPS atau domain aman (misal: Cloudflare Tunnel, SSL lokal, https://). Pada HTTP biasa, browser secara otomatis memblokir akses kamera.'
    };
  }

  if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
    return {
      type: 'denied',
      message: '❌ Izin akses kamera ditolak. Silakan izinkan akses kamera di pengaturan browser Anda.'
    };
  }

  if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
    return {
      type: 'not_found',
      message: '❌ Kamera tidak ditemukan pada perangkat ini.'
    };
  }

  return {
    type: 'general',
    message: `❌ Kamera tidak dapat diakses: ${err?.message || 'Membutuhkan izin browser atau koneksi HTTPS.'}`
  };
}

/**
 * 3. Setup Kamera Stream dengan Constraint Ideal & Fokus Kontinu
 */
export async function startCameraStream(videoElement: HTMLVideoElement): Promise<MediaStream> {
  // Check secure context first
  if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    const diag = diagnoseCameraError(null);
    throw new Error(diag.message);
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('API Kamera (navigator.mediaDevices.getUserMedia) tidak didukung oleh browser ini.');
  }

  const constraints: MediaStreamConstraints = {
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920, min: 1280 },
      height: { ideal: 1080, min: 720 }
    }
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  videoElement.srcObject = stream;
  await videoElement.play();

  // Menerapkan constraint fokus kontinu bila didukung oleh perangkat
  try {
    const track = stream.getVideoTracks()[0];
    if (track && 'applyConstraints' in track) {
      const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
      if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] } as any);
      }
    }
  } catch {
    // Focus mode adjustment optional
  }

  return stream;
}

/**
 * 4. Scanner Controller gabungan (BarcodeDetector Native + ZXing Fallback)
 */
export class UniversalBarcodeScanner {
  private videoElement: HTMLVideoElement;
  private scanInterval: number | null = null;
  private zxingReader: BrowserMultiFormatReader | null = null;
  private isScanning: boolean = false;
  private onDetectedCallback: (filter: ScanResultFilter) => void;
  private onIgnoredCallback?: (filter: ScanResultFilter) => void;

  constructor(
    videoElement: HTMLVideoElement,
    onDetected: (filter: ScanResultFilter) => void,
    onIgnored?: (filter: ScanResultFilter) => void
  ) {
    this.videoElement = videoElement;
    this.onDetectedCallback = onDetected;
    this.onIgnoredCallback = onIgnored;
  }

  public startScanning() {
    if (this.isScanning) return;
    this.isScanning = true;

    // A. Persiapan ZXing Reader dengan Hints
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

    // B. Persiapan Native BarcodeDetector (Browser Modern)
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

    // C. Continuous Loop (200ms interval)
    this.scanInterval = window.setInterval(async () => {
      if (!this.isScanning || !this.videoElement || this.videoElement.readyState < 2) {
        return;
      }

      let detectedText: string | null = null;

      // 1. Coba Native BarcodeDetector
      if (nativeDetector) {
        try {
          const barcodes = await nativeDetector.detect(this.videoElement);
          if (barcodes && barcodes.length > 0) {
            // Urutkan atau cari hasil yang berisi SN
            for (const b of barcodes) {
              if (b.rawValue) {
                const filter = extractSNFromBarcode(b.rawValue);
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
        } catch {
          // Frame error ignore
        }
      }

      // 2. Fallback ZXing jika Native BarcodeDetector tidak menghasilkan
      if (!detectedText && this.zxingReader) {
        try {
          const reader = this.zxingReader as any;
          const result = await reader.decodeFromVideoElement(this.videoElement);
          if (result && typeof result.getText === 'function') {
            detectedText = result.getText();
          } else if (result && result.text) {
            detectedText = result.text;
          }
        } catch {
          // ZXing frame pass
        }
      }

      // 3. Proses Hasil
      if (detectedText) {
        const filter = extractSNFromBarcode(detectedText);
        if (filter.isSN) {
          this.onDetectedCallback(filter);
        } else if (filter.rawType === 'MAC' || filter.rawType === 'PIN') {
          if (this.onIgnoredCallback) {
            this.onIgnoredCallback(filter);
          }
        } else {
          // Fallback allow jika bukan MAC/PIN
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
