/**
 * Stock Input Modal (FieldOps Inventory v2 - Tahap 3)
 * Pemindaian Kamera Barcode/QR, Scan Beruntun, & Input Massal N-Unit
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  QrCode,
  X,
  Plus,
  CheckCircle2,
  AlertCircle,
  Hash,
  Box as BoxIcon,
  Tag,
  RefreshCw,
  Layers,
  Sparkles,
  Trash2,
  Upload
} from 'lucide-react';
import { stockApi, Box } from '../../services/stockApi';
import { catalogApi, Produk, Tipe } from '../../services/catalogApi';
import { useInventory } from '../../context/InventoryContext';
import { 
  UniversalBarcodeScanner, 
  startCameraStream, 
  diagnoseCameraError, 
  extractSNFromBarcode,
  scanBarcodeFromImageFile
} from '../../utils/scannerUtils';

interface StockInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const StockInputModal: React.FC<StockInputModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { showToast } = useInventory();

  // Selection states
  const [products, setProducts] = useState<Produk[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);

  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [selectedTipeId, setSelectedTipeId] = useState<number | ''>('');
  const [selectedBoxId, setSelectedBoxId] = useState<string>('');

  const [currentTipe, setCurrentTipe] = useState<Tipe | null>(null);

  // Input Mode: 'single_scan' | 'bulk_auto' | 'quantity'
  const [inputMode, setInputMode] = useState<'single_scan' | 'bulk_auto' | 'quantity'>('single_scan');

  // Input states
  const [singleKodeInput, setSingleKodeInput] = useState<string>('');
  const [scannedList, setScannedList] = useState<string[]>([]);
  const [autoCountInput, setAutoCountInput] = useState<number>(10);
  const [quantityInput, setQuantityInput] = useState<number>(10);
  const [catatanInput, setCatatanInput] = useState<string>('');

  // Camera & Photo Scan State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isPhotoScanning, setIsPhotoScanning] = useState<boolean>(false);
  const [cameraErrorNotice, setCameraErrorNotice] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Memuat data produk & box
  const loadInitialData = useCallback(async () => {
    try {
      setLoadingInitial(true);
      const [prods, bList] = await Promise.all([
        catalogApi.listProduk(),
        stockApi.listBoxes()
      ]);
      setProducts(prods);
      setBoxes(bList);
      if (prods.length > 0) setSelectedProductId(prods[0].id);
      if (bList.length > 0) setSelectedBoxId(bList[0].id);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoadingInitial(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen, loadInitialData]);

  // Memuat tipe saat produk berubah
  useEffect(() => {
    if (selectedProductId) {
      catalogApi.listTipeByProduk(Number(selectedProductId)).then(tipes => {
        setProducts(prev => prev.map(p => p.id === Number(selectedProductId) ? { ...p, tipes } : p));
        if (tipes.length > 0) {
          setSelectedTipeId(tipes[0].id);
          setCurrentTipe(tipes[0]);
          // Adjust inputMode based on sumber_id
          if (tipes[0].sumber_id === 'tanpa_id') setInputMode('quantity');
          else if (tipes[0].sumber_id === 'otomatis') setInputMode('bulk_auto');
          else setInputMode('single_scan');
        } else {
          setSelectedTipeId('');
          setCurrentTipe(null);
        }
      });
    }
  }, [selectedProductId]);

  // Handle tipe selection change
  const handleTipeChange = (tipeId: number) => {
    setSelectedTipeId(tipeId);
    const p = products.find(prod => prod.id === Number(selectedProductId));
    const t = p?.tipes?.find(item => item.id === tipeId);
    if (t) {
      setCurrentTipe(t);
      if (t.sumber_id === 'tanpa_id') setInputMode('quantity');
      else if (t.sumber_id === 'otomatis') setInputMode('bulk_auto');
      else setInputMode('single_scan');
    }
  };

  const scannerRef = useRef<UniversalBarcodeScanner | null>(null);

  // Switch camera scanner
  const stopCamera = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stopScanning();
      scannerRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  const startCamera = async () => {
    try {
      setCameraErrorNotice(null);
      setIsCameraActive(true);
      if (!videoRef.current) return;

      await startCameraStream(videoRef.current);

      scannerRef.current = new UniversalBarcodeScanner(
        videoRef.current,
        async (filter) => {
          const cleanSN = filter.cleanValue.trim();
          if (!cleanSN) return;

          // Process scanned SN automatically into queue
          if (scannedList.includes(cleanSN)) {
            showToast(`ID [${cleanSN}] sudah ada di antrean scan.`, 'warning');
            return;
          }

          try {
            const dupCheck = await stockApi.checkDuplicateId(cleanSN);
            if (dupCheck.exists) {
              const it = dupCheck.item;
              showToast(`ID [${cleanSN}] sudah terdaftar pada ${it.nama_produk} (Box ${it.kode_box}).`, 'error');
              return;
            }

            setScannedList(prev => [...prev, cleanSN]);
            showToast(`[${cleanSN}] berhasil discan dari kamera!`, 'success');
          } catch (err: any) {
            showToast(err.message, 'error');
          }
        },
        (ignored) => {
          showToast(`Abaikan Barcode ${ignored.rawType} (${ignored.cleanValue}). Arahkan ke Barcode SN...`, 'warning');
        }
      );

      scannerRef.current.startScanning();
    } catch (err: any) {
      const diag = diagnoseCameraError(err);
      setCameraErrorNotice(diag.message);
      showToast(diag.message, diag.type === 'insecure' ? 'error' : 'warning');
      setIsCameraActive(false);
    }
  };

  // Handler Scan dari Foto / Galeri (Opsi A: Decode Sisi Klien Tanpa Server Upload)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsPhotoScanning(true);
    setCameraErrorNotice(null);
    try {
      const filter = await scanBarcodeFromImageFile(file);
      const cleanSN = filter.cleanValue.trim();
      if (!cleanSN) return;

      if (scannedList.includes(cleanSN)) {
        showToast(`ID [${cleanSN}] sudah ada di antrean scan.`, 'warning');
        return;
      }

      const dupCheck = await stockApi.checkDuplicateId(cleanSN);
      if (dupCheck.exists) {
        const it = dupCheck.item;
        showToast(`ID [${cleanSN}] sudah terdaftar pada ${it.nama_produk} (Box ${it.kode_box}).`, 'error');
        return;
      }

      setScannedList(prev => [...prev, cleanSN]);
      showToast(`SN [${cleanSN}] berhasil diekstrak dari foto!`, 'success');
    } catch (err: any) {
      const msg = err.message || 'Gagal membaca barcode dari foto.';
      showToast(msg, 'error');
      setCameraErrorNotice(`Gagal scan foto: ${msg}`);
    } finally {
      setIsPhotoScanning(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  if (!isOpen) return null;

  // Tambah SN ke antrean beruntun
  const handleAddSingleSN = async () => {
    const clean = singleKodeInput.trim();
    if (!clean) return;

    if (scannedList.includes(clean)) {
      showToast(`ID [${clean}] sudah ada di antrean scan saat ini.`, 'warning');
      return;
    }

    // Cek duplikasi di database
    try {
      const dupCheck = await stockApi.checkDuplicateId(clean);
      if (dupCheck.exists) {
        const it = dupCheck.item;
        showToast(`ID [${clean}] sudah terdaftar pada ${it.nama_produk} (Box ${it.kode_box}).`, 'error');
        return;
      }

      // Check Regex if present
      if (currentTipe?.pola_id) {
        const regex = new RegExp(currentTipe.pola_id);
        if (!regex.test(clean)) {
          showToast(`Format ID tidak cocok dengan pola regex: ${currentTipe.pola_id}`, 'error');
          return;
        }
      }

      setScannedList(prev => [...prev, clean]);
      setSingleKodeInput('');
      showToast(`[${clean}] ditambahkan ke antrean scan.`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Submit eksekusi input stok
  const handleSubmitStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTipeId || !selectedBoxId) {
      showToast('Lengkapi pilihan Tipe dan Storage Box.', 'warning');
      return;
    }

    try {
      if (inputMode === 'single_scan') {
        if (scannedList.length === 0 && !singleKodeInput.trim()) {
          showToast('Masukkan minimal 1 ID / Serial Number.', 'warning');
          return;
        }

        const finalSNs = [...scannedList];
        if (singleKodeInput.trim() && !finalSNs.includes(singleKodeInput.trim())) {
          finalSNs.push(singleKodeInput.trim());
        }

        if (finalSNs.length === 1) {
          const res = await stockApi.inputSingleStock({
            tipe_id: Number(selectedTipeId),
            box_id: selectedBoxId,
            kode_id: finalSNs[0],
            catatan: catatanInput.trim() || undefined
          });
          showToast(res.message, 'success');
        } else {
          const res = await stockApi.inputBulkStock({
            tipe_id: Number(selectedTipeId),
            box_id: selectedBoxId,
            kode_ids: finalSNs,
            catatan: catatanInput.trim() || undefined
          });
          showToast(res.message, 'success');
        }
      } else if (inputMode === 'bulk_auto') {
        if (autoCountInput <= 0) {
          showToast('Jumlah N unit harus lebih besar dari 0.', 'warning');
          return;
        }

        const res = await stockApi.inputBulkStock({
          tipe_id: Number(selectedTipeId),
          box_id: selectedBoxId,
          auto_count: autoCountInput,
          catatan: catatanInput.trim() || undefined
        });
        showToast(res.message, 'success');
      } else if (inputMode === 'quantity') {
        if (quantityInput <= 0) {
          showToast('Jumlah unit harus lebih besar dari 0.', 'warning');
          return;
        }

        const res = await stockApi.inputQuantityStock({
          tipe_id: Number(selectedTipeId),
          box_id: selectedBoxId,
          jumlah: quantityInput,
          catatan: catatanInput.trim() || undefined
        });
        showToast(res.message, 'success');
      }

      stopCamera();
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto transition-colors">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Input Stok Fisik (Scan Kamera / Massal)
              </h3>
              <p className="text-xs text-slate-500">
                Setiap 1 batch input mempublikasikan 1 ID Aktivitas transaksi (AKT-YYYYMMDD-NNNN)
              </p>
            </div>
          </div>

          <button onClick={() => { stopCamera(); onClose(); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loadingInitial ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
            <span>Memuat data produk & storage box...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmitStock} className="space-y-4 text-xs">
            {/* Selection Grid: Produk, Tipe, Box */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  1. Pilih Produk *
                </label>
                <select
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.nama}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  2. Pilih Varian Tipe *
                </label>
                <select
                  value={selectedTipeId}
                  onChange={e => handleTipeChange(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-bold"
                >
                  {(() => {
                    const prod = products.find(p => p.id === Number(selectedProductId));
                    return prod?.tipes?.map(t => (
                      <option key={t.id} value={t.id}>{t.nama_tipe}</option>
                    ));
                  })()}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  3. Storage Box Tujuan *
                </label>
                <select
                  value={selectedBoxId}
                  onChange={e => setSelectedBoxId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono font-bold"
                >
                  {boxes.map(b => (
                    <option key={b.id} value={b.id}>{b.kode}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Banner Aturan ID Tipe yang Dipilih */}
            {currentTipe && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    Aturan ID Tipe: <code className="text-emerald-600 dark:text-emerald-400">{currentTipe.sumber_id}</code>
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Mode Stok: {currentTipe.mode_stok === 'per_id' ? 'Item Ber-ID Fisik' : 'Stok Jumlah (Bulk)'}
                    {currentTipe.pola_id ? ` · Pola Regex: ${currentTipe.pola_id}` : ''}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setInputMode('single_scan')}
                    disabled={currentTipe.sumber_id === 'tanpa_id'}
                    className={`px-2 py-1 rounded text-[10px] font-bold ${
                      inputMode === 'single_scan'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Scan Beruntun
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputMode('bulk_auto')}
                    disabled={currentTipe.sumber_id !== 'otomatis'}
                    className={`px-2 py-1 rounded text-[10px] font-bold ${
                      inputMode === 'bulk_auto'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Auto N-Unit
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputMode('quantity')}
                    disabled={currentTipe.sumber_id !== 'tanpa_id'}
                    className={`px-2 py-1 rounded text-[10px] font-bold ${
                      inputMode === 'quantity'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Stok Jumlah
                  </button>
                </div>
              </div>
            )}

            {/* Mode 1: Scan Beruntun / Single SN */}
            {inputMode === 'single_scan' && (
              <div className="space-y-3">
                {/* Primary Pathway Scanner View (Scan Foto Utama + Kamera Eksperimental) */}
                <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-3 shadow-md border border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold flex items-center gap-1.5 text-xs text-emerald-400">
                      <QrCode className="w-4 h-4" /> Pemindai Barcode / QR Label Router
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Jalur Utama: Scan dari Foto / Galeri HP */}
                      <label className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg cursor-pointer transition-all shadow-xs flex items-center gap-1.5 shrink-0">
                        <Upload className="w-4 h-4" />
                        <span>{isPhotoScanning ? 'Membaca Foto...' : 'Scan dari Foto / Galeri (Jalur Utama)'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoUpload}
                          disabled={isPhotoScanning}
                          className="hidden"
                        />
                      </label>

                      {/* Jalur Sekunder: Kamera Live (Eksperimental) */}
                      {!isCameraActive ? (
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 shrink-0 border border-slate-700"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Kamera Live (Eksperimental)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Matikan Kamera</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Format Pattern Guidance Hint */}
                  <div className="text-[10px] text-slate-300 bg-slate-800/80 p-2 rounded-lg border border-slate-700/80 flex items-center justify-between">
                    <span>
                      💡 <strong className="text-emerald-300">Format SN Aktif:</strong> TP-Link (13 Angka: 3213067005147) · FiberHome (FHTT...) · ZTE (ZTEG...)
                    </span>
                  </div>

                  {/* Camera Diagnostics Banner */}
                  {cameraErrorNotice && (
                    <div className="p-2.5 rounded-lg bg-rose-950/90 border border-rose-700 text-rose-200 text-[11px] flex items-start gap-2 animate-in fade-in duration-150">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <div className="font-semibold">{cameraErrorNotice}</div>
                        <div className="text-[10px] text-rose-300">
                          Fitur kamera live ditandai sebagai <span className="underline">eksperimental</span>. Gunakan tombol hijau <strong className="text-white font-bold">"Scan dari Foto / Galeri"</strong> di atas atau ketik Serial Number secara manual pada bidang input di bawah.
                        </div>
                      </div>
                    </div>
                  )}

                  {isCameraActive && (
                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-700">
                      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                        <div className="w-full max-w-[280px] sm:max-w-xs h-24 sm:h-28 border-2 border-emerald-400 rounded-xl relative overflow-hidden shadow-lg shadow-emerald-500/20 bg-emerald-950/10">
                          <div className="w-full h-0.5 bg-emerald-400 shadow-md shadow-emerald-500 absolute top-1/2 -translate-y-1/2 animate-pulse" />
                          <div className="absolute top-1 left-2 text-[9px] font-mono text-emerald-300 font-bold bg-slate-900/80 px-1.5 py-0.5 rounded">
                            BARCODE 1D (SN) / QR
                          </div>
                        </div>
                      </div>
                      <div className="absolute bottom-1.5 left-0 right-0 text-center text-[10px] text-emerald-300 font-medium bg-slate-900/80 py-1 px-2">
                        Arahkan Barcode 1D Serial Number (S/N) atau QR ke dalam kotak hijau
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Ketik Manual / Scanner Keypad */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ketik ID / Serial Number (Tekan Enter atau klik + Tambah untuk scan beruntun)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Masukkan SN atau scan barcode..."
                      value={singleKodeInput}
                      onChange={e => setSingleKodeInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSingleSN();
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={handleAddSingleSN}
                      className="px-3.5 py-2 font-bold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 rounded-lg flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah</span>
                    </button>
                  </div>
                </div>

                {/* List Antrean Scan Beruntun */}
                {scannedList.length > 0 && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        Antrean Scan Beruntun ({scannedList.length} unit):
                      </span>
                      <button
                        type="button"
                        onClick={() => setScannedList([])}
                        className="text-red-500 hover:underline text-[10px]"
                      >
                        Kosongkan Antrean
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                      {scannedList.map((sn, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200"
                        >
                          {sn}
                          <button
                            type="button"
                            onClick={() => setScannedList(prev => prev.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mode 2: Bulk Auto N Units */}
            {inputMode === 'bulk_auto' && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  Jumlah Unit Otomatis Dihasilkan (N Unit)
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={autoCountInput}
                  onChange={e => setAutoCountInput(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono font-bold"
                />
                <span className="text-[11px] text-slate-500 block">
                  Sistem akan membuat {autoCountInput} ID item fisik dengan format prefix "{currentTipe?.prefix_id || 'ITEM-'}" dalam 1 transaksi.
                </span>
              </div>
            )}

            {/* Mode 3: Quantity Non-SN */}
            {inputMode === 'quantity' && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  Jumlah Unit Masuk (Stok Jumlah)
                </label>
                <input
                  type="number"
                  min={1}
                  value={quantityInput}
                  onChange={e => setQuantityInput(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono font-bold"
                />
              </div>
            )}

            {/* Catatan Transaksi */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Catatan Transaksi / Nomor Surat Jalan PO (Opsional)
              </label>
              <input
                type="text"
                placeholder="Misal: Penerimaan PO-2026-11-002 dari Suplier Utama"
                value={catatanInput}
                onChange={e => setCatatanInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { stopCamera(); onClose(); }}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 font-bold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-lg shadow-xs"
              >
                Eksekusi Input Stok
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
