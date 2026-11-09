/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { InventoryItem } from '../types/inventory';
import { X, PackagePlus, Save } from 'lucide-react';

interface ItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem?: InventoryItem | null;
}

export const ItemFormModal: React.FC<ItemFormModalProps> = ({
  isOpen,
  onClose,
  editingItem
}) => {
  const { categories, createItem, updateItem } = useInventory();

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [quantityInput, setQuantityInput] = useState<string>('0');
  const [minStockAlertInput, setMinStockAlertInput] = useState<string>('2');
  const [unit, setUnit] = useState('pcs');
  const [location, setLocation] = useState('');
  const [specs, setSpecs] = useState('');
  const [unitCost, setUnitCost] = useState<number>(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name || '');
      setSku(editingItem.sku || '');
      setBarcode(editingItem.barcode || '');
      setCategoryId(editingItem.category_id || editingItem.categoryId || '');
      setQuantityInput(String(editingItem.quantity || 0));
      setMinStockAlertInput(String(editingItem.min_stock_alert ?? editingItem.minStockAlert ?? 2));
      setUnit(editingItem.unit || 'pcs');
      setLocation(editingItem.location || '');
      setSpecs(editingItem.specs || '');
      setUnitCost(editingItem.unit_cost ?? editingItem.unitCost ?? 0);
      setNotes(editingItem.notes || '');
    } else {
      setName('');
      setSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
      setBarcode(`899${Math.floor(1000000 + Math.random() * 9000000)}`);
      setCategoryId(categories[0]?.id || '');
      setQuantityInput('5');
      setMinStockAlertInput('2');
      setUnit('pcs');
      setLocation('Gudang Utama - Rak A-01');
      setSpecs('');
      setUnitCost(50000);
      setNotes('');
    }
  }, [editingItem, categories, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sku.trim()) return;

    const selectedCategory = categories.find(c => c.id === categoryId);

    const payload: any = {
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      barcode: barcode.trim(),
      category_id: categoryId,
      categoryName: selectedCategory ? selectedCategory.name : 'Umum',
      quantity: parseInt(quantityInput, 10) || 0,
      min_stock_alert: parseInt(minStockAlertInput, 10) || 0,
      unit: unit.trim(),
      location: location.trim(),
      specs: specs.trim(),
      unit_cost: Number(unitCost),
      notes: notes.trim(),
    };

    if (editingItem) {
      updateItem(editingItem.id, payload);
    } else {
      createItem(payload);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center">
              <PackagePlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {editingItem ? 'Edit Suku Cadang / Barang' : 'Tambah Suku Cadang Baru'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lengkapi informasi barang dan batas alert minimum stok
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
          {/* Item Name */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nama Lengkap Barang / Suku Cadang <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Kabel Belden UTP Cat6 Original 305M"
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
            />
          </div>

          {/* SKU, Barcode, Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Kode SKU <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                placeholder="CAB-UTP-01"
                className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nomor Barcode Scanner
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="899..."
                className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Kategori <span className="text-red-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quantity, Unit, Min Stock Alert */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Stok Fisik {editingItem ? 'Sekarang' : 'Awal'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={quantityInput}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setQuantityInput(e.target.value.replace(/\D/g, ''))}
                onBlur={() => { if (!quantityInput) setQuantityInput('0'); }}
                className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Satuan Ukuran <span className="text-red-500">*</span>
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
              >
                <option value="pcs">pcs</option>
                <option value="unit">unit</option>
                <option value="roll">roll</option>
                <option value="box">box</option>
                <option value="meter">meter</option>
                <option value="pack">pack</option>
                <option value="set">set</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Batas Minimum Alert <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={minStockAlertInput}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setMinStockAlertInput(e.target.value.replace(/\D/g, ''))}
                onBlur={() => { if (!minStockAlertInput) setMinStockAlertInput('2'); }}
                className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
              />
            </div>
          </div>

          {/* Location and Specs */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Lokasi Fisik Rak / Bin / Mobil Teknisi <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Contoh: Gudang Utama - Rak A-02 / Bin 3"
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Spesifikasi Teknis
            </label>
            <textarea
              rows={2}
              value={specs}
              onChange={(e) => setSpecs(e.target.value)}
              placeholder="Contoh: 24 AWG Solid Pure Copper, Gigabit Ethernet CMR, Warna Abu-abu..."
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Catatan Penggunaan Lapangan
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan untuk teknisi atau admin pengadaan..."
              className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-700 rounded-lg font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-slate-900 hover:bg-slate-800 rounded-lg font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>{editingItem ? 'Simpan Perubahan' : 'Tambahkan ke Inventori'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
