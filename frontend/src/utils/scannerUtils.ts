/**
 * Scanner Utility & Barcode Normalizer for Router/Modem SN Labels
 * FieldOps IT Inventory
 * - Supports BarcodeDetector API + ZXing Fallback (@zxing/library)
 * - Formats: CODE_128, CODE_39, EAN_13, EAN_8, QR_CODE, DATA_MATRIX, UPC_A, ITF
 * - Multi-barcode Filtering: Distinguishes Serial Number (SN) from MAC Address and PIN/WPA
 * - Camera Diagnostics, Flexible Constraints Fallback & Client-side Photo File Scanning (Opsi A)
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
    (/^(?:MAC\s*)?[0-9A-Fa-f]{12}$/i.test(trimmed) && /^MAC/i.test(trimmed));

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
 * 2. Diagnosa Akses Kamera & Context HTTPS dengan Kode Error Spesifik
 */
export function diagnoseCameraError(err: any): { type: 'insecure' | 'denied' | 'not_found' | 'not_readable' | 'overconstrained' | 'general'; message: string; errorName: string } {
  const errName = err?.name || (err instanceof Error ? err.name : 'UnknownError');

  // Cek apakah dibuka di non-secure context (HTTP biasa)
  if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return {
      type: 'insecure',
      errorName: 'SecurityError',
      message: '⚠️ Fitur kamera live membutuhkan koneksi HTTPS atau domain aman (misal: Cloudflare Tunnel, SSL lokal, https://). Pada HTTP biasa, browser memblokir kamera. Gunakan tombol "Scan dari Foto / Galeri" atau ketik SN manual di bawah.'
    };
  }

  if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
    return {
      type: 'denied',
      errorName: errName,
      message: '❌ Izin akses kamera ditolak (NotAllowedError). Silakan izinkan akses kamera di pengaturan browser HP/PC Anda, atau gunakan opsi "Scan dari Foto".'
    };
  }

  if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
    return {
      type: 'not_found',
      errorName: errName,
      message: '❌ Kamera tidak ditemukan pada perangkat ini (NotFoundError). Gunakan opsi "Scan dari Foto" atau input manual.'
    };
  }

  if (errName === 'NotReadableError' || errName === 'TrackStartError') {
    return {
      type: 'not_readable',
      errorName: errName,
      message: '❌ Kamera sedang digunakan oleh aplikasi lain (NotReadableError). Tutup aplikasi kamera lain lalu coba lagi, atau gunakan opsi "Scan dari Foto".'
    };
  }

  if (errName === 'OverconstrainedError') {
    return {
      type: 'overconstrained',
      errorName: errName,
      message: '❌ Resolusi / fokus kamera tidak didukung oleh perangkat ini (OverconstrainedError).'
    };
  }

  return {
    type: 'general',
    errorName: errName,
    message: `❌ Kamera tidak dapat diakses (${errName}: ${err?.message || 'Izin ditolak atau HTTP non-aman'}). Gunakan opsi "Scan dari Foto" atau ketik SN manual.`
  };
}

/**
 * 3. Setup Kamera Stream dengan Constraint Ideal & Bertahap Fallback
 */
export async function startCameraStream(videoElement: HTMLVideoElement): Promise<MediaStream> {
  // Matikan stream lama jika ada pada videoElement
  if (videoElement.srcObject) {
    const oldStream = videoElement.srcObject as MediaStream;
    oldStream.getTracks().forEach(track => track.stop());
    videoElement.srcObject = null;
  }

  // Check secure context first
  if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    const diag = diagnoseCameraError(null);
    throw new Error(diag.message);
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('API Kamera (navigator.mediaDevices.getUserMedia) tidak didukung oleh browser ini. Gunakan opsi Scan dari Foto.');
  }

  let stream: MediaStream | null = null;

  // Attempt 1: Constraint Ideal Resolusi Tinggi (1080p) + Camera Belakang
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 }
      }
    });
  } catch {
    // Attempt 2: Fallback ke Constraint Kamera Belakang Sederhana
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
    } catch {
      // Attempt 3: Fallback ke Video Dasar Apapun
      stream = await navigator.mediaDevices.getUserMedia({
        video: true
      });
    }
  }

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
 * 4. Scanner Controller Live Camera (BarcodeDetector Native + ZXing Fallback)
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
          // Frame error pass
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
 * 5. Decode Barcode 1D / QR dari File Foto / Galeri di Sisi Klien (Opsi A)
 * Tanpa Upload Gambar ke Server (Hanya Hasil Teks SN yang dikembalikan)
 */
export async function scanBarcodeFromImageFile(file: File): Promise<ScanResultFilter> {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('File yang dipilih bukan berkas gambar yang valid.');
  }

  let rawDetectedText: string | null = null;

  // A. Coba Native BarcodeDetector browser bila tersedia
  if ('BarcodeDetector' in window) {
    try {
      const nativeDetector = new (window as any).BarcodeDetector({
        formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'data_matrix', 'upc_a', 'itf']
      });
      const imageBitmap = await createImageBitmap(file);
      const barcodes = await nativeDetector.detect(imageBitmap);

      if (barcodes && barcodes.length > 0) {
        for (const b of barcodes) {
          if (b.rawValue) {
            const filter = extractSNFromBarcode(b.rawValue);
            if (filter.isSN) {
              rawDetectedText = b.rawValue;
              break;
            }
          }
        }
        if (!rawDetectedText && barcodes[0]?.rawValue) {
          rawDetectedText = barcodes[0].rawValue;
        }
      }
    } catch {
      // Fallback ke Canvas + ZXing
    }
  }

  // B. Fallback Canvas + ZXing jika Native tidak mendeteksi
  if (!rawDetectedText) {
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
      const result = await zxingReader.decodeFromImageUrl(imageUrl);
      if (result && result.getText()) {
        rawDetectedText = result.getText();
      }
    } catch {
      // Coba pra-pemrosesan Canvas (Grayscale, Kontras & Rotasi 90 derajat)
      rawDetectedText = await preprocessCanvasAndScan(imageUrl);
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  }

  if (!rawDetectedText) {
    throw new Error('Barcode 1D (SN) tidak terbaca dari foto. Pastikan foto fokus, terang, dan dekat dengan label barcode, atau ketik Serial Number secara manual.');
  }

  const resultFilter = extractSNFromBarcode(rawDetectedText);
  return resultFilter;
}

/**
 * Helper: Pra-pemrosesan Canvas gambar (Grayscale, Ambang Binarisasi, Rotasi) untuk barcode 1D pudar / miring
 */
async function preprocessCanvasAndScan(imageUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);

        // Skala maks 1920px
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

        // 1. Pra-pemrosesan Grayscale & High Contrast
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
          // Enhancing contrast for barcode lines
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
            return resolve(res.getText());
          }
        } catch {
          // Pass to rotation
        }

        // 2. Rotasi 90 Derajat (Barcode Miring Vertikal)
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
            if (rotRes && rotRes.getText()) {
              return resolve(rotRes.getText());
            }
          } catch {}
        }

        resolve(null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}
