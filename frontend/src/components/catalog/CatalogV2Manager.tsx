/**
 * Catalog V2 Manager (Jenis, Atribut, Produk, dan Tipe)
 * FieldOps Inventory v2 - Tahap 2: Katalog Bertingkat
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Layers,
  Plus,
  Tag,
  Search,
  Filter,
  Sliders,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  QrCode,
  RefreshCw,
  Info,
  Hash,
  Database,
  Box as BoxIcon,
  Camera,
  ArrowRightLeft,
  Folder,
  Briefcase
} from 'lucide-react';
import { catalogApi, Jenis, Atribut, Produk, Tipe } from '../../services/catalogApi';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../context/InventoryContext';
import { StockInputModal } from '../stock/StockInputModal';
import { BoxManagerModal } from '../stock/BoxManagerModal';
import { BoxContentModal } from '../stock/BoxContentModal';
import { CatalogSummaryCards } from './CatalogSummaryCards';
import { CatalogBrowseCategoriesTab } from './CatalogBrowseCategoriesTab';
import { CatalogBoxesTab } from './CatalogBoxesTab';
import { CatalogManageTab } from './CatalogManageTab';
import { TrashModal } from '../TrashModal';

interface CatalogV2ManagerProps {
  onOpenChecklist?: () => void;
  onOpenRestore?: () => void;
  onOpenStockInItem?: (item: any) => void;
  onOpenStockOutItem?: (item: any) => void;
}

export const CatalogV2Manager: React.FC<CatalogV2ManagerProps> = ({
  onOpenChecklist,
  onOpenRestore,
  onOpenStockInItem,
  onOpenStockOutItem,
}) => {
  const { user } = useAuth();
  const { showToast, trashItems } = useInventory();

  // Role check
  const isTechnician = user?.role === 'technician';
  const canManageCatalog = user?.role === 'developer' || user?.role === 'admin' || user?.role === 'warehouse_admin';

  // Sub-tab bawaan: teknisi -> 'kategori', admin/gudang/dev -> 'produk'
  const [activeSubTab, setActiveSubTab] = useState<'produk' | 'kategori' | 'boxes' | 'kelola'>(
    isTechnician ? 'kategori' : 'produk'
  );
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'aman' | 'menipis' | 'habis'>('ALL');
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  const [jenisList, setJenisList] = useState<Jenis[]>([]);
  const [products, setProducts] = useState<Produk[]>([]);
  const [boxesList, setBoxesList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter & Pencarian Produk
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJenisId, setSelectedJenisId] = useState<string>('ALL');
  const [selectedKategori, setSelectedKategori] = useState<string>('ALL');
  const [selectedKategoriBarang, setSelectedKategoriBarang] = useState<string>('ALL');
  const [expandedProductIds, setExpandedProductIds] = useState<{ [id: number]: boolean }>({});

  // Filter Atribut Dinamis
  const [attrOptionFilters, setAttrOptionFilters] = useState<{ [attrId: number]: string }>({});
  const [attrMinNumberFilters, setAttrMinNumberFilters] = useState<{ [attrId: number]: string }>({});

  // Modals
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddTypeOpen, setIsAddTypeOpen] = useState(false);
  const [selectedProductForType, setSelectedProductForType] = useState<Produk | null>(null);

  const [isAddJenisOpen, setIsAddJenisOpen] = useState(false);
  const [isAddAttrOpen, setIsAddAttrOpen] = useState(false);
  const [selectedJenisForAttr, setSelectedJenisForAttr] = useState<Jenis | null>(null);

  const [isCorrectIdRuleOpen, setIsCorrectIdRuleOpen] = useState(false);
  const [selectedTypeForIdRule, setSelectedTypeForIdRule] = useState<Tipe | null>(null);

  // Tahap 3 & 4 Stock Modals
  const [isStockInputOpen, setIsStockInputOpen] = useState(false);
  const [isBoxManagerOpen, setIsBoxManagerOpen] = useState(false);
  const [selectedBoxForContent, setSelectedBoxForContent] = useState<string | null>(null);

  // Tahap 4: Modal Detail Item Fisik & Stok Tipe
  const [selectedTypeForItems, setSelectedTypeForItems] = useState<Tipe | null>(null);
  const [typeItemsData, setTypeItemsData] = useState<{ items: any[]; stokJumlah: any[] }>({ items: [], stokJumlah: [] });
  const [loadingTypeItems, setLoadingTypeItems] = useState<boolean>(false);
  const [itemConditionFilter, setItemConditionFilter] = useState<string>('ALL');

  const handleOpenTypeItems = async (tipe: Tipe) => {
    setSelectedTypeForItems(tipe);
    setItemConditionFilter('ALL');
    setLoadingTypeItems(true);
    try {
      const res = await catalogApi.getItemsByTipe(tipe.id);
      setTypeItemsData(res);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoadingTypeItems(false);
    }
  };

  // Form Buat Produk (Paket 4: kategori_barang & tipe_stok with suggestions)
  const [newProdJenisId, setNewProdJenisId] = useState<number | ''>('');
  const [newProdNama, setNewProdNama] = useState('');
  const [newProdKategori, setNewProdKategori] = useState<'fast_moving' | 'recycle'>('fast_moving');
  const [newProdKategoriBarang, setNewProdKategoriBarang] = useState<'Alat' | 'Barang Habis Pakai'>('Barang Habis Pakai');
  const [newProdTipeStok, setNewProdTipeStok] = useState<string>('unit');
  const [newProdCatatan, setNewProdCatatan] = useState('');
  const [newProdStokAwal, setNewProdStokAwal] = useState<string>('0');
  const [tipeStokSuggestions, setTipeStokSuggestions] = useState<string[]>(['unit', 'roll', 'meter', 'pcs', 'box', 'set']);

  // Form Buat Tipe
  const [typeAttrValues, setTypeAttrValues] = useState<{
    [attrId: number]: {
      nilai_angka?: number | '';
      opsi_id?: number | '';
      opsi_baru?: string;
      nilai_teks?: string;
    };
  }>({});
  const [typeSumberId, setTypeSumberId] = useState<'scan_sn' | 'otomatis' | 'manual' | 'tanpa_id'>('manual');
  const [typePrefixId, setTypePrefixId] = useState('');
  const [typePolaId, setTypePolaId] = useState('');
  const [typeCatatan, setTypeCatatan] = useState('');

  // Form Koreksi Aturan ID
  const [correctSumberId, setCorrectSumberId] = useState<'scan_sn' | 'otomatis' | 'manual' | 'tanpa_id'>('manual');
  const [correctPrefixId, setCorrectPrefixId] = useState('');
  const [correctPolaId, setCorrectPolaId] = useState('');
  const [correctAlasan, setCorrectAlasan] = useState('');

  // Form Buat Atribut
  const [newAttrKode, setNewAttrKode] = useState('');
  const [newAttrNama, setNewAttrNama] = useState('');
  const [newAttrTipeIsian, setNewAttrTipeIsian] = useState<'angka' | 'pilihan' | 'teks'>('pilihan');
  const [newAttrSatuan, setNewAttrSatuan] = useState('');
  const [newAttrWajib, setNewAttrWajib] = useState(true);
  const [newAttrMasukNama, setNewAttrMasukNama] = useState(true);
  const [newAttrOpsiText, setNewAttrOpsiText] = useState('');

  // Form Buat Jenis
  const [newJenisNama, setNewJenisNama] = useState('');
  const [newJenisSumberId, setNewJenisSumberId] = useState<'scan_sn' | 'otomatis' | 'manual' | 'tanpa_id'>('manual');
  const [newJenisPrefix, setNewJenisPrefix] = useState('');

  // Memuat data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [jList, pList, bList, suggestions] = await Promise.all([
        catalogApi.listJenis(),
        catalogApi.listProduk(),
        catalogApi.listBoxes().catch(() => []),
        catalogApi.getTipeStokSuggestions().catch(() => ['unit', 'roll', 'meter', 'pcs', 'box', 'set'])
      ]);
      setJenisList(jList);
      setProducts(pList);
      setBoxesList(bList || []);
      if (suggestions && suggestions.length > 0) {
        setTipeStokSuggestions(suggestions);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Atribut yang dimiliki oleh jenis yang sedang dipilih untuk filter
  const currentJenisAttributes = useMemo(() => {
    if (selectedJenisId === 'ALL') return [];
    const j = jenisList.find(item => item.id === parseInt(selectedJenisId, 10));
    return j?.atributs || [];
  }, [selectedJenisId, jenisList]);

  // Kalkulasi nama tipe otomatis di form tambah tipe secara real-time
  const computedAutoTypeName = useMemo(() => {
    if (!selectedProductForType) return '';
    const j = jenisList.find(item => item.id === selectedProductForType.jenis_id);
    if (!j || !j.atributs) return 'Standar';

    const sortedAttrs = [...j.atributs].sort((a, b) => a.urutan - b.urutan);
    const parts: string[] = [];

    for (const a of sortedAttrs) {
      if (!a.masuk_nama) continue;
      const val = typeAttrValues[a.id];
      if (!val) continue;

      if (a.tipe_isian === 'angka' && typeof val.nilai_angka === 'number') {
        parts.push(`${val.nilai_angka}${a.satuan || ''}`);
      } else if (a.tipe_isian === 'pilihan') {
        if (val.opsi_baru && val.opsi_baru.trim().length > 0) {
          parts.push(val.opsi_baru.trim());
        } else if (val.opsi_id && a.opsi) {
          const matched = a.opsi.find(o => o.id === val.opsi_id);
          if (matched) parts.push(matched.nilai.trim());
        }
      } else if (a.tipe_isian === 'teks' && val.nilai_teks) {
        parts.push(val.nilai_teks.trim());
      }
    }

    return parts.length > 0 ? parts.join(' / ') : 'Standar';
  }, [selectedProductForType, jenisList, typeAttrValues]);

  // Filter daftar produk
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return products.filter(p => {
      // Filter status stok agregasi (aman, menipis, habis)
      if (statusFilter !== 'ALL' && (p.status_stok || 'aman') !== statusFilter) {
        return false;
      }

      if (selectedJenisId !== 'ALL' && p.jenis_id !== parseInt(selectedJenisId, 10)) {
        return false;
      }

      if (selectedKategori !== 'ALL' && p.kategori !== selectedKategori) {
        return false;
      }

      if (selectedKategoriBarang !== 'ALL' && (p.kategori_barang || 'Barang Habis Pakai') !== selectedKategoriBarang) {
        return false;
      }

      if (q !== '') {
        const matchName = p.nama.toLowerCase().includes(q);
        const matchJenis = (p.jenis_nama || '').toLowerCase().includes(q);
        if (!matchName && !matchJenis) return false;
      }

      // Filter atribut dinamis (jika ada tipe di bawah produk)
      if (selectedJenisId !== 'ALL' && p.tipes && p.tipes.length > 0) {
        // Cek filter opsi
        for (const [attrIdStr, selectedOpsi] of Object.entries(attrOptionFilters)) {
          if (!selectedOpsi) continue;
          const attrId = parseInt(attrIdStr, 10);
          const hasMatchingTipe = p.tipes.some(t => {
            const valObj = t.nilai_atribut?.find(v => v.atribut_id === attrId);
            return valObj && String(valObj.opsi_id) === String(selectedOpsi);
          });
          if (!hasMatchingTipe) return false;
        }

        // Cek filter angka minimal
        for (const [attrIdStr, minValStr] of Object.entries(attrMinNumberFilters)) {
          if (!minValStr) continue;
          const minVal = parseFloat(minValStr);
          if (isNaN(minVal)) continue;
          const attrId = parseInt(attrIdStr, 10);
          const hasMatchingTipe = p.tipes.some(t => {
            const valObj = t.nilai_atribut?.find(v => v.atribut_id === attrId);
            return valObj && typeof valObj.nilai_angka === 'number' && valObj.nilai_angka >= minVal;
          });
          if (!hasMatchingTipe) return false;
        }
      }

      return true;
    });
  }, [products, statusFilter, selectedJenisId, selectedKategori, searchQuery, attrOptionFilters, attrMinNumberFilters]);

  // Toggle detail produk & muat tipe
  const toggleProductExpand = async (productId: number) => {
    const isNowExpanded = !expandedProductIds[productId];
    setExpandedProductIds(prev => ({ ...prev, [productId]: isNowExpanded }));

    if (isNowExpanded) {
      try {
        const types = await catalogApi.listTipeByProduk(productId);
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, tipes: types } : p));
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    }
  };

  // Buka modal buat tipe untuk produk tertentu
  const handleOpenAddType = (prod: Produk) => {
    setSelectedProductForType(prod);
    const j = jenisList.find(item => item.id === prod.jenis_id);

    // Set default sumber_id dari jenis
    setTypeSumberId(j?.sumber_id_bawaan || 'manual');
    setTypePrefixId(j?.prefix_id_bawaan || '');
    setTypePolaId('');
    setTypeCatatan('');
    setTypeAttrValues({});
    setIsAddTypeOpen(true);
  };

  // Simpan Produk Baru
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdJenisId || !newProdNama.trim()) {
      showToast('Pilih Jenis dan masukkan nama produk.', 'warning');
      return;
    }

    try {
      await catalogApi.createProduk({
        jenis_id: Number(newProdJenisId),
        nama: newProdNama.trim(),
        kategori: newProdKategori,
        kategori_barang: newProdKategoriBarang,
        tipe_stok: newProdTipeStok.trim().toLowerCase() || 'unit',
        catatan: newProdCatatan.trim() || undefined,
        stok_awal: parseInt(newProdStokAwal, 10) || 0
      });

      showToast(`Produk "${newProdNama.trim()}" berhasil dibuat.`, 'success');
      setIsAddProductOpen(false);
      setNewProdNama('');
      setNewProdCatatan('');
      setNewProdStokAwal('0');
      setNewProdKategoriBarang('Barang Habis Pakai');
      setNewProdTipeStok('unit');
      await loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Simpan Tipe Baru
  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForType) return;

    const j = jenisList.find(item => item.id === selectedProductForType.jenis_id);
    if (!j) return;

    // Susun nilai atribut
    const nilaiPayload: any[] = [];
    for (const a of j.atributs || []) {
      const val = typeAttrValues[a.id];
      if (a.wajib) {
        const hasVal = val && (
          (val.nilai_angka !== '' && val.nilai_angka !== undefined) ||
          val.opsi_id ||
          (val.opsi_baru && val.opsi_baru.trim().length > 0) ||
          (val.nilai_teks && val.nilai_teks.trim().length > 0)
        );
        if (!hasVal) {
          showToast(`Atribut wajib "${a.nama}" belum diisi.`, 'warning');
          return;
        }
      }

      if (val) {
        nilaiPayload.push({
          atribut_id: a.id,
          nilai_angka: typeof val.nilai_angka === 'number' ? val.nilai_angka : null,
          opsi_id: val.opsi_id ? Number(val.opsi_id) : null,
          opsi_baru: val.opsi_baru ? val.opsi_baru.trim() : null,
          nilai_teks: val.nilai_teks ? val.nilai_teks.trim() : null
        });
      }
    }

    try {
      await catalogApi.createTipe({
        produk_id: selectedProductForType.id,
        catatan: typeCatatan.trim() || undefined,
        sumber_id: typeSumberId,
        prefix_id: typePrefixId.trim() || undefined,
        pola_id: typePolaId.trim() || undefined,
        nilai_atribut: nilaiPayload
      });

      showToast(`Tipe varian "${computedAutoTypeName}" berhasil dibuat!`, 'success');
      setIsAddTypeOpen(false);
      // Reload tipe produk
      const updatedTypes = await catalogApi.listTipeByProduk(selectedProductForType.id);
      setProducts(prev => prev.map(p => p.id === selectedProductForType.id ? { ...p, tipes: updatedTypes, total_tipe: updatedTypes.length } : p));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Simpan Atribut Baru
  const handleCreateAtribut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJenisForAttr || !newAttrKode.trim() || !newAttrNama.trim()) {
      showToast('Lengkapi kode dan nama atribut.', 'warning');
      return;
    }

    const opsiArray = newAttrTipeIsian === 'pilihan'
      ? newAttrOpsiText.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    try {
      await catalogApi.createAtribut({
        jenis_id: selectedJenisForAttr.id,
        kode: newAttrKode.trim().toLowerCase(),
        nama: newAttrNama.trim(),
        tipe_isian: newAttrTipeIsian,
        satuan: newAttrSatuan.trim() || undefined,
        wajib: newAttrWajib,
        masuk_nama: newAttrMasukNama,
        opsi: opsiArray
      });

      showToast(`Atribut "${newAttrNama.trim()}" berhasil ditambahkan.`, 'success');
      setIsAddAttrOpen(false);
      setNewAttrKode('');
      setNewAttrNama('');
      setNewAttrSatuan('');
      setNewAttrOpsiText('');
      await loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Simpan Jenis Baru
  const handleCreateJenis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJenisNama.trim()) {
      showToast('Nama Jenis wajib diisi.', 'warning');
      return;
    }

    try {
      await catalogApi.createJenis({
        nama: newJenisNama.trim(),
        sumber_id_bawaan: newJenisSumberId,
        prefix_id_bawaan: newJenisPrefix.trim() || undefined
      });

      showToast(`Jenis "${newJenisNama.trim()}" berhasil dibuat.`, 'success');
      setIsAddJenisOpen(false);
      setNewJenisNama('');
      setNewJenisPrefix('');
      await loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Simpan Koreksi Aturan ID
  const handleSaveIdRuleCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTypeForIdRule || !correctAlasan.trim()) {
      showToast('Alasan koreksi aturan ID wajib diisi.', 'warning');
      return;
    }

    try {
      await catalogApi.updateAturanId(selectedTypeForIdRule.id, {
        sumber_id: correctSumberId,
        prefix_id: correctPrefixId.trim() || undefined,
        pola_id: correctPolaId.trim() || undefined,
        alasan: correctAlasan.trim()
      });

      showToast('Aturan ID berhasil diperbarui.', 'success');
      setIsCorrectIdRuleOpen(false);
      // Refresh tipe
      if (selectedTypeForIdRule.produk_id) {
        const updated = await catalogApi.listTipeByProduk(selectedTypeForIdRule.produk_id);
        setProducts(prev => prev.map(p => p.id === selectedTypeForIdRule.produk_id ? { ...p, tipes: updated } : p));
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>FieldOps IT Inventory v2</span>
              <span aria-hidden="true">·</span>
              <span>Katalog Terpadu</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">Kategori → Atribut → Produk → Tipe</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              Katalog Suku Cadang & Aturan ID Varian
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
              Struktur katalog terpadu multi-tier dengan agregasi status stok WhatsApp Alert, penelusuran kategori visual, dan pengelolaan storage box.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {onOpenChecklist && (
              <button
                onClick={onOpenChecklist}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <Briefcase className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                <span>Simulasi Tas Teknisi</span>
              </button>
            )}

            {canManageCatalog && (
              <button
                onClick={() => setIsStockInputOpen(true)}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-2 shadow-xs"
              >
                <Camera className="w-4 h-4" />
                <span>Input Stok Kamera / Massal</span>
              </button>
            )}

            <button
              onClick={() => setActiveSubTab('produk')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
                activeSubTab === 'produk'
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>Produk & Varian</span>
            </button>

            <button
              onClick={() => setActiveSubTab('kategori')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
                activeSubTab === 'kategori'
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Folder className="w-4 h-4 text-emerald-500" />
              <span>Jelajah Kategori</span>
            </button>

            <button
              onClick={() => setActiveSubTab('boxes')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
                activeSubTab === 'boxes'
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <BoxIcon className="w-4 h-4 text-emerald-500" />
              <span>Storage Box ({boxesList.length})</span>
            </button>

            {!isTechnician && (
              <button
                onClick={() => setActiveSubTab('kelola')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
                  activeSubTab === 'kelola'
                    ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>Kelola & Pengaturan</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUBTAB 1: DAFTAR PRODUK & TIPE */}
      {/* ========================================================================= */}
      {activeSubTab === 'produk' && (
        <div className="space-y-4">
          {/* Kartu Ringkasan Status Stok & Klik-Filter */}
          <CatalogSummaryCards
            products={products}
            selectedStatus={statusFilter}
            onSelectStatus={setStatusFilter}
          />

          {/* Toolbar & Filter */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama produk atau kategori..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Filter Kategori */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedJenisId}
                  onChange={e => {
                    setSelectedJenisId(e.target.value);
                    setAttrOptionFilters({});
                    setAttrMinNumberFilters({});
                  }}
                  className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="ALL">Semua Kategori ({jenisList.length})</option>
                  {jenisList.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.nama} ({j.total_produk || 0} produk)
                    </option>
                  ))}
                </select>

                {/* Filter Kategori Perputaran */}
                <select
                  value={selectedKategori}
                  onChange={e => setSelectedKategori(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="ALL">Semua Perputaran</option>
                  <option value="fast_moving">Fast Moving</option>
                  <option value="recycle">Recycle</option>
                </select>

                {/* Filter Kategori Barang (Paket 4: Alat / Barang Habis Pakai) */}
                <select
                  value={selectedKategoriBarang}
                  onChange={e => setSelectedKategoriBarang(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="ALL">Semua Jenis Barang</option>
                  <option value="Alat">Alat (Tools)</option>
                  <option value="Barang Habis Pakai">Barang Habis Pakai</option>
                </select>

                {canManageCatalog && (
                  <button
                    onClick={() => {
                      if (jenisList.length === 0) {
                        showToast('Buat Kategori katalog terlebih dahulu sebelum membuat produk.', 'warning');
                        setActiveSubTab('kelola');
                        setIsAddJenisOpen(true);
                      } else {
                        setNewProdJenisId(jenisList[0].id);
                        setIsAddProductOpen(true);
                      }
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat Produk</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Dinamis Atribut (jika Jenis tertentu dipilih) */}
            {currentJenisAttributes.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs">
                <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" />
                  Filter Spesifikasi:
                </span>

                {currentJenisAttributes.map(attr => {
                  if (attr.tipe_isian === 'pilihan' && attr.opsi && attr.opsi.length > 0) {
                    return (
                      <div key={attr.id} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-600 dark:text-slate-300 font-medium">{attr.nama}:</span>
                        <select
                          value={attrOptionFilters[attr.id] || ''}
                          onChange={e => setAttrOptionFilters(prev => ({ ...prev, [attr.id]: e.target.value }))}
                          className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-hidden"
                        >
                          <option value="">Semua</option>
                          {attr.opsi.map(o => (
                            <option key={o.id} value={o.id}>{o.nilai}</option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  if (attr.tipe_isian === 'angka') {
                    return (
                      <div key={attr.id} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-600 dark:text-slate-300 font-medium">{attr.nama} ≥</span>
                        <input
                          type="number"
                          placeholder={`Min (${attr.satuan || ''})`}
                          value={attrMinNumberFilters[attr.id] || ''}
                          onChange={e => setAttrMinNumberFilters(prev => ({ ...prev, [attr.id]: e.target.value }))}
                          className="w-16 bg-transparent text-slate-800 dark:text-slate-200 focus:outline-hidden"
                        />
                      </div>
                    );
                  }

                  return null;
                })}

                {(Object.keys(attrOptionFilters).length > 0 || Object.keys(attrMinNumberFilters).length > 0) && (
                  <button
                    onClick={() => {
                      setAttrOptionFilters({});
                      setAttrMinNumberFilters({});
                    }}
                    className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium text-[11px]"
                  >
                    Reset Filter Spesifikasi
                  </button>
                )}
              </div>
            )}
          </div>

          {/* List Produk */}
          {loading ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
              <span>Memuat katalog bertingkat...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
              <Tag className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Tidak ada produk ditemukan</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Sesuaikan kata kunci pencarian atau buat produk baru untuk memulai katalog v2.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProducts.map(prod => {
                const isExpanded = !!expandedProductIds[prod.id];
                return (
                  <div
                    key={prod.id}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors"
                  >
                    {/* Header Produk Card */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                          <Tag className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-white text-base">
                              {prod.nama}
                            </span>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              Jenis: {prod.jenis_nama}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                prod.kategori === 'fast_moving'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                              }`}
                            >
                              {prod.kategori === 'fast_moving' ? 'Fast Moving' : 'Recycle'}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                prod.kategori_barang === 'Alat'
                                  ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                  : 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800'
                              }`}
                            >
                              {prod.kategori_barang || 'Barang Habis Pakai'}
                            </span>
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              Stok Tersedia: {prod.total_stok ?? 0} {prod.tipe_stok || 'Unit'}
                            </span>
                            {prod.stok_rusak !== undefined && prod.stok_rusak > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800" title="Item rusak tidak dihitung dalam stok tersedia">
                                Rusak: {prod.stok_rusak}
                              </span>
                            )}
                          </div>
                          {prod.catatan && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {prod.catatan}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center">
                        <button
                          onClick={() => toggleProductExpand(prod.id)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <span>{prod.total_tipe ?? prod.tipes?.length ?? 0} Varian Tipe</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {canManageCatalog && (
                          <button
                            onClick={() => handleOpenAddType(prod)}
                            className="px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors flex items-center gap-1 shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Tambah Tipe</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Varian Tipe Expandable Drawer */}
                    {isExpanded && (
                      <div className="bg-slate-50/70 dark:bg-slate-950/50 p-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Daftar Varian Tipe Produk: {prod.nama}
                          </h4>
                          <span className="text-[11px] text-slate-400">
                            Klik angka stok untuk melihat daftar ID item fisik & sebaran box
                          </span>
                        </div>

                        {!prod.tipes || prod.tipes.length === 0 ? (
                          <div className="text-center py-6 bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-300 dark:border-slate-800 text-xs text-slate-500">
                            <span>Belum ada tipe varian untuk produk ini.</span>
                            {canManageCatalog && (
                              <button
                                onClick={() => handleOpenAddType(prod)}
                                className="block mx-auto mt-2 text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                              >
                                + Tambah Tipe Pertama Sekarang
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {prod.tipes.map(t => (
                              <div
                                key={t.id}
                                className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs space-y-2.5"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                                        {t.nama_tipe}
                                      </span>
                                      <span
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                          t.id_dikunci
                                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                        }`}
                                        title={t.id_dikunci ? 'Aturan ID dikunci karena sudah pernah ada stok fisik masuk' : 'Aturan ID masih terbuka'}
                                      >
                                        {t.id_dikunci ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                        {t.id_dikunci ? 'Terkunci' : 'Terbuka'}
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono block mt-0.5">
                                      Mode: {t.mode_stok === 'per_id' ? 'Item Ber-ID' : 'Stok Jumlah (Bulk)'} · Sumber: {t.sumber_id}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      onClick={() => handleOpenTypeItems(t)}
                                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors flex items-center gap-1 cursor-pointer"
                                      title="Klik untuk melihat daftar ID item fisik dan lokasi box"
                                    >
                                      <BoxIcon className="w-3.5 h-3.5" />
                                      <span>{t.stok_total ?? 0} Unit</span>
                                    </button>

                                    {canManageCatalog && (
                                      <button
                                        onClick={() => {
                                          setSelectedTypeForIdRule(t);
                                          setCorrectSumberId(t.sumber_id);
                                          setCorrectPrefixId(t.prefix_id || '');
                                          setCorrectPolaId(t.pola_id || '');
                                          setCorrectAlasan('');
                                          setIsCorrectIdRuleOpen(true);
                                        }}
                                        className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                                      >
                                        Aturan ID
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Nilai Atribut Chip */}
                                {t.nilai_atribut && t.nilai_atribut.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {t.nilai_atribut.map((na: any, idx: number) => (
                                      <span
                                        key={idx}
                                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                      >
                                        {na.atribut_nama}: <strong className="text-slate-900 dark:text-white">{na.nilai_tampil}</strong>
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Sebaran Box */}
                                {t.sebaran_box && t.sebaran_box.length > 0 && (
                                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] space-y-1">
                                    <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                      <BoxIcon className="w-3 h-3 text-emerald-500" /> Sebaran Box:
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {t.sebaran_box.map((sb, idx) => (
                                        <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px]">
                                          {sb.box_kode}: <strong>{sb.jumlah} unit</strong>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Riwayat Mutasi Terakhir */}
                                {t.riwayat_terakhir && t.riwayat_terakhir.length > 0 && (
                                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] space-y-1">
                                    <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                      <RefreshCw className="w-3 h-3 text-blue-500" /> Riwayat Mutasi Terakhir:
                                    </span>
                                    <div className="space-y-1">
                                      {t.riwayat_terakhir.map((h, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 px-2 py-0.5 rounded">
                                          <span>
                                            <strong className="text-slate-800 dark:text-slate-200">{h.id_aktivitas}</strong> ({h.aksi}) — {h.nama_pelaku || 'Sistem'}
                                          </span>
                                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                                            {h.kode_id ? h.kode_id : `+${h.jumlah || 1} unit`}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Info Prefix & Pola Regex */}
                                {(t.prefix_id || t.pola_id) && (
                                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    {t.prefix_id && <span>Prefix: <strong>{t.prefix_id}</strong></span>}
                                    {t.pola_id && <span>Pola: <code className="text-emerald-600 dark:text-emerald-400">{t.pola_id}</code></span>}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: JELAJAH KATEGORI (Pola Visual Shopee) */}
      {/* ========================================================================= */}
      {activeSubTab === 'kategori' && (
        <CatalogBrowseCategoriesTab
          categories={jenisList}
          products={products}
          onOpenTypeDetail={handleOpenTypeItems}
          onOpenStockOut={(tipe) => {
            setIsStockInputOpen(true);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: DAFTAR STORAGE BOX */}
      {/* ========================================================================= */}
      {activeSubTab === 'boxes' && (
        <CatalogBoxesTab
          boxesList={boxesList}
          loading={loading}
          canManageCatalog={canManageCatalog}
          onOpenCreateBox={() => setIsBoxManagerOpen(true)}
          onSelectBox={(boxId) => setSelectedBoxForContent(boxId)}
        />
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4: KELOLA & PENGATURAN (Khusus Admin/Gudang/Dev, Tersembunyi untuk Teknisi) */}
      {/* ========================================================================= */}
      {activeSubTab === 'kelola' && !isTechnician && (
        <CatalogManageTab
          categories={jenisList}
          canManageCatalog={canManageCatalog}
          onOpenAddCategory={() => setIsAddJenisOpen(true)}
          onOpenAddAttribute={(cat) => {
            setSelectedJenisForAttr(cat);
            setNewAttrKode('');
            setNewAttrNama('');
            setNewAttrSatuan('');
            setNewAttrOpsiText('');
            setIsAddAttrOpen(true);
          }}
          onOpenRestore={onOpenRestore}
          onOpenTrash={() => setIsTrashOpen(true)}
          trashCount={trashItems?.length || 0}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: BUAT PRODUK BARU */}
      {/* ========================================================================= */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Buat Produk Induk Baru
              </h3>
              <button onClick={() => setIsAddProductOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Pilih Jenis Katalog (Golongan Besar) *
                </label>
                <select
                  value={newProdJenisId}
                  onChange={e => setNewProdJenisId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  {jenisList.map(j => (
                    <option key={j.id} value={j.id}>{j.nama}</option>
                  ))}
                </select>
              </div>

              {/* Seamless Atribut Check as mandated by Section 5 item 2: If Jenis has no attributes, show "Tambah Atribut" directly */}
              {(() => {
                const selectedJ = jenisList.find(j => j.id === Number(newProdJenisId));
                if (!selectedJ || !selectedJ.atributs || selectedJ.atributs.length === 0) {
                  return (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Jenis "{selectedJ?.nama}" belum memiliki atribut kolom.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedJenisForAttr(selectedJ || null);
                          setIsAddAttrOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors"
                      >
                        + Tambah Atribut Sekarang
                      </button>
                    </div>
                  );
                }
                return (
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 block mb-1">Atribut yang akan digunakan untuk varian tipe:</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedJ.atributs.map(a => (
                        <span key={a.id} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                          {a.nama} ({a.tipe_isian})
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Produk Induk * (Contoh: Adaptor 12V, Kabel UTP Cat6)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Adaptor 12V Standar"
                  value={newProdNama}
                  onChange={e => setNewProdNama(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kategori Perputaran *
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="kategori"
                      checked={newProdKategori === 'fast_moving'}
                      onChange={() => setNewProdKategori('fast_moving')}
                    />
                    <span className="text-slate-800 dark:text-slate-200">Fast Moving (Pengadaan Baru / Cepat)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="kategori"
                      checked={newProdKategori === 'recycle'}
                      onChange={() => setNewProdKategori('recycle')}
                    />
                    <span className="text-slate-800 dark:text-slate-200">Recycle (Bekas Tarikan / Servis)</span>
                  </label>
                </div>
              </div>

              {/* Paket 4: Kategori Barang & Tipe Stok dengan Suggestions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kategori Barang *
                  </label>
                  <select
                    value={newProdKategoriBarang}
                    onChange={e => setNewProdKategoriBarang(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold"
                  >
                    <option value="Barang Habis Pakai">Barang Habis Pakai</option>
                    <option value="Alat">Alat (Toolkit / Equipment)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tipe Satuan Stok *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: unit, roll, pcs"
                    value={newProdTipeStok}
                    onChange={e => setNewProdTipeStok(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    <span className="text-[10px] text-slate-400">Saran penulisan:</span>
                    {tipeStokSuggestions.map((sug: string) => (
                      <button
                        type="button"
                        key={sug}
                        onClick={() => setNewProdTipeStok(sug)}
                        className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                          newProdTipeStok.toLowerCase() === sug.toLowerCase()
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Stok Awal Fisik (Opsional)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    value={newProdStokAwal}
                    onFocus={(e) => e.target.select()}
                    onChange={e => setNewProdStokAwal(e.target.value.replace(/\D/g, ''))}
                    onBlur={() => { if (!newProdStokAwal) setNewProdStokAwal('0'); }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-sans text-xs">
                    {newProdTipeStok || 'unit'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Bila diisi &gt; 0, sistem otomatis mencatat transaksi mutasi MASUK (SALDO_AWAL) ke Box Gudang Utama.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan / Keterangan Tambahan
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan suku cadang atau peruntukan..."
                  value={newProdCatatan}
                  onChange={e => setNewProdCatatan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-lg shadow-xs"
                >
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BUAT TIPE VARIAN BARU (DENGAN NAMA OTOMATIS) */}
      {/* ========================================================================= */}
      {isAddTypeOpen && selectedProductForType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Tambah Varian Tipe
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Produk: <strong>{selectedProductForType.nama}</strong> ({selectedProductForType.jenis_nama})
                </span>
              </div>
              <button onClick={() => setIsAddTypeOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateType} className="space-y-4 text-xs">
              {/* Preview Nama Tipe Otomatis */}
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-lg">
                <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Nama Varian Tipe Otomatis:
                </span>
                <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {computedAutoTypeName}
                </div>
              </div>

              {/* Form Input Dinamis Berdasarkan Atribut Jenis */}
              {(() => {
                const j = jenisList.find(item => item.id === selectedProductForType.jenis_id);
                if (!j || !j.atributs || j.atributs.length === 0) {
                  return (
                    <div className="p-4 text-center text-slate-500">
                      Jenis belum memiliki atribut. Harap tambahkan atribut terlebih dahulu.
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block">
                      Isi Spesifikasi Atribut ({j.atributs.length}):
                    </span>

                    {j.atributs.map(a => {
                      const curVal = typeAttrValues[a.id] || {};

                      return (
                        <div key={a.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="font-semibold text-slate-800 dark:text-slate-200">
                              {a.nama} {a.wajib && <span className="text-red-500">*</span>}
                            </label>
                            <span className="text-[10px] text-slate-400">
                              {a.masuk_nama ? 'Digabung ke nama tipe' : 'Hanya spesifikasi internal'}
                            </span>
                          </div>

                          {/* Isian Angka */}
                          {a.tipe_isian === 'angka' && (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="any"
                                placeholder={`Isi angka...`}
                                value={curVal.nilai_angka ?? ''}
                                onChange={e => {
                                  const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                  setTypeAttrValues(prev => ({
                                    ...prev,
                                    [a.id]: { ...prev[a.id], nilai_angka: val }
                                  }));
                                }}
                                className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                              />
                              {a.satuan && (
                                <span className="px-3 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-300 font-mono">
                                  {a.satuan}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Isian Pilihan (dengan opsi tambah dinamis) */}
                          {a.tipe_isian === 'pilihan' && (
                            <div className="space-y-2">
                              <select
                                value={curVal.opsi_id || ''}
                                onChange={e => {
                                  const oId = e.target.value ? Number(e.target.value) : '';
                                  setTypeAttrValues(prev => ({
                                    ...prev,
                                    [a.id]: { ...prev[a.id], opsi_id: oId, opsi_baru: '' }
                                  }));
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                              >
                                <option value="">-- Pilih Opsi yang Tersedia --</option>
                                {a.opsi?.map(o => (
                                  <option key={o.id} value={o.id}>{o.nilai}</option>
                                ))}
                              </select>

                              {/* Opsi Baru Cepat */}
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">Atau ketik opsi baru:</span>
                                <input
                                  type="text"
                                  placeholder="Contoh: 5A / 5G / Jack Baru"
                                  value={curVal.opsi_baru || ''}
                                  onChange={e => {
                                    const text = e.target.value;
                                    setTypeAttrValues(prev => ({
                                      ...prev,
                                      [a.id]: { ...prev[a.id], opsi_baru: text, opsi_id: '' }
                                    }));
                                  }}
                                  className="flex-1 px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                                />
                              </div>
                            </div>
                          )}

                          {/* Isian Teks */}
                          {a.tipe_isian === 'teks' && (
                            <input
                              type="text"
                              placeholder="Ketik teks..."
                              value={curVal.nilai_teks || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setTypeAttrValues(prev => ({
                                  ...prev,
                                  [a.id]: { ...prev[a.id], nilai_teks: val }
                                }));
                              }}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Pengaturan Aturan ID */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  Aturan Identitas Fisik Item (ID Rule):
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['scan_sn', 'otomatis', 'manual', 'tanpa_id'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setTypeSumberId(mode)}
                      className={`p-2 rounded-lg border text-left flex flex-col justify-between ${
                        typeSumberId === mode
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="uppercase text-[10px] tracking-wider font-mono">{mode}</span>
                      <span className="text-[9px] text-slate-400 mt-1">
                        {mode === 'scan_sn' && 'Barcode / SN Pabrik'}
                        {mode === 'otomatis' && 'Auto-generate QR'}
                        {mode === 'manual' && 'Ketik Bebas'}
                        {mode === 'tanpa_id' && 'Mode Jumlah'}
                      </span>
                    </button>
                  ))}
                </div>

                {typeSumberId === 'otomatis' && (
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Prefix ID Otomatis (Contoh: ADP12, CAB)
                    </label>
                    <input
                      type="text"
                      placeholder="Misal: ADP12-"
                      value={typePrefixId}
                      onChange={e => setTypePrefixId(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                    />
                  </div>
                )}

                {typeSumberId !== 'tanpa_id' && (
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Pola Regex Validasi ID (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Misal: ^SN[0-9]{8}$ atau ^ADP[A-Z0-9]+$"
                      value={typePolaId}
                      onChange={e => setTypePolaId(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddTypeOpen(false)}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-lg shadow-xs"
                >
                  Simpan Tipe Varian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH ATRIBUT UNTUK JENIS */}
      {/* ========================================================================= */}
      {isAddAttrOpen && selectedJenisForAttr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Tambah Atribut Spesifikasi
                </h3>
                <span className="text-xs text-slate-500">
                  Untuk Jenis: <strong>{selectedJenisForAttr.nama}</strong>
                </span>
              </div>
              <button onClick={() => setIsAddAttrOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAtribut} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Label Atribut * (Contoh: Tegangan, Arus, Jenis Jack, Jaringan)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Tegangan"
                  value={newAttrNama}
                  onChange={e => {
                    setNewAttrNama(e.target.value);
                    if (!newAttrKode) {
                      setNewAttrKode(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kode Teknis (Database Key) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="tegangan"
                  value={newAttrKode}
                  onChange={e => setNewAttrKode(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tipe Isian Data *
                </label>
                <select
                  value={newAttrTipeIsian}
                  onChange={e => setNewAttrTipeIsian(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  <option value="angka">Angka (dengan satuan: V, A, m, dll)</option>
                  <option value="pilihan">Pilihan Dropdown (opsi yang seragam)</option>
                  <option value="teks">Teks Bebas</option>
                </select>
              </div>

              {newAttrTipeIsian === 'angka' && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Satuan Pengukuran (Contoh: V, A, m, dBm)
                  </label>
                  <input
                    type="text"
                    placeholder="V"
                    value={newAttrSatuan}
                    onChange={e => setNewAttrSatuan(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              )}

              {newAttrTipeIsian === 'pilihan' && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Daftar Opsi Awal (Pisahkan dengan koma)
                  </label>
                  <input
                    type="text"
                    placeholder="Misal: 1A, 2A, 3A, 5A"
                    value={newAttrOpsiText}
                    onChange={e => setNewAttrOpsiText(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              )}

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAttrWajib}
                    onChange={e => setNewAttrWajib(e.target.checked)}
                  />
                  <span className="text-slate-800 dark:text-slate-200 font-medium">Atribut Wajib Diisi</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAttrMasukNama}
                    onChange={e => setNewAttrMasukNama(e.target.checked)}
                  />
                  <span className="text-slate-800 dark:text-slate-200 font-medium">Masuk ke Nama Tipe</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddAttrOpen(false)}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg shadow-xs"
                >
                  Simpan Atribut
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BUAT JENIS BARU */}
      {/* ========================================================================= */}
      {isAddJenisOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Tambah Jenis Baru (Golongan Besar)
              </h3>
              <button onClick={() => setIsAddJenisOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateJenis} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Jenis * (Contoh: Adaptor, Modem/ONU, Router, SFP, Kabel)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Adaptor"
                  value={newJenisNama}
                  onChange={e => setNewJenisNama(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sumber ID Bawaan untuk Jenis Ini
                </label>
                <select
                  value={newJenisSumberId}
                  onChange={e => setNewJenisSumberId(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  <option value="scan_sn">scan_sn (Barcode / Serial Number Pabrik)</option>
                  <option value="otomatis">otomatis (Generate Nomor Seri Sistem & QR)</option>
                  <option value="manual">manual (Ketik Manual Pengguna)</option>
                  <option value="tanpa_id">tanpa_id (Mode Stok Jumlah / Non-SN)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Prefix Bawaan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Misal: ADP"
                  value={newJenisPrefix}
                  onChange={e => setNewJenisPrefix(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddJenisOpen(false)}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg shadow-xs"
                >
                  Simpan Jenis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: KOREKSI ATURAN ID TIPE */}
      {/* ========================================================================= */}
      {isCorrectIdRuleOpen && selectedTypeForIdRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Koreksi Aturan ID Tipe
                </h3>
                <span className="text-xs text-slate-500">
                  Tipe: <strong>{selectedTypeForIdRule.nama_tipe}</strong>
                </span>
              </div>
              <button onClick={() => setIsCorrectIdRuleOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveIdRuleCorrection} className="space-y-3.5 text-xs">
              {selectedTypeForIdRule.id_dikunci && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Aturan ID tipe ini sudah <strong>dikunci</strong> karena stok fisik pernah tercatat. Perubahan memerlukan verifikasi server dan alasan wajib.
                  </span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sumber ID Baru
                </label>
                <select
                  value={correctSumberId}
                  onChange={e => setCorrectSumberId(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  <option value="scan_sn">scan_sn (Barcode / SN Pabrik)</option>
                  <option value="otomatis">otomatis (Generate Nomor Seri Sistem & QR)</option>
                  <option value="manual">manual (Ketik Manual Pengguna)</option>
                  <option value="tanpa_id">tanpa_id (Mode Stok Jumlah)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Prefix Baru (Jika otomatis)
                </label>
                <input
                  type="text"
                  placeholder="Misal: ADP12-"
                  value={correctPrefixId}
                  onChange={e => setCorrectPrefixId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Pola Regex Validasi Baru
                </label>
                <input
                  type="text"
                  placeholder="Misal: ^SN[0-9]{8}$"
                  value={correctPolaId}
                  onChange={e => setCorrectPolaId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Alasan Koreksi Aturan ID * (Tercatat di Audit Log)
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Jelaskan alasan perubahan standardisasi barcode / serial number..."
                  value={correctAlasan}
                  onChange={e => setCorrectAlasan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCorrectIdRuleOpen(false)}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg shadow-xs"
                >
                  Simpan Koreksi Aturan ID
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock & Box Modals */}
      <StockInputModal
        isOpen={isStockInputOpen}
        onClose={() => setIsStockInputOpen(false)}
        onSuccess={() => loadData()}
      />

      <BoxManagerModal
        isOpen={isBoxManagerOpen}
        onClose={() => setIsBoxManagerOpen(false)}
        onSelectBox={b => setSelectedBoxForContent(b.id)}
      />

      <BoxContentModal
        isOpen={!!selectedBoxForContent}
        boxIdOrKode={selectedBoxForContent}
        onClose={() => setSelectedBoxForContent(null)}
        onRefreshParent={() => loadData()}
      />

      {/* Modal Detail Item Fisik per Tipe (Klik Angka Stok) */}
      {selectedTypeForItems && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <BoxIcon className="w-5 h-5 text-emerald-500" />
                  <span>Daftar Item Fisik & Stok Tipe</span>
                </h3>
                <span className="text-xs text-slate-500">
                  Tipe: <strong>{selectedTypeForItems.nama_tipe}</strong> ({selectedTypeForItems.produk_nama})
                </span>
              </div>
              <button onClick={() => setSelectedTypeForItems(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingTypeItems ? (
              <div className="py-12 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                <span>Memuat item fisik...</span>
              </div>
            ) : (
              <div className="overflow-y-auto space-y-4 pr-1 flex-1 text-xs">
                {/* Mode Stok Jumlah (Bulk non-SN) */}
                {typeItemsData.stokJumlah && typeItemsData.stokJumlah.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300">Stok Jumlah per Box:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {typeItemsData.stokJumlah.map((sj: any, idx: number) => (
                        <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">{sj.box_kode}</span>
                            {sj.box_keterangan && <span className="text-[11px] text-slate-500 block">{sj.box_keterangan}</span>}
                          </div>
                          <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold rounded-md">
                            {sj.jumlah} unit
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Item Fisik Ber-ID */}
                {typeItemsData.items && typeItemsData.items.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h4 className="font-bold text-slate-700 dark:text-slate-300">
                        Rincian Item Fisik Ber-ID ({typeItemsData.items.length} Unit Aktif):
                      </h4>
                      {/* Filter Kondisi */}
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-slate-500">Filter Kondisi:</span>
                        <select
                          value={itemConditionFilter}
                          onChange={e => setItemConditionFilter(e.target.value)}
                          className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 text-xs font-medium"
                        >
                          <option value="ALL">Semua Kondisi</option>
                          <option value="Baru">Baru</option>
                          <option value="Baik">Baik</option>
                          <option value="Perlu Perbaikan">Perlu Perbaikan</option>
                          <option value="Rusak">Rusak</option>
                        </select>
                      </div>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700 text-[11px]">
                          <tr>
                            <th className="p-2.5">KODE ID (SN / MANUAL)</th>
                            <th className="p-2.5">LOKASI BOX</th>
                            <th className="p-2.5">KONDISI</th>
                            <th className="p-2.5">STATUS</th>
                            <th className="p-2.5">AKSI</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                          {typeItemsData.items
                            .filter(it => itemConditionFilter === 'ALL' || (it.kondisi || 'Baik') === itemConditionFilter)
                            .map((it: any) => {
                              const kondisi = it.kondisi || 'Baik';
                              const badgeClass =
                                kondisi === 'Baru'
                                  ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800'
                                  : kondisi === 'Perlu Perbaikan'
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                  : kondisi === 'Rusak'
                                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';

                              return (
                                <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                  <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">
                                    {it.kode_id}
                                    {it.catatan_kondisi && (
                                      <span className="block font-sans text-[10px] text-slate-500 font-normal">
                                        {it.catatan_kondisi}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2.5">
                                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                      {it.box_kode}
                                    </span>
                                  </td>
                                  <td className="p-2.5">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold border ${badgeClass}`}>
                                      {kondisi}
                                    </span>
                                  </td>
                                  <td className="p-2.5">
                                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                                      {it.status}
                                    </span>
                                  </td>
                                  <td className="p-2.5">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const promptKondisi = window.prompt(
                                          `Ubah kondisi untuk item "${it.kode_id}"\nPilihan: Baru, Baik, Perlu Perbaikan, Rusak`,
                                          kondisi
                                        );
                                        if (promptKondisi && ['Baru', 'Baik', 'Perlu Perbaikan', 'Rusak'].includes(promptKondisi)) {
                                          const catatan = window.prompt('Catatan kondisi (opsional):', it.catatan_kondisi || '') || undefined;
                                          try {
                                            await catalogApi.updateItemCondition(it.id, promptKondisi as any, catatan);
                                            showToast(`Kondisi item "${it.kode_id}" berhasil diubah ke ${promptKondisi}.`, 'success');
                                            if (selectedTypeForItems) {
                                              const updated = await catalogApi.getItemsByTipe(selectedTypeForItems.id);
                                              setTypeItemsData(updated);
                                            }
                                            await loadData();
                                          } catch (err: any) {
                                            showToast(err.message, 'error');
                                          }
                                        }
                                      }}
                                      className="font-sans text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                                    >
                                      Ubah Kondisi
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  (!typeItemsData.stokJumlah || typeItemsData.stokJumlah.length === 0) && (
                    <div className="py-8 text-center text-slate-500">
                      <span>Belum ada barang fisik ber-ID yang aktif untuk tipe ini.</span>
                    </div>
                  )
                )}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedTypeForItems(null)}
                className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Kotak Sampah (Soft Delete) */}
      <TrashModal
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
      />
    </div>
  );
};
