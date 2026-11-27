/**
 * Catalog V2 Manager (Jenis, Atribut, Produk, dan Tipe)
 * FieldOps Inventory v2 - Tahap 2: Katalog Bertingkat
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Tag,
  Search,
  Sliders,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  X,
  RefreshCw,
  Box as BoxIcon,
  Camera,
  ArrowRightLeft,
  Folder,
  Briefcase,
  Trash2,
  Pencil,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';
import { catalogApi, Jenis, Produk, Tipe } from '../../services/catalogApi';
import { stockApi } from '../../services/stockApi';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../context/InventoryContext';
import { isFeatureEnabled } from '../../utils/permissions';
import { StockInputModal } from '../stock/StockInputModal';
import { BoxManagerModal } from '../stock/BoxManagerModal';
import { BoxContentModal } from '../stock/BoxContentModal';
import { CatalogSummaryCards } from './CatalogSummaryCards';
import { CatalogBrowseCategoriesTab } from './CatalogBrowseCategoriesTab';
import { CatalogBoxesTab } from './CatalogBoxesTab';
import { CatalogManageTab } from './CatalogManageTab';
import { CatalogImportModal } from './CatalogImportModal';
import { TrashModal } from '../TrashModal';
import { SNPatternSettingsModal } from '../SNPatternSettingsModal';
import { ConfirmDeleteModal, DeleteConfirmTarget } from '../common/ConfirmDeleteModal';

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
  const { showToast, trashItems, refreshData } = useInventory();

  // Feature-based permission checks (Mendukung slider fitur per-akun)
  const canManageCatalog = isFeatureEnabled(user, 'catalog_manage');
  const canImportCatalog = isFeatureEnabled(user, 'catalog_import');
  const canManageStock = isFeatureEnabled(user, 'stock_in_out');

  // Sub-tab bawaan: kelola -> 'produk', baca-saja -> 'kategori'
  const [activeSubTab, setActiveSubTab] = useState<'produk' | 'kategori' | 'boxes' | 'kelola'>(
    canManageCatalog ? 'produk' : 'kategori'
  );
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'aman' | 'menipis' | 'habis'>('ALL');
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

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

  // Multi-select state untuk pusat Kelola & Pengaturan
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [selectedTypeIds, setSelectedTypeIds] = useState<number[]>([]);
  const [selectedBoxIds, setSelectedBoxIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedTypeItemIds, setSelectedTypeItemIds] = useState<string[]>([]);
  const [selectedTypeSjBoxIds, setSelectedTypeSjBoxIds] = useState<string[]>([]);

  // Modals
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddTypeOpen, setIsAddTypeOpen] = useState(false);
  const [selectedProductForType, setSelectedProductForType] = useState<Produk | null>(null);

  const [isAddJenisOpen, setIsAddJenisOpen] = useState(false);
  const [isSNPatternsOpen, setIsSNPatternsOpen] = useState(false);
  const [focusManageCategoryId, setFocusManageCategoryId] = useState<number | null>(null);

  const [isCorrectIdRuleOpen, setIsCorrectIdRuleOpen] = useState(false);
  const [selectedTypeForIdRule, setSelectedTypeForIdRule] = useState<Tipe | null>(null);

  // Move single Product / Tipe & Category Delete Choice Modals
  const [movingProductTarget, setMovingProductTarget] = useState<Produk | null>(null);
  const [moveProdTargetJenisId, setMoveProdTargetJenisId] = useState<string>('');
  const [movingProdSubmitting, setMovingProdSubmitting] = useState(false);

  const [movingTipeTarget, setMovingTipeTarget] = useState<{ tipe: Tipe; sourceProd: Produk } | null>(null);
  const [moveTipeTargetProdId, setMoveTipeTargetProdId] = useState<string>('');
  const [movingTipeSubmitting, setMovingTipeSubmitting] = useState(false);

  const [categoryDeleteChoice, setCategoryDeleteChoice] = useState<{
    category: Jenis;
    activeProducts: Produk[];
  } | null>(null);
  const [catDeleteMode, setCatDeleteMode] = useState<'move_products' | 'cascade'>('move_products');
  const [catDeleteMoveTargetId, setCatDeleteMoveTargetId] = useState<string>('');

  // Tahap 3 & 4 Stock Modals
  const [isStockInputOpen, setIsStockInputOpen] = useState(false);
  const [isBoxManagerOpen, setIsBoxManagerOpen] = useState(false);
  const [selectedBoxForContent, setSelectedBoxForContent] = useState<string | null>(null);

  // Tahap 4: Modal Detail Item Fisik & Stok Tipe
  const [selectedTypeForItems, setSelectedTypeForItems] = useState<Tipe | null>(null);
  const [typeItemsData, setTypeItemsData] = useState<{ items: any[]; stokJumlah: any[] }>({ items: [], stokJumlah: [] });
  const [loadingTypeItems, setLoadingTypeItems] = useState<boolean>(false);
  const [itemConditionFilter, setItemConditionFilter] = useState<string>('ALL');
  const [editingTypeItem, setEditingTypeItem] = useState<any | null>(null);
  const [editTypeItemKondisi, setEditTypeItemKondisi] = useState<'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak'>('Baik');
  const [editTypeItemCatatan, setEditTypeItemCatatan] = useState<string>('');

  // Move / Delete inside Modal Detail Item Fisik & Stok Tipe
  const [typeItemsMoveTarget, setTypeItemsMoveTarget] = useState<{
    mode: 'per_id' | 'jumlah';
    itemIds?: string[];
    label: string;
    boxAsalId: string;
    maxQty?: number;
  } | null>(null);
  const [typeMoveBoxId, setTypeMoveBoxId] = useState<string>('');
  const [typeMoveTipeId, setTypeMoveTipeId] = useState<string>('SAME');
  const [typeMoveQty, setTypeMoveQty] = useState<string>('1');
  const [typeMoveNote, setTypeMoveNote] = useState<string>('');
  const [typeMoveSubmitting, setTypeMoveSubmitting] = useState(false);

  const [typeItemsDeleteSjTarget, setTypeItemsDeleteSjTarget] = useState<{
    tipeId: number;
    boxId: string;
    boxKode: string;
    totalQty: number;
    reservedQty: number;
    freeQty: number;
  } | null>(null);
  const [typeDeleteSjQty, setTypeDeleteSjQty] = useState<string>('1');

  const handleOpenTypeItems = async (tipe: Tipe) => {
    setSelectedTypeForItems(tipe);
    setItemConditionFilter('ALL');
    setSelectedTypeItemIds([]);
    setSelectedTypeSjBoxIds([]);
    setEditingTypeItem(null);
    setTypeItemsMoveTarget(null);
    setTypeItemsDeleteSjTarget(null);
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

  // Form Buat Produk
  const [newProdJenisId, setNewProdJenisId] = useState<number | ''>('');
  const [newProdNama, setNewProdNama] = useState('');
  const [newProdKategori, setNewProdKategori] = useState<'fast_moving' | 'recycle'>('fast_moving');
  const [newProdKategoriBarang, setNewProdKategoriBarang] = useState<'Alat' | 'Barang Habis Pakai'>('Barang Habis Pakai');
  const [newProdTipeStok, setNewProdTipeStok] = useState<string>('unit');
  const [newProdCatatan, setNewProdCatatan] = useState('');
  const [newProdStokAwal, setNewProdStokAwal] = useState<string>('0');
  const [tipeStokSuggestions, setTipeStokSuggestions] = useState<string[]>(['unit', 'roll', 'meter', 'pcs', 'box', 'set']);

  // Form Buat Tipe (Nama tipe bebas / manual)
  const [typeNamaTipe, setTypeNamaTipe] = useState('');
  const [typeSumberId, setTypeSumberId] = useState<'scan_sn' | 'otomatis' | 'manual' | 'tanpa_id'>('manual');
  const [typePrefixId, setTypePrefixId] = useState('');
  const [typePolaId, setTypePolaId] = useState('');
  const [typePolaIdError, setTypePolaIdError] = useState<string | null>(null);
  const [typeTestSn, setTypeTestSn] = useState('');
  const [typeCatatan, setTypeCatatan] = useState('');

  // Form Koreksi Tipe & Aturan ID
  const [correctNamaTipe, setCorrectNamaTipe] = useState('');
  const [correctSumberId, setCorrectSumberId] = useState<'scan_sn' | 'otomatis' | 'manual' | 'tanpa_id'>('manual');
  const [correctPrefixId, setCorrectPrefixId] = useState('');
  const [correctPolaId, setCorrectPolaId] = useState('');
  const [correctPolaIdError, setCorrectPolaIdError] = useState<string | null>(null);
  const [correctTestSn, setCorrectTestSn] = useState('');
  const [correctAlasan, setCorrectAlasan] = useState('');
  const [correctConfirmTyped, setCorrectConfirmTyped] = useState('');
  const [correctReauthPassword, setCorrectReauthPassword] = useState('');
  const [correctNeedsReauth, setCorrectNeedsReauth] = useState(false);

  // Form Buat Jenis
  const [newJenisNama, setNewJenisNama] = useState('');
  const [newJenisSumberId, setNewJenisSumberId] = useState<'scan_sn' | 'otomatis' | 'manual' | 'tanpa_id'>('manual');
  const [newJenisPrefix, setNewJenisPrefix] = useState('');

  // State Hapus Tier 3
  const [deleteTarget, setDeleteTarget] = useState<DeleteConfirmTarget | null>(null);

  // Form Edit Kategori (Jenis)
  const [editingJenis, setEditingJenis] = useState<Jenis | null>(null);
  const [editJenisNama, setEditJenisNama] = useState('');
  const [editJenisSumberId, setEditJenisSumberId] = useState<'scan_sn' | 'otomatis' | 'manual' | 'tanpa_id'>('manual');
  const [editJenisPrefix, setEditJenisPrefix] = useState('');
  const [savingJenis, setSavingJenis] = useState(false);

  // Memuat data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [jList, pList, bList, suggestions] = await Promise.all([
        catalogApi.listJenis(),
        catalogApi.listProduk(),
        stockApi.listBoxes().catch(() => []),
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

  // Filter daftar produk
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return products.filter(p => {
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
        const matchTipe = (p.tipes || []).some(t => t.nama_tipe.toLowerCase().includes(q));
        if (!matchName && !matchJenis && !matchTipe) return false;
      }

      return true;
    });
  }, [products, statusFilter, selectedJenisId, selectedKategori, selectedKategoriBarang, searchQuery]);

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

    setTypeNamaTipe('');
    setTypeSumberId(j?.sumber_id_bawaan || 'manual');
    setTypePrefixId(j?.prefix_id_bawaan || '');
    setTypePolaId('');
    setTypePolaIdError(null);
    setTypeTestSn('');
    setTypeCatatan('');
    setIsAddTypeOpen(true);
  };

  // Buka modal edit tipe & aturan ID
  const openEditTypeAndIdRule = (t: Tipe) => {
    setSelectedTypeForIdRule(t);
    setCorrectNamaTipe(t.nama_tipe || '');
    setCorrectSumberId(t.sumber_id);
    setCorrectPrefixId(t.prefix_id || '');
    setCorrectPolaId(t.pola_id || '');
    setCorrectPolaIdError(null);
    setCorrectTestSn('');
    setCorrectAlasan('');
    setCorrectConfirmTyped('');
    setCorrectReauthPassword('');
    setCorrectNeedsReauth(false);
    setIsCorrectIdRuleOpen(true);
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
      await Promise.all([loadData(), refreshData()]);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Simpan Tipe Baru (Nama manual bebas tanpa ketergantungan atribut)
  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForType) return;

    const trimmedNama = typeNamaTipe.trim();
    if (!trimmedNama) {
      showToast('Nama varian tipe wajib diisi.', 'warning');
      return;
    }

    const trimmedPolaId = typePolaId.trim();
    if (typeSumberId === 'scan_sn' && trimmedPolaId) {
      try {
        new RegExp(trimmedPolaId);
      } catch {
        setTypePolaIdError('Pola regex tidak valid. Periksa sintaks regex Anda.');
        return;
      }
    }
    setTypePolaIdError(null);

    try {
      await catalogApi.createTipe({
        produk_id: selectedProductForType.id,
        nama_tipe: trimmedNama,
        catatan: typeCatatan.trim() || undefined,
        sumber_id: typeSumberId,
        prefix_id: typePrefixId.trim() || undefined,
        pola_id: trimmedPolaId || undefined
      });

      showToast(`Tipe varian "${trimmedNama}" berhasil dibuat!`, 'success');
      setIsAddTypeOpen(false);
      const updatedTypes = await catalogApi.listTipeByProduk(selectedProductForType.id);
      setProducts(prev => prev.map(p => p.id === selectedProductForType.id ? { ...p, tipes: updatedTypes, total_tipe: updatedTypes.length } : p));
      await refreshData();
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

      showToast(`Kategori "${newJenisNama.trim()}" berhasil dibuat.`, 'success');
      setIsAddJenisOpen(false);
      setNewJenisNama('');
      setNewJenisPrefix('');
      await Promise.all([loadData(), refreshData()]);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Simpan Perubahan Nama Tipe & Koreksi Aturan ID
  const handleSaveIdRuleCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTypeForIdRule) return;
    if (!correctNamaTipe.trim()) {
      showToast('Nama varian tipe tidak boleh kosong.', 'warning');
      return;
    }
    if (!correctAlasan.trim()) {
      showToast('Alasan perubahan wajib diisi.', 'warning');
      return;
    }

    const trimmedPolaId = correctPolaId.trim();
    if (correctSumberId === 'scan_sn' && trimmedPolaId) {
      try {
        new RegExp(trimmedPolaId);
      } catch {
        setCorrectPolaIdError('Pola regex tidak valid. Periksa sintaks regex Anda.');
        return;
      }
    }
    setCorrectPolaIdError(null);

    try {
      let confirmationToken: string | undefined;
      if (Boolean(selectedTypeForIdRule.id_dikunci)) {
        const expectedName = selectedTypeForIdRule.nama_tipe || '';
        if (correctConfirmTyped.trim() !== expectedName.trim()) {
          showToast(`Ketik nama tipe "${expectedName}" secara persis untuk mengonfirmasi perubahan aturan ID terkunci.`, 'warning');
          return;
        }
        const tokenRes = await api.requestConfirmationToken({
          actionType: 'change_id_rule',
          targetId: String(selectedTypeForIdRule.id),
          targetName: expectedName,
          objectNameTyped: correctConfirmTyped.trim(),
          reauthPassword: correctReauthPassword || undefined
        });
        if (!tokenRes.success) {
          if (tokenRes.requiresReauth) setCorrectNeedsReauth(true);
          showToast(tokenRes.message || 'Konfirmasi perubahan aturan ID gagal.', 'error');
          return;
        }
        confirmationToken = tokenRes.token;
      }

      await catalogApi.updateAturanId(selectedTypeForIdRule.id, {
        nama_tipe: correctNamaTipe.trim(),
        sumber_id: correctSumberId,
        prefix_id: correctSumberId === 'otomatis' ? (correctPrefixId.trim() || undefined) : undefined,
        pola_id: trimmedPolaId || undefined,
        alasan: correctAlasan.trim(),
        confirmation_token: confirmationToken
      });

      showToast('Varian tipe & aturan ID berhasil diperbarui.', 'success');
      setIsCorrectIdRuleOpen(false);
      await Promise.all([loadData(), refreshData()]);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Edit Kategori
  const openEditCategory = (cat: Jenis) => {
    setEditingJenis(cat);
    setEditJenisNama(cat.nama);
    setEditJenisSumberId(cat.sumber_id_bawaan || 'manual');
    setEditJenisPrefix(cat.prefix_id_bawaan || '');
  };

  const handleUpdateJenis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJenis || !editJenisNama.trim()) {
      showToast('Nama kategori wajib diisi.', 'warning');
      return;
    }
    setSavingJenis(true);
    try {
      await catalogApi.updateJenis(editingJenis.id, {
        nama: editJenisNama.trim(),
        sumber_id_bawaan: editJenisSumberId,
        prefix_id_bawaan: editJenisPrefix.trim() || undefined
      });
      showToast(`Kategori "${editJenisNama.trim()}" berhasil diperbarui.`, 'success');
      setEditingJenis(null);
      await Promise.all([loadData(), refreshData()]);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal memperbarui kategori.', 'error');
    } finally {
      setSavingJenis(false);
    }
  };

  // Pindah Produk Tunggal / Massal antar Kategori
  const openMoveSingleProduct = (prod: Produk) => {
    setMovingProductTarget(prod);
    const otherCat = jenisList.find((j) => j.id !== prod.jenis_id);
    setMoveProdTargetJenisId(otherCat ? String(otherCat.id) : '');
  };

  const handleExecuteMoveSingleProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movingProductTarget || !moveProdTargetJenisId) return;
    setMovingProdSubmitting(true);
    try {
      const res = await catalogApi.moveProduk([movingProductTarget.id], Number(moveProdTargetJenisId));
      showToast(res.message, 'success');
      setMovingProductTarget(null);
      await Promise.all([loadData(), refreshData()]);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal memindahkan produk.', 'error');
    } finally {
      setMovingProdSubmitting(false);
    }
  };

  const handleMoveProductsBulk = async (produkIds: number[], targetJenisId: number) => {
    try {
      const res = await catalogApi.moveProduk(produkIds, targetJenisId);
      showToast(res.message, 'success');
      setSelectedProductIds((prev) => prev.filter((id) => !produkIds.includes(id)));
      await Promise.all([loadData(), refreshData()]);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal memindahkan produk ke kategori tujuan.', 'error');
    }
  };

  // Pindah Tipe ke Produk Lain
  const openMoveSingleType = (tipe: Tipe, sourceProd: Produk) => {
    setMovingTipeTarget({ tipe, sourceProd });
    const otherProd = products.find((p) => p.id !== sourceProd.id);
    setMoveTipeTargetProdId(otherProd ? String(otherProd.id) : '');
  };

  const handleExecuteMoveSingleType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movingTipeTarget || !moveTipeTargetProdId) return;
    setMovingTipeSubmitting(true);
    try {
      const res = await catalogApi.moveTipe(movingTipeTarget.tipe.id, Number(moveTipeTargetProdId));
      showToast(res.message, 'success');
      setMovingTipeTarget(null);
      await Promise.all([loadData(), refreshData()]);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal memindahkan varian tipe.', 'error');
    } finally {
      setMovingTipeSubmitting(false);
    }
  };

  // Permintaan Hapus Produk, Box, Kategori, Atribut, Item Fisik (Tunggal & Massal)
  const handleRequestDeleteProduct = (prod: Produk) => {
    const activeStock = Number(prod.total_stok || 0);
    const reservedStock = Number(prod.total_dipesan || 0);
    const damagedStock = Number(prod.stok_rusak || 0);
    const hasStock = activeStock > 0 || reservedStock > 0 || damagedStock > 0;
    setDeleteTarget({
      actionType: 'delete_product',
      targetId: String(prod.id),
      targetName: prod.nama,
      entityLabel: 'Produk',
      blockerMessage: hasStock
        ? `Produk "${prod.nama}" masih memiliki stok tersimpan (Tersedia: ${activeStock}, Dipesan: ${reservedStock}, Rusak: ${damagedStock}).`
        : null,
      onConfirm: async (token) => {
        const res = await catalogApi.deleteProduk(prod.id, token);
        showToast(res.message, 'success');
        setSelectedProductIds((prev) => prev.filter((id) => id !== prod.id));
        await Promise.all([loadData(), refreshData()]);
      }
    });
  };

  const handleRequestDeleteProductsBulk = (chosenProducts: Produk[]) => {
    if (chosenProducts.length === 0) return;
    const blocked = chosenProducts.filter(
      (p) => Number(p.total_stok || 0) > 0 || Number(p.total_dipesan || 0) > 0 || Number(p.stok_rusak || 0) > 0
    );
    const sortedIds = chosenProducts.map((p) => String(p.id)).sort();
    setDeleteTarget({
      actionType: 'delete_product',
      targetId: `bulk:${sortedIds.join(',')}`,
      targetName: `${chosenProducts.length} Produk`,
      entityLabel: 'Produk',
      itemCount: chosenProducts.length,
      itemLabels: chosenProducts.map((p) => p.nama),
      blockerMessage: blocked.length > 0
        ? `Produk berikut masih memiliki stok aktif/dipesan/rusak: ${blocked.map((b) => b.nama).join(', ')}.`
        : null,
      onConfirm: async (token) => {
        const res = await catalogApi.deleteProdukBulk(chosenProducts.map((p) => p.id), token);
        showToast(res.message, 'success');
        setSelectedProductIds([]);
        await Promise.all([loadData(), refreshData()]);
      }
    });
  };

  const handleRequestDeleteBox = (box: any) => {
    const totalItem = Number(box.total_item || 0);
    setDeleteTarget({
      actionType: 'delete_box',
      targetId: String(box.id),
      targetName: box.kode,
      entityLabel: 'Storage Box',
      blockerMessage: totalItem > 0
        ? `Storage Box "${box.kode}" masih menampung ${totalItem} item/unit aktif.`
        : null,
      onConfirm: async (token) => {
        const res = await stockApi.deleteBox(box.id, token);
        showToast(res.message, 'success');
        setSelectedBoxIds((prev) => prev.filter((id) => id !== box.id));
        await Promise.all([loadData(), refreshData()]);
      }
    });
  };

  const handleRequestDeleteBoxesBulk = (chosenBoxes: any[]) => {
    if (chosenBoxes.length === 0) return;
    const blocked = chosenBoxes.filter((b) => Number(b.total_item || 0) > 0);
    const sortedIds = chosenBoxes.map((b) => String(b.id)).sort();
    setDeleteTarget({
      actionType: 'delete_box',
      targetId: `bulk:${sortedIds.join(',')}`,
      targetName: `${chosenBoxes.length} Storage Box`,
      entityLabel: 'Storage Box',
      itemCount: chosenBoxes.length,
      itemLabels: chosenBoxes.map((b) => `${b.kode}${b.keterangan ? ` (${b.keterangan})` : ''}`),
      blockerMessage: blocked.length > 0
        ? `Storage Box berikut masih menampung barang aktif: ${blocked.map((b) => `${b.kode} (${b.total_item} item)`).join(', ')}.`
        : null,
      onConfirm: async (token) => {
        const res = await stockApi.deleteBoxBulk(chosenBoxes.map((b) => b.id), token);
        showToast(res.message, 'success');
        setSelectedBoxIds([]);
        await Promise.all([loadData(), refreshData()]);
      }
    });
  };

  const handleRequestDeleteCategory = (cat: Jenis) => {
    const activeProds = products.filter((p) => p.jenis_id === cat.id);
    if (activeProds.length === 0) {
      setDeleteTarget({
        actionType: 'delete_kind',
        targetId: String(cat.id),
        targetName: cat.nama,
        entityLabel: 'Kategori',
        blockerMessage: null,
        onConfirm: async (token) => {
          const res = await catalogApi.deleteJenisWithOptions(cat.id, token, { mode: 'block' });
          showToast(res.message, 'success');
          setSelectedCategoryIds((prev) => prev.filter((id) => id !== cat.id));
          await Promise.all([loadData(), refreshData()]);
        }
      });
      return;
    }

    const otherCats = jenisList.filter((j) => j.id !== cat.id);
    setCategoryDeleteChoice({ category: cat, activeProducts: activeProds });
    setCatDeleteMode(otherCats.length > 0 ? 'move_products' : 'cascade');
    setCatDeleteMoveTargetId(otherCats.length > 0 ? String(otherCats[0].id) : '');
  };

  const handleConfirmCategoryDeleteChoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryDeleteChoice) return;
    const { category, activeProducts } = categoryDeleteChoice;

    if (catDeleteMode === 'move_products') {
      const targetId = Number(catDeleteMoveTargetId);
      const targetCat = jenisList.find((j) => j.id === targetId);
      if (!targetId || !targetCat) {
        showToast('Pilih kategori tujuan untuk memindahkan produk.', 'warning');
        return;
      }
      setCategoryDeleteChoice(null);
      setDeleteTarget({
        actionType: 'delete_kind',
        targetId: String(category.id),
        targetName: `${category.nama} (Pindah ${activeProducts.length} produk ke ${targetCat.nama})`,
        entityLabel: 'Kategori',
        itemCount: activeProducts.length,
        itemLabels: activeProducts.map((p) => `${p.nama} -> ${targetCat.nama}`),
        blockerMessage: null,
        onConfirm: async (token) => {
          const res = await catalogApi.deleteJenisWithOptions(category.id, token, {
            mode: 'move_products',
            target_jenis_id: targetId
          });
          showToast(res.message, 'success');
          setSelectedCategoryIds((prev) => prev.filter((id) => id !== category.id));
          await Promise.all([loadData(), refreshData()]);
        }
      });
      return;
    }

    // Cascade delete: block if any product inside has stock
    const withStock = activeProducts.filter(
      (p) => Number(p.total_stok || 0) > 0 || Number(p.total_dipesan || 0) > 0 || Number(p.stok_rusak || 0) > 0
    );
    setCategoryDeleteChoice(null);
    setDeleteTarget({
      actionType: 'delete_kind',
      targetId: String(category.id),
      targetName: `${category.nama} + ${activeProducts.length} Produk`,
      entityLabel: 'Kategori & Seluruh Produknya',
      itemCount: activeProducts.length,
      itemLabels: activeProducts.map((p) => p.nama),
      blockerMessage: withStock.length > 0
        ? `Produk berikut di dalam kategori "${category.nama}" masih memiliki stok aktif/dipesan/rusak sehingga tidak dapat dihapus sekaligus: ${withStock.map((p) => p.nama).join(', ')}.`
        : null,
      onConfirm: async (token) => {
        const res = await catalogApi.deleteJenisWithOptions(category.id, token, { mode: 'cascade' });
        showToast(res.message, 'success');
        setSelectedCategoryIds((prev) => prev.filter((id) => id !== category.id));
        await Promise.all([loadData(), refreshData()]);
      }
    });
  };

  const handleRequestDeleteCategoriesBulk = (chosenCats: Jenis[]) => {
    if (chosenCats.length === 0) return;
    const blocked = chosenCats.filter((c) => products.some((p) => p.jenis_id === c.id) || Number(c.total_produk || 0) > 0);
    const sortedIds = chosenCats.map((c) => String(c.id)).sort();
    setDeleteTarget({
      actionType: 'delete_kind',
      targetId: `bulk:${sortedIds.join(',')}`,
      targetName: `${chosenCats.length} Kategori`,
      entityLabel: 'Kategori',
      itemCount: chosenCats.length,
      itemLabels: chosenCats.map((c) => c.nama),
      blockerMessage: blocked.length > 0
        ? `Kategori berikut masih memiliki produk aktif (hapus satuan untuk opsi pindah/cascade): ${blocked.map((c) => c.nama).join(', ')}.`
        : null,
      onConfirm: async (token) => {
        const res = await catalogApi.deleteJenisBulk(chosenCats.map((c) => c.id), token);
        showToast(res.message, 'success');
        setSelectedCategoryIds([]);
        await Promise.all([loadData(), refreshData()]);
      }
    });
  };

  const handleRequestDeleteType = (tipe: Tipe, prod: Produk) => {
    const activeStock = Number(tipe.stok_tersedia ?? tipe.stok_total ?? 0);
    const reservedStock = Number(tipe.stok_dipesan ?? 0);
    const damagedStock = Number(tipe.stok_rusak ?? 0);
    const hasStock = activeStock > 0 || reservedStock > 0 || damagedStock > 0;
    setDeleteTarget({
      actionType: 'delete_type',
      targetId: String(tipe.id),
      targetName: `${prod.nama} — ${tipe.nama_tipe}`,
      entityLabel: 'Varian Tipe',
      blockerMessage: hasStock
        ? `Varian "${tipe.nama_tipe}" masih memiliki stok tersimpan (Tersedia: ${activeStock}, Dipesan: ${reservedStock}, Rusak: ${damagedStock}).`
        : null,
      onConfirm: async (token) => {
        const res = await catalogApi.deleteTipe(tipe.id, token);
        showToast(res.message, 'success');
        setSelectedTypeIds((prev) => prev.filter((id) => id !== tipe.id));
        await Promise.all([loadData(), refreshData()]);
      }
    });
  };

  const handleRequestDeleteTypesBulk = (chosenEntries: Array<{ tipe: Tipe; produkNama: string }>) => {
    if (chosenEntries.length === 0) return;
    const blocked = chosenEntries.filter(
      ({ tipe }) =>
        Number(tipe.stok_tersedia ?? tipe.stok_total ?? 0) > 0 ||
        Number(tipe.stok_dipesan ?? 0) > 0 ||
        Number(tipe.stok_rusak ?? 0) > 0
    );
    const sortedIds = chosenEntries.map(({ tipe }) => String(tipe.id)).sort();
    setDeleteTarget({
      actionType: 'delete_type',
      targetId: `bulk:${sortedIds.join(',')}`,
      targetName: `${chosenEntries.length} Varian Tipe`,
      entityLabel: 'Varian Tipe',
      itemCount: chosenEntries.length,
      itemLabels: chosenEntries.map(({ tipe, produkNama }) => `${produkNama} — ${tipe.nama_tipe}`),
      blockerMessage: blocked.length > 0
        ? `Varian berikut masih memiliki stok tersimpan: ${blocked.map(({ tipe }) => tipe.nama_tipe).join(', ')}.`
        : null,
      onConfirm: async (token) => {
        const res = await catalogApi.deleteTipeBulk(chosenEntries.map(({ tipe }) => tipe.id), token);
        showToast(res.message, 'success');
        setSelectedTypeIds([]);
        await Promise.all([loadData(), refreshData()]);
      }
    });
  };

  const handleRequestDeleteTypeItem = (it: any) => {
    setDeleteTarget({
      actionType: 'delete_item',
      targetId: String(it.id),
      targetName: it.kode_id,
      entityLabel: 'Item Fisik',
      blockerMessage: it.status !== 'aktif'
        ? `Item "${it.kode_id}" berstatus "${it.status}" sehingga tidak dapat dihapus.`
        : null,
      onConfirm: async (token) => {
        const res = await stockApi.deleteItem(it.id, token);
        showToast(res.message, 'success');
        setSelectedTypeItemIds((prev) => prev.filter((id) => id !== it.id));
        if (selectedTypeForItems) {
          const updated = await catalogApi.getItemsByTipe(selectedTypeForItems.id);
          setTypeItemsData(updated);
        }
        await Promise.all([loadData(), refreshData()]);
      }
    });
  };

  const handleRequestDeleteTypeItemsBulk = (chosenItems: any[]) => {
    if (chosenItems.length === 0) return;
    const blocked = chosenItems.filter((it) => it.status !== 'aktif');
    const sortedIds = chosenItems.map((it) => String(it.id)).sort();
    setDeleteTarget({
      actionType: 'delete_item',
      targetId: `bulk:${sortedIds.join(',')}`,
      targetName: `${chosenItems.length} Item Fisik`,
      entityLabel: 'Item Fisik',
      itemCount: chosenItems.length,
      itemLabels: chosenItems.map((it) => `${it.kode_id} (${it.box_kode})`),
      blockerMessage: blocked.length > 0
        ? `Item berikut tidak berstatus aktif: ${blocked.map((it) => `${it.kode_id} (${it.status})`).join(', ')}.`
        : null,
      onConfirm: async (token) => {
        const res = await stockApi.deleteItemsBulk(chosenItems.map((it) => it.id), token);
        showToast(res.message, 'success');
        setSelectedTypeItemIds([]);
        if (selectedTypeForItems) {
          const updated = await catalogApi.getItemsByTipe(selectedTypeForItems.id);
          setTypeItemsData(updated);
        }
        await Promise.all([loadData(), refreshData()]);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>FieldOps IT Inventory</span>
              <span aria-hidden="true">·</span>
              <span>Katalog Terpadu</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">Kategori · Produk · Varian Tipe</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              Katalog Data Barang &amp; Aturan ID Varian
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
              Struktur katalog terpadu dengan agregasi status stok WhatsApp Alert, penelusuran kategori, dan pengelolaan storage box.
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

            {canImportCatalog && (
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors flex items-center gap-2 shadow-xs whitespace-nowrap"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Impor Excel / Spreadsheet</span>
              </button>
            )}

            {(canManageStock || canManageCatalog) && (
              <button
                onClick={() => setIsStockInputOpen(true)}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-2 shadow-xs whitespace-nowrap"
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
              <span>Produk &amp; Varian</span>
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

            {canManageCatalog && (
              <button
                onClick={() => setActiveSubTab('kelola')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
                  activeSubTab === 'kelola'
                    ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>Kelola &amp; Pengaturan</span>
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
                  onChange={e => setSelectedJenisId(e.target.value)}
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
                Sesuaikan kata kunci pencarian atau buat produk baru untuk memulai katalog.
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
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-mono tabular-nums">
                              Tersedia: {prod.total_stok ?? 0} {prod.tipe_stok || 'Unit'}
                            </span>
                            {Number(prod.total_dipesan || 0) > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-mono tabular-nums" title="Stok sedang dipesan (reserved) untuk request yang disetujui">
                                Dipesan: {prod.total_dipesan}
                              </span>
                            )}
                            {prod.stok_rusak !== undefined && prod.stok_rusak > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-mono tabular-nums" title="Item rusak tidak dihitung dalam stok tersedia">
                                Rusak: {prod.stok_rusak}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span className="font-medium text-slate-700 dark:text-slate-300">{prod.jenis_nama}</span>
                            <span aria-hidden="true">·</span>
                            <span>{prod.kategori === 'fast_moving' ? 'Fast Moving' : 'Recycle'}</span>
                            <span aria-hidden="true">·</span>
                            <span>{prod.kategori_barang || 'Barang Habis Pakai'}</span>
                          </div>
                          {prod.catatan && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {prod.catatan}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
                        <button
                          type="button"
                          onClick={() => toggleProductExpand(prod.id)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <span>{prod.total_tipe ?? prod.tipes?.length ?? 0} Varian Tipe</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {canManageCatalog && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenAddType(prod)}
                              className="px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors flex items-center gap-1 shadow-xs whitespace-nowrap shrink-0"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Tambah Tipe</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openMoveSingleProduct(prod)}
                              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                              title={`Pindah produk ${prod.nama} ke kategori lain`}
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span>Pindah Kategori</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRequestDeleteProduct(prod)}
                              className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg transition-colors shrink-0"
                              title={`Hapus Produk ${prod.nama}`}
                              aria-label={`Hapus Produk ${prod.nama}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
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

                                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenTypeItems(t)}
                                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors flex items-center gap-1 cursor-pointer font-mono tabular-nums"
                                      title="Klik untuk melihat daftar ID item fisik, lokasi box, pindah, atau hapus stok"
                                    >
                                      <BoxIcon className="w-3.5 h-3.5" />
                                      <span>{t.stok_tersedia ?? t.stok_total ?? 0} {prod.tipe_stok || 'Unit'}</span>
                                      {Number(t.stok_dipesan || 0) > 0 && (
                                        <span className="ml-1 text-[10px] text-amber-700 dark:text-amber-300">
                                          (+{t.stok_dipesan} dipesan)
                                        </span>
                                      )}
                                    </button>

                                    {canManageCatalog && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => openEditTypeAndIdRule(t)}
                                          className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors flex items-center gap-1"
                                          title="Ubah nama tipe & aturan ID"
                                        >
                                          <Pencil className="w-3 h-3" />
                                          <span>Tipe &amp; ID</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openMoveSingleType(t, prod)}
                                          className="p-1 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                                          title={`Pindah tipe ${t.nama_tipe} ke produk lain`}
                                          aria-label={`Pindah tipe ${t.nama_tipe}`}
                                        >
                                          <ArrowRightLeft className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRequestDeleteType(t, prod)}
                                          className="p-1 text-rose-500 hover:text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded transition-colors"
                                          title={`Hapus tipe ${t.nama_tipe}`}
                                          aria-label={`Hapus tipe ${t.nama_tipe}`}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {t.catatan && (
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {t.catatan}
                                  </p>
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
      {/* SUBTAB 2: JELAJAH KATEGORI */}
      {/* ========================================================================= */}
      {activeSubTab === 'kategori' && (
        <CatalogBrowseCategoriesTab
          categories={jenisList}
          products={products}
          canManageCatalog={canManageCatalog}
          onOpenTypeDetail={handleOpenTypeItems}
          onOpenStockOut={(tipe) => {
            if (onOpenStockOutItem) {
              onOpenStockOutItem({ tipe_id: tipe.id });
            } else {
              setIsStockInputOpen(true);
            }
          }}
          onDeleteCategory={handleRequestDeleteCategory}
          onMoveProduct={openMoveSingleProduct}
          onOpenManageCategoryMembers={(cat) => {
            setFocusManageCategoryId(cat.id);
            setActiveSubTab('kelola');
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
          onDeleteBox={handleRequestDeleteBox}
        />
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4: KELOLA & PENGATURAN (4 KARTU) */}
      {/* ========================================================================= */}
      {activeSubTab === 'kelola' && canManageCatalog && (
        <CatalogManageTab
          categories={jenisList}
          products={products}
          boxesList={boxesList}
          canManageCatalog={canManageCatalog}
          canImportCatalog={canImportCatalog}
          initialFocusCategoryId={focusManageCategoryId}
          selectedProductIds={selectedProductIds}
          onToggleProductSelect={(prodId) => {
            setSelectedProductIds((prev) =>
              prev.includes(prodId) ? prev.filter((id) => id !== prodId) : [...prev, prodId]
            );
          }}
          onToggleSelectAllProducts={(filteredIds) => {
            const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedProductIds.includes(id));
            if (allSelected) {
              setSelectedProductIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
            } else {
              setSelectedProductIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
            }
          }}
          onMoveProductsBulk={handleMoveProductsBulk}
          onDeleteProductsBulk={handleRequestDeleteProductsBulk}
          onMoveSingleProduct={openMoveSingleProduct}
          onMoveSingleType={openMoveSingleType}
          onEditTypeAndIdRule={openEditTypeAndIdRule}
          onDeleteSingleType={handleRequestDeleteType}
          selectedTypeIds={selectedTypeIds}
          onToggleTypeSelect={(tipeId) => {
            setSelectedTypeIds((prev) =>
              prev.includes(tipeId) ? prev.filter((id) => id !== tipeId) : [...prev, tipeId]
            );
          }}
          onDeleteTypesBulk={handleRequestDeleteTypesBulk}
          onOpenAddCategory={() => setIsAddJenisOpen(true)}
          onEditCategory={openEditCategory}
          onDeleteCategory={handleRequestDeleteCategory}
          selectedCategoryIds={selectedCategoryIds}
          onToggleCategorySelect={(catId) => {
            setSelectedCategoryIds((prev) =>
              prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
            );
          }}
          onToggleSelectAllCategories={() => {
            if (selectedCategoryIds.length === jenisList.length) {
              setSelectedCategoryIds([]);
            } else {
              setSelectedCategoryIds(jenisList.map((c) => c.id));
            }
          }}
          onDeleteCategoriesBulk={handleRequestDeleteCategoriesBulk}
          onOpenCreateBox={() => setIsBoxManagerOpen(true)}
          onOpenBoxContents={(boxId) => setSelectedBoxForContent(boxId)}
          onDeleteBox={handleRequestDeleteBox}
          selectedBoxIds={selectedBoxIds}
          onToggleBoxSelect={(boxId) => {
            setSelectedBoxIds((prev) =>
              prev.includes(boxId) ? prev.filter((id) => id !== boxId) : [...prev, boxId]
            );
          }}
          onToggleSelectAllBoxes={() => {
            if (selectedBoxIds.length === boxesList.length) {
              setSelectedBoxIds([]);
            } else {
              setSelectedBoxIds(boxesList.map((b: any) => b.id));
            }
          }}
          onDeleteBoxesBulk={handleRequestDeleteBoxesBulk}
          onOpenImportModal={() => setIsImportModalOpen(true)}
          onOpenSNPatterns={() => setIsSNPatternsOpen(true)}
          onOpenTrash={() => setIsTrashOpen(true)}
          onOpenRestore={onOpenRestore}
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
                  placeholder="Keterangan data barang atau peruntukan..."
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
      {/* MODAL: BUAT TIPE VARIAN BARU (NAMA MANUAL BEBAS) */}
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
              <button type="button" onClick={() => setIsAddTypeOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateType} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Varian Tipe * (Contoh: 12V 2A Jack Kecil, 8 Port Gigabit, 100m Outdoor)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ketik nama varian tipe..."
                  value={typeNamaTipe}
                  onChange={e => setTypeNamaTipe(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan Varian (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Spesifikasi singkat atau keterangan varian..."
                  value={typeCatatan}
                  onChange={e => setTypeCatatan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

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
                      onClick={() => {
                        setTypeSumberId(mode);
                        setTypePolaIdError(null);
                      }}
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
                  <div className="space-y-1.5">
                    <label className="block font-medium text-slate-600 dark:text-slate-400">
                      Pola Regex Validasi ID (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder={
                        typeSumberId === 'scan_sn'
                          ? 'Contoh: ^ZTEGD[0-9A-Fa-f]{7}$'
                          : 'Misal: ^SN[0-9]{8}$ atau ^ADP[A-Z0-9]+$'
                      }
                      value={typePolaId}
                      onChange={e => {
                        setTypePolaId(e.target.value);
                        if (typePolaIdError) setTypePolaIdError(null);
                      }}
                      className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-slate-900 dark:text-slate-100 font-mono ${
                        typePolaIdError
                          ? 'border-rose-500 focus:ring-rose-500'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                    {typePolaIdError && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                        {typePolaIdError}
                      </p>
                    )}
                    {typeSumberId === 'scan_sn' && (
                      <div className="space-y-1.5 pt-0.5">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Dipakai untuk memilih SN dari hasil scan foto. Contoh ZTE GPON:{' '}
                          <code className="font-mono text-emerald-700 dark:text-emerald-400">
                            ^ZTEGD[0-9A-Fa-f]{'{7}'}$
                          </code>
                        </p>
                        {!typePolaId.trim() ? (
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                            Tanpa regex, scan bisa mengambil MAC atau D-SN.
                          </p>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Uji regex: tempel contoh SN..."
                              value={typeTestSn}
                              onChange={e => setTypeTestSn(e.target.value)}
                              className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] text-slate-900 dark:text-slate-100 font-mono"
                            />
                            {typeTestSn.trim() && (() => {
                              try {
                                const isMatch = new RegExp(typePolaId.trim(), 'i').test(typeTestSn.trim());
                                return (
                                  <span className={`text-[11px] font-bold shrink-0 ${
                                    isMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                  }`}>
                                    {isMatch ? 'Cocok' : 'Tidak cocok'}
                                  </span>
                                );
                              } catch {
                                return (
                                  <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 shrink-0">
                                    Regex tidak valid
                                  </span>
                                );
                              }
                            })()}
                          </div>
                        )}
                      </div>
                    )}
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
      {/* MODAL: UBAH NAMA TIPE & KOREKSI ATURAN ID TIPE */}
      {/* ========================================================================= */}
      {isCorrectIdRuleOpen && selectedTypeForIdRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Ubah Varian Tipe &amp; Aturan ID
                </h3>
                <span className="text-xs text-slate-500">
                  Tipe saat ini: <strong>{selectedTypeForIdRule.nama_tipe}</strong>
                </span>
              </div>
              <button type="button" onClick={() => setIsCorrectIdRuleOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveIdRuleCorrection} className="space-y-3.5 text-xs">
              {Boolean(selectedTypeForIdRule.id_dikunci) && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Aturan ID tipe ini sudah <strong>dikunci</strong> karena stok fisik pernah tercatat. Perubahan memerlukan konfirmasi nama tipe dan alasan wajib.
                  </span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Varian Tipe *
                </label>
                <input
                  type="text"
                  required
                  value={correctNamaTipe}
                  onChange={e => setCorrectNamaTipe(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sumber ID Baru
                </label>
                <select
                  value={correctSumberId}
                  onChange={e => {
                    setCorrectSumberId(e.target.value as any);
                    setCorrectPolaIdError(null);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  <option value="scan_sn">scan_sn (Barcode / SN Pabrik)</option>
                  <option value="otomatis">otomatis (Generate Nomor Seri Sistem &amp; QR)</option>
                  <option value="manual">manual (Ketik Manual Pengguna)</option>
                  <option value="tanpa_id">tanpa_id (Mode Stok Jumlah)</option>
                </select>
              </div>

              {correctSumberId === 'otomatis' && (
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
              )}

              {correctSumberId !== 'tanpa_id' && (
                <div className="space-y-1.5">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    Pola Regex Validasi Baru
                  </label>
                  <input
                    type="text"
                    placeholder={
                      correctSumberId === 'scan_sn'
                        ? 'Contoh: ^ZTEGD[0-9A-Fa-f]{7}$'
                        : 'Misal: ^SN[0-9]{8}$'
                    }
                    value={correctPolaId}
                    onChange={e => {
                      setCorrectPolaId(e.target.value);
                      if (correctPolaIdError) setCorrectPolaIdError(null);
                    }}
                    className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-lg text-slate-900 dark:text-slate-100 font-mono ${
                      correctPolaIdError
                        ? 'border-rose-500 focus:ring-rose-500'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                  {correctPolaIdError && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                      {correctPolaIdError}
                    </p>
                  )}
                  {correctSumberId === 'scan_sn' && (
                    <div className="space-y-1.5 pt-0.5">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Dipakai untuk memilih SN dari hasil scan foto. Contoh ZTE GPON:{' '}
                        <code className="font-mono text-emerald-700 dark:text-emerald-400">
                          ^ZTEGD[0-9A-Fa-f]{'{7}'}$
                        </code>
                      </p>
                      {!correctPolaId.trim() ? (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                          Tanpa regex, scan bisa mengambil MAC atau D-SN.
                        </p>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Uji regex: tempel contoh SN..."
                            value={correctTestSn}
                            onChange={e => setCorrectTestSn(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] text-slate-900 dark:text-slate-100 font-mono"
                          />
                          {correctTestSn.trim() && (() => {
                            try {
                              const isMatch = new RegExp(correctPolaId.trim(), 'i').test(correctTestSn.trim());
                              return (
                                <span className={`text-[11px] font-bold shrink-0 ${
                                  isMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                }`}>
                                  {isMatch ? 'Cocok' : 'Tidak cocok'}
                                </span>
                              );
                            } catch {
                              return (
                                <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 shrink-0">
                                  Regex tidak valid
                                </span>
                              );
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/70 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                Catatan: Koreksi aturan ID hanya berlaku untuk scan atau input baru dan tidak mengubah data barang yang sudah tersimpan.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Alasan Perubahan * (Tercatat di Audit Log)
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Jelaskan alasan perubahan nama tipe / standardisasi barcode..."
                  value={correctAlasan}
                  onChange={e => setCorrectAlasan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              {Boolean(selectedTypeForIdRule.id_dikunci) && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2.5">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Ketik ulang nama tipe persis <code className="font-mono text-amber-700 dark:text-amber-300">{selectedTypeForIdRule.nama_tipe}</code> *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={selectedTypeForIdRule.nama_tipe}
                      value={correctConfirmTyped}
                      onChange={e => setCorrectConfirmTyped(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                    />
                  </div>
                  {correctNeedsReauth && (
                    <div>
                      <label className="block font-semibold text-rose-700 dark:text-rose-300 mb-1">
                        Verifikasi Kata Sandi Akun Anda *
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Masukkan password login Anda..."
                        value={correctReauthPassword}
                        onChange={e => setCorrectReauthPassword(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 rounded-lg text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  )}
                </div>
              )}

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
                  Simpan Perubahan
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
        onSuccess={() => {
          loadData();
          refreshData();
        }}
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
        onRefreshParent={() => {
          loadData();
          refreshData();
        }}
      />

      {/* Modal Detail Item Fisik per Tipe (Klik Angka Stok) */}
      {selectedTypeForItems && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <BoxIcon className="w-5 h-5 text-emerald-500" />
                  <span>Daftar Item Fisik &amp; Stok Tipe</span>
                </h3>
                <span className="text-xs text-slate-500">
                  Tipe: <strong>{selectedTypeForItems.nama_tipe}</strong> ({selectedTypeForItems.produk_nama}) · Mode:{' '}
                  <span className="font-mono">{selectedTypeForItems.mode_stok === 'per_id' ? 'Ber-ID' : 'Non-SN (Jumlah)'}</span>
                </span>
              </div>
              <button type="button" onClick={() => setSelectedTypeForItems(null)} className="text-slate-400 hover:text-slate-600">
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
                {/* Inline Form Pindah Unit (per_id / jumlah ke Box atau Tipe lain) */}
                {typeItemsMoveTarget && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const chosenBoxId = typeMoveBoxId.trim();
                      const chosenTipeId = typeMoveTipeId !== 'SAME' ? Number(typeMoveTipeId) : undefined;
                      if (!chosenBoxId && !chosenTipeId) {
                        showToast('Pilih Box tujuan atau Varian Tipe tujuan terlebih dahulu.', 'warning');
                        return;
                      }
                      setTypeMoveSubmitting(true);
                      try {
                        const res = await stockApi.moveUnit({
                          item_ids: typeItemsMoveTarget.mode === 'per_id' ? typeItemsMoveTarget.itemIds : undefined,
                          tipe_asal_id: selectedTypeForItems.id,
                          box_asal_id: typeItemsMoveTarget.boxAsalId,
                          jumlah: typeItemsMoveTarget.mode === 'jumlah' ? Math.max(1, parseInt(typeMoveQty, 10) || 1) : undefined,
                          box_tujuan_id: chosenBoxId || undefined,
                          tipe_tujuan_id: chosenTipeId,
                          catatan: typeMoveNote.trim() || undefined
                        });
                        showToast(res.message, 'success');
                        setTypeItemsMoveTarget(null);
                        setSelectedTypeItemIds([]);
                        const updated = await catalogApi.getItemsByTipe(selectedTypeForItems.id);
                        setTypeItemsData(updated);
                        await Promise.all([loadData(), refreshData()]);
                      } catch (err: unknown) {
                        showToast(err instanceof Error ? err.message : 'Gagal memindahkan unit.', 'error');
                      } finally {
                        setTypeMoveSubmitting(false);
                      }
                    }}
                    className="p-3.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                        <ArrowRightLeft className="w-4 h-4" />
                        <span>Pindah {typeItemsMoveTarget.label}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setTypeItemsMoveTarget(null)}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Pindah ke Storage Box
                        </label>
                        <select
                          value={typeMoveBoxId}
                          onChange={(e) => setTypeMoveBoxId(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                        >
                          <option value="">-- Tetap di Box Asal --</option>
                          {boxesList.map((b: any) => (
                            <option key={b.id} value={b.id}>
                              {b.kode} {b.keterangan ? `(${b.keterangan})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Pindah ke Varian Tipe Lain (Mode Sama)
                        </label>
                        <select
                          value={typeMoveTipeId}
                          onChange={(e) => setTypeMoveTipeId(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                        >
                          <option value="SAME">-- Tetap di Tipe Saat Ini --</option>
                          {products.flatMap((p) =>
                            (p.tipes || [])
                              .filter((t) => t.id !== selectedTypeForItems.id && t.mode_stok === selectedTypeForItems.mode_stok)
                              .map((t) => (
                                <option key={t.id} value={t.id}>
                                  {p.nama} — {t.nama_tipe}
                                </option>
                              ))
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {typeItemsMoveTarget.mode === 'jumlah' && (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Jumlah Dipindah (Maks bebas: {typeItemsMoveTarget.maxQty || 1})
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={typeItemsMoveTarget.maxQty || 1}
                            value={typeMoveQty}
                            onChange={(e) => setTypeMoveQty(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded font-mono text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      )}
                      <div className={typeItemsMoveTarget.mode === 'jumlah' ? '' : 'sm:col-span-2'}>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Catatan Mutasi (Opsional)
                        </label>
                        <input
                          type="text"
                          value={typeMoveNote}
                          onChange={(e) => setTypeMoveNote(e.target.value)}
                          placeholder="Alasan pemindahan..."
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setTypeItemsMoveTarget(null)}
                        className="px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={typeMoveSubmitting}
                        className="px-3 py-1.5 font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded disabled:opacity-50"
                      >
                        {typeMoveSubmitting ? 'Memindahkan...' : 'Jalankan Pemindahan'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Inline Form Hapus Stok Jumlah Non-SN */}
                {typeItemsDeleteSjTarget && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const qtyToDelete = Math.max(1, parseInt(typeDeleteSjQty, 10) || 1);
                      const target = typeItemsDeleteSjTarget;
                      setTypeItemsDeleteSjTarget(null);
                      setDeleteTarget({
                        actionType: 'delete_stok_jumlah',
                        targetId: `${target.tipeId}:${target.boxId}`,
                        targetName: `${qtyToDelete} unit ${selectedTypeForItems.nama_tipe} (Box ${target.boxKode})`,
                        entityLabel: 'Stok Non-SN',
                        blockerMessage:
                          target.freeQty <= 0
                            ? `Seluruh stok di Box ${target.boxKode} sedang dipesan (${target.reservedQty} reserved) sehingga tidak bisa dihapus.`
                            : qtyToDelete > target.freeQty
                            ? `Jumlah hapus (${qtyToDelete}) melebihi stok bebas (${target.freeQty} unit; ${target.reservedQty} unit sedang dipesan).`
                            : null,
                        onConfirm: async (token) => {
                          const res = await stockApi.deleteStokJumlah(target.tipeId, target.boxId, qtyToDelete, token);
                          showToast(res.message, 'success');
                          const updated = await catalogApi.getItemsByTipe(selectedTypeForItems.id);
                          setTypeItemsData(updated);
                          await Promise.all([loadData(), refreshData()]);
                        }
                      });
                    }}
                    className="p-3.5 rounded-lg bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                        <Trash2 className="w-4 h-4" />
                        <span>Hapus Stok Non-SN — Box {typeItemsDeleteSjTarget.boxKode}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setTypeItemsDeleteSjTarget(null)}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      Total: <strong className="font-mono">{typeItemsDeleteSjTarget.totalQty}</strong> · Dipesan:{' '}
                      <strong className="font-mono">{typeItemsDeleteSjTarget.reservedQty}</strong> · Bebas dihapus:{' '}
                      <strong className="font-mono text-emerald-700 dark:text-emerald-300">{typeItemsDeleteSjTarget.freeQty}</strong>
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, typeItemsDeleteSjTarget.freeQty)}
                        value={typeDeleteSjQty}
                        onChange={(e) => setTypeDeleteSjQty(e.target.value)}
                        className="w-32 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 rounded font-mono text-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => setTypeDeleteSjQty(String(Math.max(1, typeItemsDeleteSjTarget.freeQty)))}
                        className="px-2.5 py-1.5 text-[11px] font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200"
                      >
                        Semua Bebas ({typeItemsDeleteSjTarget.freeQty})
                      </button>
                      <button
                        type="submit"
                        disabled={typeItemsDeleteSjTarget.freeQty <= 0}
                        className="ml-auto px-3 py-1.5 font-bold text-white bg-rose-600 hover:bg-rose-500 rounded disabled:opacity-50"
                      >
                        Lanjut Hapus
                      </button>
                    </div>
                  </form>
                )}

                {/* Mode Stok Jumlah (Bulk non-SN) */}
                {typeItemsData.stokJumlah && typeItemsData.stokJumlah.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-bold text-slate-700 dark:text-slate-300">
                        Stok Jumlah (Non-SN) per Box:
                      </h4>
                      {canManageCatalog && selectedTypeSjBoxIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const chosenSj = typeItemsData.stokJumlah.filter((sj: any) =>
                              selectedTypeSjBoxIds.includes(String(sj.box_id))
                            );
                            if (chosenSj.length === 0) return;
                            const entries = chosenSj.map((sj: any) => {
                              const freeQty = Math.max(0, Number(sj.jumlah || 0) - Number(sj.reserved_qty || 0));
                              return { tipe_id: selectedTypeForItems.id, box_id: String(sj.box_id), jumlah: freeQty, boxKode: sj.box_kode, freeQty };
                            });
                            const blocked = entries.filter((ent) => ent.freeQty <= 0);
                            const sortedKeys = entries.map((ent) => `${ent.tipe_id}:${ent.box_id}`).sort();
                            setDeleteTarget({
                              actionType: 'delete_stok_jumlah',
                              targetId: `bulk:${sortedKeys.join(',')}`,
                              targetName: `Stok Non-SN di ${entries.length} Box`,
                              entityLabel: 'Stok Non-SN',
                              itemCount: entries.length,
                              itemLabels: entries.map((ent) => `Box ${ent.boxKode}: ${ent.freeQty} unit bebas`),
                              blockerMessage:
                                blocked.length > 0
                                  ? `Box berikut tidak memiliki stok bebas karena seluruhnya sedang dipesan: ${blocked.map((b) => b.boxKode).join(', ')}.`
                                  : null,
                              onConfirm: async (token) => {
                                const res = await stockApi.deleteStokJumlahBulk(
                                  entries.map((ent) => ({ tipe_id: ent.tipe_id, box_id: ent.box_id, jumlah: ent.jumlah })),
                                  token
                                );
                                showToast(res.message, 'success');
                                setSelectedTypeSjBoxIds([]);
                                const updated = await catalogApi.getItemsByTipe(selectedTypeForItems.id);
                                setTypeItemsData(updated);
                                await Promise.all([loadData(), refreshData()]);
                              }
                            });
                          }}
                          className="px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded flex items-center gap-1 shadow-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus Stok Non-SN Terpilih ({selectedTypeSjBoxIds.length})</span>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {typeItemsData.stokJumlah.map((sj: any, idx: number) => {
                        const boxIdStr = String(sj.box_id || '');
                        const totalQty = Number(sj.jumlah || 0);
                        const reservedQty = Number(sj.reserved_qty || 0);
                        const freeQty = Math.max(0, totalQty - reservedQty);
                        const isSjSelected = selectedTypeSjBoxIds.includes(boxIdStr);
                        return (
                          <div
                            key={boxIdStr || idx}
                            className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${
                              isSjSelected
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-500'
                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              {canManageCatalog && boxIdStr && (
                                <input
                                  type="checkbox"
                                  checked={isSjSelected}
                                  onChange={() => {
                                    setSelectedTypeSjBoxIds((prev) =>
                                      prev.includes(boxIdStr) ? prev.filter((id) => id !== boxIdStr) : [...prev, boxIdStr]
                                    );
                                  }}
                                  aria-label={`Pilih stok non-SN di Box ${sj.box_kode}`}
                                  className="mt-1 h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 text-emerald-600 cursor-pointer shrink-0"
                                />
                              )}
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 dark:text-white">{sj.box_kode}</span>
                                {sj.box_keterangan && <span className="text-[11px] text-slate-500 block truncate">{sj.box_keterangan}</span>}
                                <div className="text-[11px] font-mono tabular-nums text-emerald-700 dark:text-emerald-300 font-bold mt-0.5">
                                  {totalQty} unit{reservedQty > 0 ? ` · ${reservedQty} dipesan` : ''}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {(canManageStock || canManageCatalog) && freeQty > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTypeItemsDeleteSjTarget(null);
                                    setTypeItemsMoveTarget({
                                      mode: 'jumlah',
                                      label: `Stok Non-SN dari Box ${sj.box_kode}`,
                                      boxAsalId: boxIdStr,
                                      maxQty: freeQty
                                    });
                                    setTypeMoveBoxId('');
                                    setTypeMoveTipeId('SAME');
                                    setTypeMoveQty(String(freeQty));
                                    setTypeMoveNote('');
                                  }}
                                  className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded transition-colors"
                                  title={`Pindah stok dari Box ${sj.box_kode}`}
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canManageCatalog && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTypeItemsMoveTarget(null);
                                    setTypeItemsDeleteSjTarget({
                                      tipeId: selectedTypeForItems.id,
                                      boxId: boxIdStr,
                                      boxKode: sj.box_kode,
                                      totalQty,
                                      reservedQty,
                                      freeQty
                                    });
                                    setTypeDeleteSjQty(String(Math.max(1, freeQty)));
                                  }}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 dark:text-rose-400 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded transition-colors"
                                  title={`Hapus stok non-SN di Box ${sj.box_kode}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Item Fisik Ber-ID */}
                {typeItemsData.items && typeItemsData.items.length > 0 ? (() => {
                  const visibleItems = typeItemsData.items.filter(
                    (it) => itemConditionFilter === 'ALL' || (it.kondisi || 'Baik') === itemConditionFilter
                  );
                  const visibleIds = visibleItems.map((it: any) => String(it.id));
                  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedTypeItemIds.includes(id));

                  return (
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h4 className="font-bold text-slate-700 dark:text-slate-300">
                          Rincian Item Fisik Ber-ID ({typeItemsData.items.length} Unit Aktif):
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          {(canManageCatalog || canManageStock) && selectedTypeItemIds.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const chosen = typeItemsData.items.filter((it) => selectedTypeItemIds.includes(String(it.id)));
                                if (chosen.length === 0) return;
                                setTypeItemsDeleteSjTarget(null);
                                setTypeItemsMoveTarget({
                                  mode: 'per_id',
                                  itemIds: chosen.map((it: any) => String(it.id)),
                                  label: `${chosen.length} Item Fisik Terpilih`,
                                  boxAsalId: String(chosen[0].box_id || '')
                                });
                                setTypeMoveBoxId('');
                                setTypeMoveTipeId('SAME');
                                setTypeMoveNote('');
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded flex items-center gap-1 shadow-xs"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span>Pindah Box / Tipe ({selectedTypeItemIds.length})</span>
                            </button>
                          )}
                          {canManageCatalog && selectedTypeItemIds.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const chosen = typeItemsData.items.filter((it) => selectedTypeItemIds.includes(String(it.id)));
                                handleRequestDeleteTypeItemsBulk(chosen);
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded flex items-center gap-1 shadow-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus Item Terpilih ({selectedTypeItemIds.length})</span>
                            </button>
                          )}
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

                      {/* Inline Condition Edit Sub-Form */}
                      {editingTypeItem && (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            try {
                              await catalogApi.updateItemCondition(
                                editingTypeItem.id,
                                editTypeItemKondisi,
                                editTypeItemCatatan.trim() || undefined
                              );
                              showToast(`Kondisi item "${editingTypeItem.kode_id}" berhasil diubah ke ${editTypeItemKondisi}.`, 'success');
                              setEditingTypeItem(null);
                              if (selectedTypeForItems) {
                                const updated = await catalogApi.getItemsByTipe(selectedTypeForItems.id);
                                setTypeItemsData(updated);
                              }
                              await Promise.all([loadData(), refreshData()]);
                            } catch (err: any) {
                              showToast(err.message, 'error');
                            }
                          }}
                          className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-end gap-2"
                        >
                          <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                              Kondisi untuk {editingTypeItem.kode_id}
                            </label>
                            <select
                              value={editTypeItemKondisi}
                              onChange={(e) => setEditTypeItemKondisi(e.target.value as any)}
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs font-semibold text-slate-900 dark:text-slate-100"
                            >
                              <option value="Baru">Baru</option>
                              <option value="Baik">Baik</option>
                              <option value="Perlu Perbaikan">Perlu Perbaikan</option>
                              <option value="Rusak">Rusak</option>
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                              Catatan Kondisi (Opsional)
                            </label>
                            <input
                              type="text"
                              value={editTypeItemCatatan}
                              onChange={(e) => setEditTypeItemCatatan(e.target.value)}
                              placeholder="Catatan kondisi..."
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingTypeItem(null)}
                              className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded"
                            >
                              Batal
                            </button>
                            <button
                              type="submit"
                              className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded"
                            >
                              Simpan
                            </button>
                          </div>
                        </form>
                      )}

                      <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700 text-[11px]">
                            <tr>
                              {(canManageCatalog || canManageStock) && (
                                <th className="p-2.5 w-8">
                                  <input
                                    type="checkbox"
                                    checked={allVisibleSelected}
                                    onChange={() => {
                                      if (allVisibleSelected) {
                                        setSelectedTypeItemIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
                                      } else {
                                        setSelectedTypeItemIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
                                      }
                                    }}
                                    aria-label="Pilih semua item fisik"
                                    className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 text-emerald-600 cursor-pointer"
                                  />
                                </th>
                              )}
                              <th className="p-2.5">KODE ID (SN / MANUAL)</th>
                              <th className="p-2.5">LOKASI BOX</th>
                              <th className="p-2.5">KONDISI</th>
                              <th className="p-2.5">STATUS</th>
                              <th className="p-2.5">AKSI</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                            {visibleItems.map((it: any) => {
                              const kondisi = it.kondisi || 'Baik';
                              const isItemSelected = selectedTypeItemIds.includes(String(it.id));
                              const badgeClass =
                                kondisi === 'Baru'
                                  ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800'
                                  : kondisi === 'Perlu Perbaikan'
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                  : kondisi === 'Rusak'
                                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';

                              return (
                                <tr key={it.id} className={isItemSelected ? 'bg-emerald-50/50 dark:bg-emerald-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}>
                                  {(canManageCatalog || canManageStock) && (
                                    <td className="p-2.5">
                                      <input
                                        type="checkbox"
                                        checked={isItemSelected}
                                        onChange={() => {
                                          const strId = String(it.id);
                                          setSelectedTypeItemIds((prev) =>
                                            prev.includes(strId) ? prev.filter((id) => id !== strId) : [...prev, strId]
                                          );
                                        }}
                                        aria-label={`Pilih item ${it.kode_id}`}
                                        className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 text-emerald-600 cursor-pointer"
                                      />
                                    </td>
                                  )}
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
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingTypeItem(it);
                                          setEditTypeItemKondisi(kondisi);
                                          setEditTypeItemCatatan(it.catatan_kondisi || '');
                                        }}
                                        className="font-sans text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-semibold whitespace-nowrap"
                                      >
                                        Ubah Kondisi
                                      </button>
                                      {(canManageCatalog || canManageStock) && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setTypeItemsDeleteSjTarget(null);
                                            setTypeItemsMoveTarget({
                                              mode: 'per_id',
                                              itemIds: [String(it.id)],
                                              label: `Item ${it.kode_id}`,
                                              boxAsalId: String(it.box_id || '')
                                            });
                                            setTypeMoveBoxId('');
                                            setTypeMoveTipeId('SAME');
                                            setTypeMoveNote('');
                                          }}
                                          className="p-1 text-slate-500 hover:text-emerald-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                          title={`Pindah ${it.kode_id} ke Box / Tipe lain`}
                                          aria-label={`Pindah Item ${it.kode_id}`}
                                        >
                                          <ArrowRightLeft className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {canManageCatalog && (
                                        <button
                                          type="button"
                                          onClick={() => handleRequestDeleteTypeItem(it)}
                                          className="p-1 text-rose-500 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded transition-colors"
                                          title={`Hapus Item ${it.kode_id}`}
                                          aria-label={`Hapus Item ${it.kode_id}`}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })() : (
                  (!typeItemsData.stokJumlah || typeItemsData.stokJumlah.length === 0) && (
                    <div className="py-8 text-center text-slate-500">
                      <span>Belum ada barang fisik atau stok jumlah yang aktif untuk tipe ini.</span>
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

      {/* Modal Ubah Kategori */}
      {editingJenis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Pencil className="w-4 h-4 text-emerald-500" />
                <span>Ubah Kategori</span>
              </h3>
              <button type="button" onClick={() => setEditingJenis(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateJenis} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Kategori *
                </label>
                <input
                  type="text"
                  required
                  value={editJenisNama}
                  onChange={(e) => setEditJenisNama(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sumber ID Bawaan
                </label>
                <select
                  value={editJenisSumberId}
                  onChange={(e) => setEditJenisSumberId(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  <option value="scan_sn">scan_sn (Barcode / Serial Number Pabrik)</option>
                  <option value="otomatis">otomatis (Generate Nomor Seri Sistem &amp; QR)</option>
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
                  value={editJenisPrefix}
                  onChange={(e) => setEditJenisPrefix(e.target.value)}
                  placeholder="Misal: ADP"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingJenis(null)}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingJenis}
                  className="px-4 py-2 font-bold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg shadow-xs disabled:opacity-50"
                >
                  {savingJenis ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pindah Produk Tunggal ke Kategori Lain */}
      {movingProductTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-emerald-500" />
                  <span>Pindah Produk ke Kategori Lain</span>
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Produk: <strong>{movingProductTarget.nama}</strong> ({movingProductTarget.jenis_nama})
                </span>
              </div>
              <button type="button" onClick={() => setMovingProductTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteMoveSingleProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kategori Tujuan *
                </label>
                <select
                  required
                  value={moveProdTargetJenisId}
                  onChange={(e) => setMoveProdTargetJenisId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  <option value="">-- Pilih Kategori Tujuan --</option>
                  {jenisList
                    .filter((j) => j.id !== movingProductTarget.jenis_id)
                    .map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.nama} ({j.total_produk || 0} produk)
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setMovingProductTarget(null)}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={movingProdSubmitting || !moveProdTargetJenisId}
                  className="px-4 py-2 font-bold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg shadow-xs disabled:opacity-50"
                >
                  {movingProdSubmitting ? 'Memindahkan...' : 'Pindahkan Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pindah Varian Tipe ke Produk Lain */}
      {movingTipeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-emerald-500" />
                  <span>Pindah Varian Tipe ke Produk Lain</span>
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Tipe: <strong>{movingTipeTarget.tipe.nama_tipe}</strong> (dari {movingTipeTarget.sourceProd.nama})
                </span>
              </div>
              <button type="button" onClick={() => setMovingTipeTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteMoveSingleType} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Produk Tujuan *
                </label>
                <select
                  required
                  value={moveTipeTargetProdId}
                  onChange={(e) => setMoveTipeTargetProdId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  <option value="">-- Pilih Produk Tujuan --</option>
                  {products
                    .filter((p) => p.id !== movingTipeTarget.sourceProd.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nama} ({p.jenis_nama})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setMovingTipeTarget(null)}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={movingTipeSubmitting || !moveTipeTargetProdId}
                  className="px-4 py-2 font-bold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg shadow-xs disabled:opacity-50"
                >
                  {movingTipeSubmitting ? 'Memindahkan...' : 'Pindahkan Varian Tipe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pilihan Hapus Kategori (Saat Masih Ada Produk Aktif) */}
      {categoryDeleteChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <span>Hapus Kategori "{categoryDeleteChoice.category.nama}"</span>
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Masih terdapat {categoryDeleteChoice.activeProducts.length} produk aktif di kategori ini.
                </span>
              </div>
              <button type="button" onClick={() => setCategoryDeleteChoice(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCategoryDeleteChoice} className="space-y-3.5 text-xs">
              <div className="space-y-2">
                {jenisList.some((j) => j.id !== categoryDeleteChoice.category.id) && (
                  <label className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer ${
                    catDeleteMode === 'move_products'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="catDeleteMode"
                      checked={catDeleteMode === 'move_products'}
                      onChange={() => setCatDeleteMode('move_products')}
                      className="mt-0.5"
                    />
                    <div className="flex-1 space-y-2">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">
                          Pindahkan semua produk ke kategori lain, lalu hapus kategori ini
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Aman meskipun produk memiliki stok aktif atau riwayat mutasi.
                        </span>
                      </div>
                      {catDeleteMode === 'move_products' && (
                        <select
                          value={catDeleteMoveTargetId}
                          onChange={(e) => setCatDeleteMoveTargetId(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                        >
                          {jenisList
                            .filter((j) => j.id !== categoryDeleteChoice.category.id)
                            .map((j) => (
                              <option key={j.id} value={j.id}>
                                {j.nama}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  </label>
                )}

                <label className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer ${
                  catDeleteMode === 'cascade'
                    ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                    : 'border-slate-200 dark:border-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="catDeleteMode"
                    checked={catDeleteMode === 'cascade'}
                    onChange={() => setCatDeleteMode('cascade')}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-rose-800 dark:text-rose-300 block">
                      Hapus kategori beserta seluruh produk &amp; variannya (Cascade)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Hanya diizinkan jika seluruh produk di dalamnya sudah ber-stok 0 (tidak ada stok aktif/dipesan/rusak).
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCategoryDeleteChoice(null)}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg shadow-xs"
                >
                  Lanjutkan Konfirmasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pengaturan Pola SN Global */}
      <SNPatternSettingsModal
        isOpen={isSNPatternsOpen}
        onClose={() => setIsSNPatternsOpen(false)}
      />

      {/* Modal Konfirmasi Hapus Tier 3 & Blocker Data Aktif */}
      <ConfirmDeleteModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />

      {/* Modal Impor Katalog, Box & Stok Awal (Excel / Google Spreadsheet) */}
      <CatalogImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImported={async () => {
          await Promise.all([loadData(), refreshData()]);
        }}
      />
    </div>
  );
};
