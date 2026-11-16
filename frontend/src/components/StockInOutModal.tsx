/**
 * Stock Output Modal (Catat Barang Keluar — Canonical Single Catalog)
 * Mendukung pencarian 300ms (SN/Produk/Tipe/Box), Scan Foto/Kamera, Keranjang Keluar Multi-Item,
 * Mode Stok Jumlah (TANPA_ID), Atas Nama + Alasan, Waktu Kejadian WIB, & 1-Klik Hubungkan Request.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  ArrowUpRight,
  AlertCircle,
  FileCheck,
  Camera,
  QrCode,
  Search,
  Upload,
  Plus,
  Trash2,
  ShoppingCart,
  Package
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { SearchStockItemResult, stockApi } from '../services/stockApi';
import { RequestRecord } from '../services/requestApi';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { extractSNFromBarcode } from '../utils/scannerUtils';
import { getErrorMessage } from '../utils/errorUtils';
import { getCurrentWibDateTimeLocalInput, getCurrentWibYear, wibLocalInputToUtcIso } from '../utils/timezone';
import { TransactionAttributionFields } from './stock/TransactionAttributionFields';

interface OutputCartEntry {
  key: string;
  kind: 'per_id' | 'quantity';
  itemId?: string;
  kodeId?: string;
  tipeId: number;
  boxId?: string;
  boxKode?: string;
  namaProduk: string;
  namaTipe: string;
  jumlah: number;
  unit: string;
}

interface StockInOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItem?: { kode_id?: string; tipe_id?: number } | null;
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
  initialItem,
  onSuccessPrint
}) => {
  const { user } = useAuth();
  const { products, boxes, refreshData, showToast } = useInventory();

  // Primary search (300ms debounce)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchStockItemResult[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Output Cart
  const [cart, setCart] = useState<OutputCartEntry[]>([]);

  // Non-SN / TANPA_ID alternative selector
  const [nonSnProductId, setNonSnProductId] = useState<number | ''>('');
  const [nonSnTipeId, setNonSnTipeId] = useState<number | ''>('');
  const [nonSnBoxId, setNonSnBoxId] = useState<string>('');
  const [nonSnQty, setNonSnQty] = useState<string>('1');

  // Metadata & Attribution
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [recipientDestination, setRecipientDestination] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [actorId, setActorId] = useState<string>('');
  const [onBehalfReason, setOnBehalfReason] = useState<string>('');
  const [occurredAtLocal, setOccurredAtLocal] = useState<string>(() => getCurrentWibDateTimeLocalInput());
  const [timeError, setTimeError] = useState<string | null>(null);
  const [linkedRequest, setLinkedRequest] = useState<RequestRecord | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Products that have at least one non-SN (jumlah / tanpa_id) type
  const quantityProducts = useMemo(() => {
    return products.filter((p) => (p.tipes || []).some((t) => t.mode_stok === 'jumlah' || t.sumber_id === 'tanpa_id'));
  }, [products]);

  const selectedNonSnProduct = useMemo(() => {
    return quantityProducts.find((p) => p.id === Number(nonSnProductId)) || null;
  }, [quantityProducts, nonSnProductId]);

  const nonSnTipes = useMemo(() => {
    if (!selectedNonSnProduct) return [];
    return (selectedNonSnProduct.tipes || []).filter((t) => t.mode_stok === 'jumlah' || t.sumber_id === 'tanpa_id');
  }, [selectedNonSnProduct]);

  const selectedNonSnTipe = useMemo(() => {
    return nonSnTipes.find((t) => t.id === Number(nonSnTipeId)) || null;
  }, [nonSnTipes, nonSnTipeId]);

  const availableBoxesForNonSn = useMemo(() => {
    if (!selectedNonSnTipe) return [];
    return selectedNonSnTipe.sebaran_box || [];
  }, [selectedNonSnTipe]);

  const maxAvailNonSnBox = useMemo(() => {
    if (!selectedNonSnTipe) return 0;
    if (nonSnBoxId && availableBoxesForNonSn.length > 0) {
      const b = availableBoxesForNonSn.find((sb) => sb.box_id === nonSnBoxId);
      return b ? Number(b.jumlah || 0) : 0;
    }
    return Number(selectedNonSnTipe.stok_tersedia || 0);
  }, [selectedNonSnTipe, nonSnBoxId, availableBoxesForNonSn]);

  // Reset form on open
  useEffect(() => {
    if (!isOpen) return;
    const year = getCurrentWibYear();
    setSearchQuery(initialItem?.kode_id || '');
    setSearchResults([]);
    setCart([]);
    setScanFeedback(null);
    setReferenceNumber(`TCK-${year}-${Math.floor(1000 + Math.random() * 9000)}`);
    setRecipientDestination('');
    setNotes('');
    setActorId(user?.id || '');
    setOnBehalfReason('');
    setOccurredAtLocal(getCurrentWibDateTimeLocalInput());
    setLinkedRequest(null);
    setNonSnQty('1');

    if (quantityProducts.length > 0) {
      setNonSnProductId(quantityProducts[0].id);
    } else {
      setNonSnProductId('');
    }
  }, [isOpen, initialItem?.kode_id, user?.id, quantityProducts.length]);

  // Sync non-SN tipe & box defaults
  useEffect(() => {
    if (nonSnTipes.length > 0) {
      setNonSnTipeId(nonSnTipes[0].id);
    } else {
      setNonSnTipeId('');
    }
  }, [selectedNonSnProduct?.id]);

  useEffect(() => {
    if (availableBoxesForNonSn.length > 0) {
      setNonSnBoxId(availableBoxesForNonSn[0].box_id);
    } else if (boxes.length > 0) {
      setNonSnBoxId(boxes[0].id);
    } else {
      setNonSnBoxId('');
    }
  }, [selectedNonSnTipe?.id, availableBoxesForNonSn.length]);

  // 300ms debounced search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await stockApi.searchItems(searchQuery.trim());
        setSearchResults(res);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [isOpen, searchQuery]);

  const addPerIdItemToCart = useCallback((item: SearchStockItemResult) => {
    if (!item.selectable) {
      const reason = item.unselectableReason || `Item "${item.kode_id}" tidak tersedia (${item.status}).`;
      setScanFeedback({ type: 'error', message: reason });
      showToast(reason, 'error');
      return;
    }

    const key = `id-${item.id}`;
    if (cart.some((c) => c.key === key)) {
      showToast(`SN [${item.kode_id}] sudah ada di Keranjang Keluar.`, 'warning');
      return;
    }

    setCart((prev) => [
      ...prev,
      {
        key,
        kind: 'per_id',
        itemId: item.id,
        kodeId: item.kode_id,
        tipeId: item.tipe_id,
        boxId: item.box_id,
        boxKode: item.box_kode,
        namaProduk: item.nama_produk,
        namaTipe: item.nama_tipe,
        jumlah: 1,
        unit: item.tipe_stok || 'unit'
      }
    ]);
    setScanFeedback({
      type: 'success',
      message: `[${item.kode_id}] ${item.nama_produk} (${item.nama_tipe}) ditambahkan ke Keranjang Keluar.`
    });
  }, [cart, showToast]);

  const handleScannedCode = useCallback(async (rawCode: string) => {
    const filter = extractSNFromBarcode(rawCode);
    const code = filter.isSN ? filter.cleanValue.trim() : rawCode.trim();
    if (!code) {
      const msg = 'SN tidak terdeteksi, coba foto ulang';
      setScanFeedback({ type: 'error', message: msg });
      showToast(msg, 'error');
      return;
    }

    setSearchQuery(code);
    try {
      const matches = await stockApi.searchItems(code);
      setSearchResults(matches);

      const exact = matches.find((m) => m.kode_id.toLowerCase() === code.toLowerCase());
      const target = exact || (matches.length === 1 ? matches[0] : null);

      if (!target) {
        const msg = matches.length === 0
          ? `SN "${code}" tidak ditemukan di database stok.`
          : `Ditemukan ${matches.length} kandidat untuk "${code}". Pilih langsung dari daftar di bawah.`;
        setScanFeedback({ type: matches.length === 0 ? 'error' : 'warning', message: msg });
        showToast(msg, matches.length === 0 ? 'error' : 'info');
        return;
      }

      addPerIdItemToCart(target);
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    }
  }, [addPerIdItemToCart, showToast]);

  const {
    videoRef,
    isCameraActive,
    isPhotoScanning,
    startCamera,
    stopCamera,
    handlePhotoUpload
  } = useBarcodeScanner({
    tipePolaRegex: '',
    stopOnDetect: true,
    onCameraStart: () => setScanFeedback(null),
    onDetected: (filter) => handleScannedCode(filter.cleanValue),
    onIgnored: () => {
      setScanFeedback({ type: 'error', message: 'SN tidak terdeteksi, coba foto ulang' });
    },
    onCameraError: (diag) => {
      showToast(diag.message, diag.type === 'insecure' ? 'error' : 'warning');
      setScanFeedback({ type: 'error', message: diag.message });
    },
    onPhotoStart: () => setScanFeedback(null),
    onPhotoDetected: (filter) => handleScannedCode(filter.cleanValue),
    onPhotoError: (msg) => {
      showToast(msg, 'error');
      setScanFeedback({ type: 'error', message: msg });
    }
  });

  // Auto-fill when linking an open request
  const handleSelectRequest = async (req: RequestRecord | null) => {
    setLinkedRequest(req);
    if (!req) return;

    setReferenceNumber(req.id);
    if (!notes.trim()) {
      setNotes(`Realisasi Request ${req.id}: ${req.alasan}`);
    }
    if (!recipientDestination.trim() && req.nama_pemohon) {
      setRecipientDestination(`Teknisi ${req.nama_pemohon}`);
    }

    if (req.kode_id) {
      try {
        const res = await stockApi.searchItems(req.kode_id);
        const match = res.find((r) => r.kode_id.toUpperCase() === req.kode_id!.toUpperCase());
        if (match) {
          setCart((prev) => {
            if (prev.some((c) => c.kodeId?.toUpperCase() === match.kode_id.toUpperCase())) return prev;
            return [
              ...prev,
              {
                key: `id-${match.id}`,
                kind: 'per_id',
                itemId: match.id,
                kodeId: match.kode_id,
                tipeId: match.tipe_id,
                boxId: match.box_id,
                boxKode: match.box_kode,
                namaProduk: match.nama_produk,
                namaTipe: match.nama_tipe,
                jumlah: 1,
                unit: match.tipe_stok || 'unit'
              }
            ];
          });
        }
      } catch {
        // Ignore if not found locally
      }
    }
    showToast(`Terhubung ke ${req.id}`, 'info');
  };

  if (!isOpen) return null;

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const handleAddNonSnToCart = () => {
    if (!selectedNonSnProduct || !selectedNonSnTipe || !nonSnBoxId) {
      showToast('Pilih Produk, Tipe, dan Box untuk mode tanpa SN.', 'warning');
      return;
    }
    const qty = parseInt(nonSnQty, 10) || 0;
    if (qty <= 0) {
      showToast('Jumlah keluar harus lebih besar dari 0.', 'warning');
      return;
    }

    const alreadyInCart = cart
      .filter((c) => c.kind === 'quantity' && c.tipeId === selectedNonSnTipe.id && c.boxId === nonSnBoxId)
      .reduce((sum, c) => sum + c.jumlah, 0);

    if (qty + alreadyInCart > maxAvailNonSnBox) {
      showToast(`Jumlah melebihi stok tersedia (${maxAvailNonSnBox} ${selectedNonSnProduct.tipe_stok || 'unit'}).`, 'error');
      return;
    }

    const boxObj = boxes.find((b) => b.id === nonSnBoxId);
    const key = `qty-${selectedNonSnTipe.id}-${nonSnBoxId}`;
    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        return prev.map((c) => (c.key === key ? { ...c, jumlah: c.jumlah + qty } : c));
      }
      return [
        ...prev,
        {
          key,
          kind: 'quantity',
          tipeId: selectedNonSnTipe.id,
          boxId: nonSnBoxId,
          boxKode: boxObj?.kode || nonSnBoxId,
          namaProduk: selectedNonSnProduct.nama,
          namaTipe: selectedNonSnTipe.nama_tipe,
          jumlah: qty,
          unit: selectedNonSnProduct.tipe_stok || 'unit'
        }
      ];
    });
    setNonSnQty('1');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      showToast('Keranjang Keluar masih kosong. Pilih minimal 1 barang.', 'warning');
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

    const occurredIso = wibLocalInputToUtcIso(occurredAtLocal);
    const payloadItems = cart.map((c) =>
      c.kind === 'per_id'
        ? { itemId: c.itemId, kodeId: c.kodeId, tipeId: c.tipeId }
        : { tipeId: c.tipeId, boxId: c.boxId, jumlah: c.jumlah }
    );

    setSubmitting(true);
    try {
      const res = await stockApi.outBulk({
        items: payloadItems,
        actor_id: actorId || user?.id,
        on_behalf_reason: isOnBehalf ? onBehalfReason.trim() : undefined,
        occurred_at: occurredIso,
        request_id: linkedRequest?.id,
        reference_number: referenceNumber.trim() || undefined,
        recipient_destination: recipientDestination.trim() || 'Pekerjaan Lapangan',
        catatan: notes.trim() || undefined
      });

      showToast(res.message || 'Barang keluar berhasil dicatat.', res.lowStockAlert ? 'warning' : 'success');
      await refreshData();

      if (onSuccessPrint) {
        const first = cart[0];
        const totalQty = cart.reduce((s, c) => s + c.jumlah, 0);
        const actorName = actorId && actorId !== user?.id ? recipientDestination || actorId : user?.name || 'Petugas IT';
        onSuccessPrint({
          type: 'OUT',
          itemName: cart.length === 1 ? `${first.namaProduk} - ${first.namaTipe}` : `${cart.length} Item Suku Cadang`,
          itemSku: cart.length === 1 ? (first.kodeId || `TIPE-${first.tipeId}`) : `BULK-${cart.length}`,
          quantity: totalQty,
          unit: first.unit,
          referenceNumber: referenceNumber.trim() || res.activityId || '-',
          recipientOrDestination: recipientDestination.trim() || 'Lokasi Lapangan',
          performedBy: actorName,
          notes: notes.trim(),
          date: occurredIso
        });
      }

      stopCamera();
      onClose();
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Output Barang Keluar (Katalog Tunggal)</h2>
              <p className="text-xs text-slate-300">
                Cari SN / Produk / Box atau scan barcode · Hanya item tersedia &amp; non-rusak
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto">
          {/* Primary Search + Scan Module */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Cari Item Tersedia atau Scan SN</span>
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <label className="px-2.5 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isPhotoScanning ? 'Membaca Foto...' : 'Scan Foto'}</span>
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
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-md flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Kamera</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-md flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Matikan</span>
                  </button>
                )}
              </div>
            </div>

            {isCameraActive && (
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-700">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              </div>
            )}

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Ketik SN (misal ZTEGD...), nama produk, tipe, atau kode box..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (searchQuery.trim()) handleScannedCode(searchQuery);
                  }
                }}
                className="w-full py-2 pl-9 pr-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-white"
              />
            </div>

            {scanFeedback && (
              <div
                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                  scanFeedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : scanFeedback.type === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                }`}
              >
                <span>{scanFeedback.message}</span>
                <button type="button" onClick={() => setScanFeedback(null)}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Search results table */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {searching ? (
                <div className="p-4 text-center text-slate-500">Mencari item di katalog...</div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  {searchQuery.trim()
                    ? `Tidak ada item cocok untuk "${searchQuery}".`
                    : 'Ketik kata kunci atau pilih dari daftar item ber-ID.'}
                </div>
              ) : (
                searchResults.map((item) => {
                  const statusLabel =
                    item.status === 'aktif'
                      ? item.kondisi === 'Rusak'
                        ? 'Rusak'
                        : 'Tersedia'
                      : item.status === 'dipesan'
                      ? 'Dipesan'
                      : item.status === 'keluar'
                      ? 'Sudah Keluar'
                      : item.status;

                  const inCart = cart.some((c) => c.itemId === item.id);

                  return (
                    <div
                      key={item.id}
                      className={`p-2.5 flex items-center justify-between gap-2 ${
                        !item.selectable ? 'opacity-65 bg-slate-50 dark:bg-slate-900/50' : 'hover:bg-slate-50 dark:hover:bg-slate-900/40'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{item.kode_id}</span>
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            · Box {item.box_kode}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold ${
                              item.selectable
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            · {statusLabel}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                          {item.nama_produk} — {item.nama_tipe} · Kondisi: {item.kondisi}
                        </div>
                        {!item.selectable && item.unselectableReason && (
                          <div className="text-[10px] text-rose-600 dark:text-rose-400">
                            {item.unselectableReason}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={!item.selectable || inCart}
                        onClick={() => addPerIdItemToCart(item)}
                        className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold shrink-0 flex items-center gap-1 ${
                          inCart
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : item.selectable
                            ? 'bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-800 dark:hover:bg-emerald-500'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{inCart ? 'Di Keranjang' : 'Pilih'}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Non-SN / TANPA_ID Alternative Selector */}
          {quantityProducts.length > 0 && (
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 space-y-2.5">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Tambah Item Tanpa SN (Mode Stok Jumlah)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Produk</label>
                  <select
                    value={nonSnProductId}
                    onChange={(e) => setNonSnProductId(Number(e.target.value))}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    {quantityProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nama}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Tipe</label>
                  <select
                    value={nonSnTipeId}
                    onChange={(e) => setNonSnTipeId(Number(e.target.value))}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    {nonSnTipes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nama_tipe} (Sisa: {t.stok_tersedia ?? 0})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Box</label>
                  <select
                    value={nonSnBoxId}
                    onChange={(e) => setNonSnBoxId(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-slate-100"
                  >
                    {availableBoxesForNonSn.length > 0 ? (
                      availableBoxesForNonSn.map((sb) => (
                        <option key={sb.box_id} value={sb.box_id}>
                          {sb.box_kode} ({sb.jumlah})
                        </option>
                      ))
                    ) : (
                      <option value="">Stok box kosong</option>
                    )}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="flex-1">
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      Qty (Maks {maxAvailNonSnBox})
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={nonSnQty}
                      onChange={(e) => setNonSnQty(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddNonSnToCart}
                    disabled={maxAvailNonSnBox <= 0}
                    className="mt-4 px-2.5 py-1.5 font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-lg shrink-0"
                  >
                    + Keranjang
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Keranjang Keluar */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 tabular-nums">
                <ShoppingCart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Keranjang Keluar ({cart.length} baris · Total {cart.reduce((s, c) => s + c.jumlah, 0)} unit)</span>
              </span>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline"
                >
                  Kosongkan Keranjang
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-3 text-center text-slate-500 dark:text-slate-400 text-[11px]">
                Belum ada item di Keranjang Keluar. Pilih item dari pencarian di atas.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950">
                {cart.map((entry) => (
                  <div key={entry.key} className="p-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                        {entry.namaProduk} — {entry.namaTipe}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {entry.kodeId ? `SN: ${entry.kodeId}` : `Stok Jumlah`} · Box {entry.boxKode} · Qty: {entry.jumlah} {entry.unit}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCart((prev) => prev.filter((c) => c.key !== entry.key))}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                      title="Hapus dari keranjang"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attribution, WIB Time, & 1-Click Link to Request */}
          <TransactionAttributionFields
            mode="OUT"
            actorId={actorId}
            onActorIdChange={setActorId}
            onBehalfReason={onBehalfReason}
            onBehalfReasonChange={setOnBehalfReason}
            occurredAtLocal={occurredAtLocal}
            onOccurredAtLocalChange={setOccurredAtLocal}
            selectedRequest={linkedRequest}
            onSelectRequest={handleSelectRequest}
            onTimeValidationChange={setTimeError}
          />

          {/* Reference & Destination */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nomor Tiket / Referensi *
              </label>
              <input
                type="text"
                required
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder={`Contoh: TCK-${getCurrentWibYear()}-1042`}
                className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tujuan Pemasangan / Teknisi Penerima
              </label>
              <input
                type="text"
                value={recipientDestination}
                onChange={(e) => setRecipientDestination(e.target.value)}
                placeholder="Misal: Pelanggan Cluster A / ODP Sektor 2"
                className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Keterangan / Catatan Lapangan
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Alasan pengeluaran barang atau detail perbaikan..."
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || cart.length === 0 || Boolean(timeError)}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-40 rounded-lg flex items-center gap-1.5"
            >
              <FileCheck className="w-4 h-4" />
              <span>{submitting ? 'Memproses...' : `Catat Keluar (${cart.reduce((s, c) => s + c.jumlah, 0)} unit)`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
