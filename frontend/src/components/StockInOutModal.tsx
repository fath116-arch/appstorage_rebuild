/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useInventory } from '../context/InventoryContext';
import { InventoryItem, ReferenceType } from '../types/inventory';
import { 
  X, 
  ArrowDownLeft, 
  ArrowUpRight, 
  AlertCircle, 
  FileCheck, 
  Camera, 
  QrCode, 
  CheckCircle2, 
  Scan, 
  Search,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';

interface StockInOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'IN' | 'OUT';
  initialItem?: InventoryItem | null;
  onSuccessPrint?: (txData: {
    type: 'IN' | 'OUT';
    itemName: string;
    itemSku: string;
    quantity: number;
    unit: string;
    referenceNumber: string;
    recipientOrDestination: string;
    performedBy: string;
    notes: string;
    date: string;
  }) => void;
}

export const StockInOutModal: React.FC<StockInOutModalProps> = ({
  isOpen,
  onClose,
  mode,
  initialItem,
  onSuccessPrint
}) => {
  const { user } = useAuth();
  const { items, recordStockIn, recordStockOut, showToast } = useInventory();

  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [referenceType, setReferenceType] = useState<ReferenceType>('TICKET_EXTERNAL');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [performedBy, setPerformedBy] = useState<string>('');
  const [recipientOrDestination, setRecipientOrDestination] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Camera & Scan States (Reusing scanner logic from StockInputModal)
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [scanInput, setScanInput] = useState<string>('');
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  // Initialize selected item
  useEffect(() => {
    if (initialItem) {
      setSelectedItemId(initialItem.id);
    } else if (items.length > 0 && !selectedItemId) {
      setSelectedItemId(items[0].id);
    }
  }, [initialItem, items, selectedItemId]);

  // Set default values according to mode
  useEffect(() => {
    if (user) {
      setPerformedBy(user.name);
    }
    if (mode === 'OUT') {
      setReferenceType('TICKET_EXTERNAL');
      setReferenceNumber(`TCK-2026-${Math.floor(1000 + Math.random() * 9000)}`);
      setRecipientOrDestination('');
      setNotes('Penggantian suku cadang saat perbaikan lapangan');
    } else {
      setReferenceType('PURCHASE_ORDER');
      setReferenceNumber(`PO-2026-${Math.floor(1000 + Math.random() * 9000)}`);
      setRecipientOrDestination('Gudang Utama IT');
      setNotes('Penerimaan pengadaan suku cadang baru');
    }
    setQuantity(1);
    setScanFeedback(null);
  }, [mode, user, isOpen]);

  // Stop camera function
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Handle scanned code (from camera or barcode scanner input)
  const handleProcessCode = useCallback(async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    setIsScanning(true);
    setScanFeedback(null);

    try {
      // 1. Cek langsung pada koleksi items lokal
      let matched = items.find(it => 
        it.sku.toLowerCase() === code.toLowerCase() ||
        (it.barcode && it.barcode.toLowerCase() === code.toLowerCase()) ||
        it.id.toLowerCase() === code.toLowerCase()
      );

      // 2. Jika tidak ditemukan lokal, panggil API scan backend
      if (!matched) {
        try {
          const apiRes = await apiService.scanItem(code);
          if (apiRes.found && apiRes.item) {
            matched = apiRes.item;
          }
        } catch {
          // fallback jika offline/backend error
        }
      }

      if (matched) {
        setSelectedItemId(matched.id);
        setScanInput('');

        if (mode === 'OUT') {
          if (matched.quantity === 0) {
            setScanFeedback({
              type: 'error',
              message: `Stok [${matched.sku}] "${matched.name}" habis (0 ${matched.unit})! Tidak dapat melakukan pengeluaran.`
            });
            showToast(`Stok ${matched.name} habis!`, 'error');
          } else {
            setScanFeedback({
              type: 'success',
              message: `Barang terdeteksi: [${matched.sku}] ${matched.name} (Tersedia: ${matched.quantity} ${matched.unit})`
            });
            showToast(`Barang terdeteksi: ${matched.name}`, 'success');
          }
        } else {
          setScanFeedback({
            type: 'success',
            message: `Barang terdeteksi: [${matched.sku}] ${matched.name} (Stok saat ini: ${matched.quantity} ${matched.unit})`
          });
          showToast(`Barang terdeteksi: ${matched.name}`, 'success');
        }
      } else {
        setScanFeedback({
          type: 'error',
          message: `Kode "${code}" tidak valid atau barang tidak ditemukan dalam database inventori.`
        });
        showToast(`Kode "${code}" tidak terdaftar!`, 'error');
      }
    } finally {
      setIsScanning(false);
    }
  }, [items, mode, showToast]);

  // Start camera scanner
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      setScanFeedback(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // Menggunakan BarcodeDetector API jika didukung browser
        if ('BarcodeDetector' in window) {
          try {
            const barcodeDetector = new (window as any).BarcodeDetector({
              formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'data_matrix', 'upc_a']
            });
            scanIntervalRef.current = window.setInterval(async () => {
              if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                try {
                  const barcodes = await barcodeDetector.detect(videoRef.current);
                  if (barcodes.length > 0) {
                    const detectedVal = barcodes[0].rawValue;
                    if (detectedVal) {
                      stopCamera();
                      handleProcessCode(detectedVal);
                    }
                  }
                } catch {
                  // Frame capture error, ignore
                }
              }
            }, 300);
          } catch {
            // Barcode detector failed init
          }
        }
      }
    } catch {
      showToast('Kamera tidak dapat diakses (membutuhkan izin browser atau koneksi HTTPS).', 'warning');
      setIsCameraActive(false);
    }
  };

  // Cleanup camera on close or unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  if (!isOpen) return null;

  const currentItem = items.find(it => it.id === selectedItemId);
  const isStockOut = mode === 'OUT';

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem) {
      showToast('Pilih barang terlebih dahulu.', 'warning');
      return;
    }

    if (quantity <= 0) {
      showToast('Jumlah harus lebih besar dari 0.', 'warning');
      return;
    }

    if (isStockOut && currentItem.quantity < quantity) {
      showToast(`Stok ${currentItem.name} tidak mencukupi (tersedia: ${currentItem.quantity}).`, 'error');
      return;
    }

    try {
      const refNum = referenceNumber.trim() || `${mode}-${Date.now().toString().slice(-6)}`;
      const destination = recipientOrDestination.trim() || (isStockOut ? 'Lokasi Pekerjaan Lapangan' : 'Gudang Utama IT');

      if (mode === 'IN') {
        await recordStockIn({
          itemId: currentItem.id,
          quantity: Number(quantity),
          referenceNumber: refNum,
          sourceOrVendor: destination,
          notes: notes.trim()
        });
        showToast(`Stok masuk berhasil dicatat: +${quantity} ${currentItem.unit} (${currentItem.name})`, 'success');
      } else {
        await recordStockOut({
          itemId: currentItem.id,
          quantity: Number(quantity),
          referenceNumber: refNum,
          recipientOrDestination: destination,
          notes: notes.trim()
        });
        showToast(`Stok keluar berhasil dicatat: -${quantity} ${currentItem.unit} (${currentItem.name})`, 'success');
      }

      if (onSuccessPrint) {
        onSuccessPrint({
          type: mode,
          itemName: currentItem.name,
          itemSku: currentItem.sku,
          quantity: Number(quantity),
          unit: currentItem.unit,
          referenceNumber: refNum,
          recipientOrDestination: destination,
          performedBy: performedBy || user?.name || 'Petugas IT',
          notes: notes.trim(),
          date: new Date().toISOString()
        });
      }

      stopCamera();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan transaksi stok.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-colors max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-center justify-between shrink-0 ${
          isStockOut ? 'bg-slate-900 text-white border-slate-800' : 'bg-emerald-800 text-white border-emerald-900'
        }`}>
          <div className="flex items-center gap-2.5">
            {isStockOut ? (
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
            )}
            <div>
              <h2 className="text-base font-bold">
                {isStockOut ? 'Catat Barang Keluar (Pekerjaan / Tiket)' : 'Catat Barang Masuk (Restock / Pembelian)'}
              </h2>
              <p className="text-xs text-white/80">
                {isStockOut ? 'Kurangi stok untuk tiket perbaikan lapangan' : 'Tambah jumlah stok fisik ke gudang'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body with scrollable content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto">
          {/* Quick Camera Barcode / QR Scanner Section */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Scan Barcode / QR Kamera
                </span>
              </div>
              {!isCameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-2.5 py-1 text-[11px] font-medium text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-md transition-colors flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Nyalakan Kamera</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-2.5 py-1 text-[11px] font-medium text-white bg-red-600 hover:bg-red-500 rounded-md transition-colors flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Matikan Kamera</span>
                </button>
              )}
            </div>

            {/* Video Preview */}
            {isCameraActive && (
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-700">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                <div className="absolute inset-0 border-2 border-emerald-500/60 m-6 rounded-lg pointer-events-none animate-pulse flex items-center justify-center">
                  <div className="w-full h-0.5 bg-emerald-400/80 shadow-lg shadow-emerald-500" />
                </div>
                <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-white/90 bg-black/60 py-1">
                  Arahkan barcode atau QR item ke dalam kotak bidik
                </div>
              </div>
            )}

            {/* Manual Code Input / Barcode Scanner Gun */}
            <div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Scan barcode scanner atau ketik SKU / ID..."
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleProcessCode(scanInput);
                      }
                    }}
                    className="w-full py-1.5 pl-8 pr-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <Scan className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
                <button
                  type="button"
                  onClick={() => handleProcessCode(scanInput)}
                  disabled={isScanning || !scanInput.trim()}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Cari</span>
                </button>
              </div>
            </div>

            {/* Scan Feedback Banner */}
            {scanFeedback && (
              <div className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                scanFeedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : scanFeedback.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
              }`}>
                {scanFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                )}
                <div className="flex-1 font-medium">{scanFeedback.message}</div>
                <button
                  type="button"
                  onClick={() => setScanFeedback(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Item Selector */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Pilih Barang / Suku Cadang <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(e.target.value);
                setScanFeedback(null);
              }}
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
            >
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  [{it.sku}] {it.name} (Stok: {it.quantity} {it.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Current Stock Banner */}
          {currentItem && (
            <div className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
              currentItem.quantity === 0
                ? 'bg-red-50 dark:bg-rose-950/40 border-red-200 dark:border-rose-800 text-red-800 dark:text-rose-300'
                : currentItem.quantity <= (currentItem.min_stock_alert ?? currentItem.minStockAlert ?? 0)
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300'
            }`}>
              <div>
                <span className="font-semibold">Stok Saat Ini:</span>{' '}
                <span className="font-mono font-bold tabular-nums text-sm">
                  {currentItem.quantity} {currentItem.unit}
                </span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Lokasi: {currentItem.location || 'Gudang Utama'} · SKU: {currentItem.sku}
                </span>
              </div>
              {isStockOut && currentItem.quantity === 0 && (
                <span className="text-red-600 dark:text-rose-400 font-bold text-[11px] flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Stok Habis!
                </span>
              )}
            </div>
          )}

          {/* Quantity and Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Jumlah {isStockOut ? 'Keluar' : 'Masuk'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max={isStockOut && currentItem ? currentItem.quantity : undefined}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                  required
                  className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-sans text-xs">
                  {currentItem?.unit || 'unit'}
                </span>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tipe Keperluan / Referensi
              </label>
              <select
                value={referenceType}
                onChange={(e) => setReferenceType(e.target.value as ReferenceType)}
                className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
              >
                {isStockOut ? (
                  <>
                    <option value="TICKET_EXTERNAL">Tiket Insiden / Gangguan</option>
                    <option value="ROUTINE_MAINTENANCE">Pemeliharaan Rutin (Preventive)</option>
                    <option value="EMERGENCY_REPAIR">Perbaikan Darurat (Emergency)</option>
                  </>
                ) : (
                  <>
                    <option value="PURCHASE_ORDER">Purchase Order / Pengadaan Baru</option>
                    <option value="RETURN_RESTOCK">Retur Sisa Pemakaian Lapangan</option>
                    <option value="INITIAL_COUNT">Penyesuaian Stok / Audit Fisik</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Reference Number & Performed By */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isStockOut ? 'Nomor Tiket Insiden' : 'Nomor PO / Surat Jalan'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder={isStockOut ? 'Contoh: TCK-2026-9480' : 'Contoh: PO-2026-0811'}
                required
                className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nama Teknisi / Petugas (Otentikasi Akun) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={`${user?.name || 'Petugas IT'} (${user?.role || 'user'})`}
                  readOnly
                  disabled
                  className="w-full py-2 px-3 bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-not-allowed select-none"
                />
              </div>
            </div>
          </div>

          {/* Destination / Location */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              {isStockOut ? 'Tujuan Pemasangan / Ruangan / Cabang' : 'Lokasi Simpan di Gudang'}
            </label>
            <input
              type="text"
              value={recipientOrDestination}
              onChange={(e) => setRecipientOrDestination(e.target.value)}
              placeholder={isStockOut ? 'Contoh: Ruang Rapat Lt 3 / Cabang Sudirman' : 'Contoh: Rak A-02 Gudang Utama'}
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Catatan Lapangan / Keterangan Masalah
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Jelaskan detail perbaikan, penyebab penggantian, atau kondisi barang..."
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isStockOut && currentItem && currentItem.quantity < quantity}
              className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs ${
                isStockOut
                  ? 'bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed'
                  : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              <span>{isStockOut ? 'Konfirmasi Pengeluaran Barang' : 'Simpan Barang Masuk'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
