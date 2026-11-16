/**
 * Stock Input Modal (Canonical Single Model)
 * Pemindaian Kamera/Foto Barcode/QR, Scan Beruntun, Auto N-Unit, & Stok Jumlah
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Camera,
  QrCode,
  X,
  Plus,
  AlertCircle,
  RefreshCw,
  Upload,
  Search
} from 'lucide-react';
import { stockApi } from '../../services/stockApi';
import { catalogApi, Tipe } from '../../services/catalogApi';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { getErrorMessage } from '../../utils/errorUtils';
import { getCurrentWibDateTimeLocalInput, getCurrentWibYear, wibLocalInputToUtcIso } from '../../utils/timezone';
import { TransactionAttributionFields } from './TransactionAttributionFields';
import type { RequestRecord } from '../../services/requestApi';

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
  const { user } = useAuth();
  const { products: contextProducts, boxes: contextBoxes, refreshData, showToast } = useInventory();

  const [productSearch, setProductSearch] = useState<string>('');
  const [tipesForSelectedProduct, setTipesForSelectedProduct] = useState<Tipe[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [selectedTipeId, setSelectedTipeId] = useState<number | ''>('');
  const [selectedBoxId, setSelectedBoxId] = useState<string>('');
  const [loadingInitial, setLoadingInitial] = useState<boolean>(false);

  const [currentTipe, setCurrentTipe] = useState<Tipe | null>(null);
  const [inputMode, setInputMode] = useState<'single_scan' | 'bulk_auto' | 'quantity'>('single_scan');

  const [singleKodeInput, setSingleKodeInput] = useState<string>('');
  const [scannedList, setScannedList] = useState<string[]>([]);
  const [autoCountInput, setAutoCountInput] = useState<string>('10');
  const [quantityInput, setQuantityInput] = useState<string>('10');
  const [catatanInput, setCatatanInput] = useState<string>('');
  const [cameraErrorNotice, setCameraErrorNotice] = useState<string | null>(null);

  // Attribution & Time state
  const [actorId, setActorId] = useState<string>('');
  const [onBehalfReason, setOnBehalfReason] = useState<string>('');
  const [occurredAtLocal, setOccurredAtLocal] = useState<string>(() => getCurrentWibDateTimeLocalInput());
  const [timeError, setTimeError] = useState<string | null>(null);
  const [linkedRequest, setLinkedRequest] = useState<RequestRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return contextProducts;
    return contextProducts.filter(
      (p) =>
        p.nama.toLowerCase().includes(q) ||
        (p.jenis_nama && p.jenis_nama.toLowerCase().includes(q))
    );
  }, [contextProducts, productSearch]);

  const initSelections = useCallback(async () => {
    setLoadingInitial(true);
    try {
      let prods = contextProducts;
      let bList = contextBoxes;
      if (prods.length === 0 || bList.length === 0) {
        await refreshData();
        prods = await catalogApi.listProduk();
        bList = await stockApi.listBoxes();
      }
      if (prods.length > 0 && !selectedProductId) {
        setSelectedProductId(prods[0].id);
      }
      if (bList.length > 0 && !selectedBoxId) {
        setSelectedBoxId(bList[0].id);
      }
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setLoadingInitial(false);
    }
  }, [contextProducts, contextBoxes, refreshData, selectedProductId, selectedBoxId, showToast]);

  useEffect(() => {
    if (isOpen) {
      setActorId(user?.id || '');
      setOnBehalfReason('');
      setOccurredAtLocal(getCurrentWibDateTimeLocalInput());
      setLinkedRequest(null);
      setScannedList([]);
      setSingleKodeInput('');
      setCameraErrorNotice(null);
      initSelections();
    }
  }, [isOpen, user?.id]);

  // Sync filtered list selection
  useEffect(() => {
    if (filteredProducts.length > 0 && !filteredProducts.some((p) => p.id === Number(selectedProductId))) {
      setSelectedProductId(filteredProducts[0].id);
    }
  }, [filteredProducts, selectedProductId]);

  // Load tipes when selectedProductId changes
  useEffect(() => {
    if (!selectedProductId) {
      setTipesForSelectedProduct([]);
      setSelectedTipeId('');
      setCurrentTipe(null);
      return;
    }

    const fromContext = contextProducts.find((p) => p.id === Number(selectedProductId));
    if (fromContext?.tipes && fromContext.tipes.length > 0) {
      const tipes = fromContext.tipes;
      setTipesForSelectedProduct(tipes);
      setSelectedTipeId(tipes[0].id);
      setCurrentTipe(tipes[0]);
      if (tipes[0].sumber_id === 'tanpa_id') setInputMode('quantity');
      else if (tipes[0].sumber_id === 'otomatis') setInputMode('bulk_auto');
      else setInputMode('single_scan');
    } else {
      catalogApi.listTipeByProduk(Number(selectedProductId)).then((tipes) => {
        setTipesForSelectedProduct(tipes);
        if (tipes.length > 0) {
          setSelectedTipeId(tipes[0].id);
          setCurrentTipe(tipes[0]);
          if (tipes[0].sumber_id === 'tanpa_id') setInputMode('quantity');
          else if (tipes[0].sumber_id === 'otomatis') setInputMode('bulk_auto');
          else setInputMode('single_scan');
        } else {
          setSelectedTipeId('');
          setCurrentTipe(null);
        }
      });
    }
  }, [selectedProductId, contextProducts]);

  const handleTipeChange = (tipeId: number) => {
    setSelectedTipeId(tipeId);
    const t = tipesForSelectedProduct.find((item) => item.id === tipeId);
    if (t) {
      setCurrentTipe(t);
      if (t.sumber_id === 'tanpa_id') setInputMode('quantity');
      else if (t.sumber_id === 'otomatis') setInputMode('bulk_auto');
      else setInputMode('single_scan');
    }
  };

  const isScanSn = currentTipe?.sumber_id === 'scan_sn';
  const tipePolaRegex = isScanSn ? (currentTipe?.pola_id || '') : undefined;

  const queueScannedSN = async (cleanSN: string, source: 'camera' | 'photo') => {
    if (!cleanSN) return;

    if (scannedList.includes(cleanSN)) {
      showToast(`ID [${cleanSN}] sudah ada di antrean scan.`, 'warning');
      return;
    }

    try {
      const dupCheck = await stockApi.checkDuplicateId(cleanSN);
      if (dupCheck.exists && dupCheck.item) {
        const it = dupCheck.item;
        showToast(`ID [${cleanSN}] sudah terdaftar pada ${it.nama_produk} (Box ${it.kode_box || it.box_id}).`, 'error');
        return;
      }

      setScannedList((prev) => [...prev, cleanSN]);
      showToast(
        source === 'photo'
          ? `SN [${cleanSN}] berhasil diekstrak dari foto!`
          : `[${cleanSN}] berhasil discan dari kamera!`,
        'success'
      );
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const {
    videoRef,
    isCameraActive,
    isPhotoScanning,
    startCamera,
    stopCamera,
    handlePhotoUpload
  } = useBarcodeScanner({
    tipePolaRegex,
    onCameraStart: () => setCameraErrorNotice(null),
    onDetected: (filter) => queueScannedSN(filter.cleanValue.trim(), 'camera'),
    onIgnored: (ignored) => {
      if (isScanSn) {
        setCameraErrorNotice('SN tidak terdeteksi, coba foto ulang');
        showToast('SN tidak terdeteksi, coba foto ulang', 'warning');
      } else {
        showToast(`Abaikan Barcode ${ignored.rawType} (${ignored.cleanValue}). Arahkan ke Barcode SN...`, 'warning');
      }
    },
    onCameraError: (diag) => {
      setCameraErrorNotice(diag.message);
      showToast(diag.message, diag.type === 'insecure' ? 'error' : 'warning');
    },
    onPhotoStart: () => setCameraErrorNotice(null),
    onPhotoDetected: (filter) => queueScannedSN(filter.cleanValue.trim(), 'photo'),
    onPhotoError: (msg) => {
      showToast(msg, 'error');
      setCameraErrorNotice(isScanSn ? msg : `Gagal scan foto: ${msg}`);
    }
  });

  if (!isOpen) return null;

  const handleAddSingleSN = async () => {
    const clean = isScanSn ? singleKodeInput.trim().toUpperCase() : singleKodeInput.trim();
    if (!clean) return;

    if (scannedList.includes(clean)) {
      showToast(`ID [${clean}] sudah ada di antrean scan saat ini.`, 'warning');
      return;
    }

    try {
      const dupCheck = await stockApi.checkDuplicateId(clean);
      if (dupCheck.exists && dupCheck.item) {
        const it = dupCheck.item;
        showToast(`ID [${clean}] sudah terdaftar pada ${it.nama_produk} (Box ${it.kode_box || it.box_id}).`, 'error');
        return;
      }

      if (currentTipe?.pola_id) {
        try {
          const regex = isScanSn ? new RegExp(currentTipe.pola_id.trim(), 'i') : new RegExp(currentTipe.pola_id);
          if (!regex.test(clean)) {
            showToast(`Format ID tidak cocok dengan pola regex: ${currentTipe.pola_id}`, 'error');
            return;
          }
        } catch {
          showToast(`Pola regex tipe tidak valid: ${currentTipe.pola_id}`, 'error');
          return;
        }
      }

      setScannedList((prev) => [...prev, clean]);
      setSingleKodeInput('');
      showToast(`[${clean}] ditambahkan ke antrean scan.`, 'success');
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const handleSubmitStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTipeId || !selectedBoxId) {
      showToast('Lengkapi pilihan Produk, Tipe, dan Storage Box.', 'warning');
      return;
    }
    if (timeError) {
      showToast(timeError, 'error');
      return;
    }
    const isOnBehalf = Boolean(user && actorId && actorId !== user.id);
    if (isOnBehalf && onBehalfReason.trim().length < 3) {
      showToast('Alasan mencatat atas nama orang lain wajib diisi minimal 3 karakter.', 'warning');
      return;
    }

    const attribution = {
      actor_id: actorId || user?.id,
      on_behalf_reason: isOnBehalf ? onBehalfReason.trim() : undefined,
      occurred_at: wibLocalInputToUtcIso(occurredAtLocal)
    };

    setSubmitting(true);
    try {
      if (inputMode === 'single_scan') {
        if (scannedList.length === 0 && !singleKodeInput.trim()) {
          showToast('Masukkan minimal 1 ID / Serial Number.', 'warning');
          setSubmitting(false);
          return;
        }

        const finalSNs = [...scannedList];
        const typedTrimmed = isScanSn ? singleKodeInput.trim().toUpperCase() : singleKodeInput.trim();
        if (typedTrimmed && !finalSNs.includes(typedTrimmed)) {
          finalSNs.push(typedTrimmed);
        }

        if (finalSNs.length === 1) {
          const res = await stockApi.inputSingleStock({
            ...attribution,
            tipe_id: Number(selectedTipeId),
            box_id: selectedBoxId,
            kode_id: finalSNs[0],
            catatan: catatanInput.trim() || undefined
          });
          showToast(res.message, 'success');
        } else {
          const res = await stockApi.inputBulkStock({
            ...attribution,
            tipe_id: Number(selectedTipeId),
            box_id: selectedBoxId,
            kode_ids: finalSNs,
            catatan: catatanInput.trim() || undefined
          });
          showToast(res.message, 'success');
        }
      } else if (inputMode === 'bulk_auto') {
        const count = parseInt(autoCountInput, 10) || 0;
        if (count <= 0) {
          showToast('Jumlah N unit harus lebih besar dari 0.', 'warning');
          setSubmitting(false);
          return;
        }

        const res = await stockApi.inputBulkStock({
          ...attribution,
          tipe_id: Number(selectedTipeId),
          box_id: selectedBoxId,
          auto_count: count,
          catatan: catatanInput.trim() || undefined
        });
        showToast(res.message, 'success');
      } else if (inputMode === 'quantity') {
        const qty = parseInt(quantityInput, 10) || 0;
        if (qty <= 0) {
          showToast('Jumlah unit harus lebih besar dari 0.', 'warning');
          setSubmitting(false);
          return;
        }

        const res = await stockApi.inputQuantityStock({
          ...attribution,
          tipe_id: Number(selectedTipeId),
          box_id: selectedBoxId,
          jumlah: qty,
          catatan: catatanInput.trim() || undefined
        });
        showToast(res.message, 'success');
      }

      await refreshData();
      stopCamera();
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const examplePoYear = getCurrentWibYear();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto transition-colors">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Input Barang Masuk (Katalog Tunggal)
              </h3>
              <p className="text-xs text-slate-500">
                Setiap transaksi mencatat ID Aktivitas unik & waktu kejadian (WIB)
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
            <span>Memuat daftar produk & storage box...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmitStock} className="space-y-4 text-xs">
            {/* Searchable Produk Filter + Produk + Tipe + Box */}
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Cari nama produk atau jenis katalog..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    1. Pilih Produk *
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(Number(e.target.value))}
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium"
                  >
                    {filteredProducts.length === 0 ? (
                      <option value="">Tidak ada produk cocok</option>
                    ) : (
                      filteredProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nama} ({p.jenis_nama || 'Umum'})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    2. Pilih Varian Tipe *
                  </label>
                  <select
                    value={selectedTipeId}
                    onChange={(e) => handleTipeChange(Number(e.target.value))}
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-bold"
                  >
                    {tipesForSelectedProduct.length === 0 ? (
                      <option value="">Belum ada tipe</option>
                    ) : (
                      tipesForSelectedProduct.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nama_tipe}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    3. Storage Box Tujuan *
                  </label>
                  <select
                    value={selectedBoxId}
                    onChange={(e) => setSelectedBoxId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono font-bold"
                  >
                    {contextBoxes.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.kode}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Banner Aturan ID Tipe */}
            {currentTipe && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    Aturan ID Tipe: <code className="text-emerald-600 dark:text-emerald-400">{currentTipe.sumber_id}</code>
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Mode Stok: {currentTipe.mode_stok === 'per_id' ? 'Item Ber-ID Fisik' : 'Stok Jumlah (Non-SN)'}
                    {currentTipe.pola_id ? ` · Regex: ${currentTipe.pola_id}` : ''}
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
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40'
                    }`}
                  >
                    Scan / Manual ID
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputMode('bulk_auto')}
                    disabled={currentTipe.sumber_id !== 'otomatis'}
                    className={`px-2 py-1 rounded text-[10px] font-bold ${
                      inputMode === 'bulk_auto'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40'
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
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40'
                    }`}
                  >
                    Stok Jumlah
                  </button>
                </div>
              </div>
            )}

            {/* Mode 1: Scan Beruntun / Manual ID */}
            {inputMode === 'single_scan' && (
              <div className="space-y-3">
                <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-3 border border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold flex items-center gap-1.5 text-xs text-emerald-400">
                      <QrCode className="w-4 h-4" /> Pemindai Barcode / QR Label
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shrink-0">
                        <Upload className="w-4 h-4" />
                        <span>{isPhotoScanning ? 'Membaca Foto...' : 'Scan dari Foto / Galeri'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoUpload}
                          disabled={isPhotoScanning}
                          className="hidden"
                        />
                      </label>

                      {!isCameraActive ? (
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 shrink-0 border border-slate-700"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Kamera Live</span>
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

                  {cameraErrorNotice && (
                    <div className="p-2.5 rounded-lg bg-rose-950/90 border border-rose-700 text-rose-200 text-[11px] flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="flex-1">{cameraErrorNotice}</div>
                    </div>
                  )}

                  {isCameraActive && (
                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-700">
                      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                        <div className="w-full max-w-[280px] sm:max-w-xs h-24 sm:h-28 border-2 border-emerald-400 rounded-xl relative overflow-hidden bg-emerald-950/10">
                          <div className="w-full h-0.5 bg-emerald-400 absolute top-1/2 -translate-y-1/2" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ketik ID / Serial Number (Tekan Enter atau klik Tambah untuk multi-item)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Masukkan SN atau scan barcode..."
                      value={singleKodeInput}
                      onChange={(e) => setSingleKodeInput(e.target.value)}
                      onKeyDown={(e) => {
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

                {scannedList.length > 0 && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                        Antrean Input ({scannedList.length} unit)
                      </span>
                      <button
                        type="button"
                        onClick={() => setScannedList([])}
                        className="text-rose-500 hover:underline text-[10px]"
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
                            onClick={() => setScannedList((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-rose-500"
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
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={autoCountInput}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setAutoCountInput(e.target.value.replace(/\D/g, ''))}
                  onBlur={() => { if (!autoCountInput || autoCountInput === '0') setAutoCountInput('10'); }}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono font-bold"
                />
                <span className="text-[11px] text-slate-500 block">
                  Sistem membuat {autoCountInput || '0'} ID berurutan dengan prefix "{currentTipe?.prefix_id || 'ITEM-'}" dalam 1 transaksi.
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
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={quantityInput}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setQuantityInput(e.target.value.replace(/\D/g, ''))}
                  onBlur={() => { if (!quantityInput || quantityInput === '0') setQuantityInput('10'); }}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono font-bold"
                />
              </div>
            )}

            {/* Attribution & WIB Time */}
            <TransactionAttributionFields
              mode="IN"
              actorId={actorId}
              onActorIdChange={setActorId}
              onBehalfReason={onBehalfReason}
              onBehalfReasonChange={setOnBehalfReason}
              occurredAtLocal={occurredAtLocal}
              onOccurredAtLocalChange={setOccurredAtLocal}
              selectedRequest={linkedRequest}
              onSelectRequest={setLinkedRequest}
              onTimeValidationChange={setTimeError}
            />

            {/* Catatan Transaksi */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Catatan Transaksi / Nomor Surat Jalan PO (Opsional)
              </label>
              <input
                type="text"
                placeholder={`Misal: Penerimaan PO-${examplePoYear}-001 dari Suplier Utama`}
                value={catatanInput}
                onChange={(e) => setCatatanInput(e.target.value)}
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
                disabled={submitting || Boolean(timeError)}
                className="px-5 py-2 font-bold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-50 rounded-lg shadow-xs"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Barang Masuk'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
