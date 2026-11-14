/**
 * Shared Barcode & Camera Scanner Hook
 * Encapsulates WebRTC camera stream lifecycle, UniversalBarcodeScanner, and photo file decoding.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  UniversalBarcodeScanner,
  ScanResultFilter,
  startCameraStream,
  diagnoseCameraError,
  scanBarcodeFromImageFile
} from '../utils/scannerUtils';
import { SNPattern } from '../utils/snPatternUtils';
import { getErrorMessage } from '../utils/errorUtils';

export interface CameraErrorDiagnostics {
  type: 'insecure' | 'denied' | 'not_found' | 'not_readable' | 'overconstrained' | 'general';
  message: string;
  errorName: string;
}

export interface UseBarcodeScannerOptions {
  activePatterns?: SNPattern[];
  tipePolaRegex?: string | null;
  stopOnDetect?: boolean;
  onDetected: (filter: ScanResultFilter) => void | Promise<void>;
  onIgnored?: (filter: ScanResultFilter) => void;
  onCameraStart?: () => void;
  onCameraError?: (diag: CameraErrorDiagnostics) => void;
  onPhotoStart?: () => void;
  onPhotoDetected?: (filter: ScanResultFilter) => void | Promise<void>;
  onPhotoError?: (message: string) => void;
}

export function useBarcodeScanner(options: UseBarcodeScannerOptions) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isPhotoScanning, setIsPhotoScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<UniversalBarcodeScanner | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stopCamera = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stopScanning();
      scannerRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    const opts = optionsRef.current;
    try {
      opts.onCameraStart?.();
      setIsCameraActive(true);

      if (!videoRef.current) return;

      await startCameraStream(videoRef.current);

      scannerRef.current = new UniversalBarcodeScanner(
        videoRef.current,
        (filter) => {
          if (optionsRef.current.stopOnDetect) {
            stopCamera();
          }
          void optionsRef.current.onDetected(filter);
        },
        (ignored) => {
          optionsRef.current.onIgnored?.(ignored);
        },
        opts.activePatterns,
        opts.tipePolaRegex
      );

      scannerRef.current.startScanning();
    } catch (err: unknown) {
      const diag = diagnoseCameraError(err);
      optionsRef.current.onCameraError?.(diag);
      setIsCameraActive(false);
    }
  }, [stopCamera]);

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const opts = optionsRef.current;
    setIsPhotoScanning(true);
    opts.onPhotoStart?.();

    try {
      const filter = await scanBarcodeFromImageFile(
        file,
        opts.activePatterns,
        opts.tipePolaRegex
      );
      if (!filter.isSN || !filter.cleanValue.trim()) {
        throw new Error('SN tidak terdeteksi, coba foto ulang');
      }
      if (opts.onPhotoDetected) {
        await opts.onPhotoDetected(filter);
      } else {
        await opts.onDetected(filter);
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'SN tidak terdeteksi, coba foto ulang');
      opts.onPhotoError?.(msg);
    } finally {
      setIsPhotoScanning(false);
      e.target.value = '';
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    isCameraActive,
    isPhotoScanning,
    startCamera,
    stopCamera,
    handlePhotoUpload
  };
}
