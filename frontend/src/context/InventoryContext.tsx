/**
 * Inventory Context (Modular & Focused Business State)
 * FieldOps IT Inventory Rebuild - Under 250 Lines
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api, InventoryItem, Category, Transaction, StockMutationResponse } from '../services/api';
import { useAuth } from './AuthContext';
import { ToastMessage, ToastType, useToast } from './ToastContext';
import { APP_VERSION } from '../constants/version';
import { getErrorMessage } from '../utils/errorUtils';

export type { ToastMessage };
export type TabType = 'dashboard' | 'catalog' | 'inout' | 'weekly-report' | 'categories' | 'integration';

interface InventoryContextType {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  items: InventoryItem[];
  categories: Category[];
  transactions: Transaction[];
  trashItems: InventoryItem[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  createItem: (item: Partial<InventoryItem>) => Promise<void>;
  updateItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  restoreItem: (id: string) => Promise<void>;
  permanentDeleteItem: (id: string) => Promise<void>;
  createCategory: (code: string, name: string, description?: string) => Promise<void>;
  recordStockIn: (payload: { itemId: string; quantity: number; referenceNumber?: string; sourceOrVendor?: string; notes?: string }) => Promise<StockMutationResponse>;
  recordStockOut: (payload: { itemId: string; quantity: number; referenceNumber?: string; recipientOrDestination?: string; notes?: string }) => Promise<StockMutationResponse>;
  recordBatchStockOut: (payload: { items: Array<{ itemId: string; quantity: number }>; referenceNumber?: string; recipientOrDestination?: string; notes?: string }) => Promise<StockMutationResponse>;
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
  itemMap: Map<string, InventoryItem>;
  categoryMap: Map<string, Category>;
  VERSION: string;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { toasts, showToast, removeToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [trashItems, setTrashItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const VERSION = APP_VERSION;

  // Memuat data dari backend
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allCats, activeIt, deletedIt, allTxs] = await Promise.all([
        api.getCategories(),
        api.getItems(false),
        api.getItems(true).then(its => its.filter(it => it.is_deleted)),
        api.getTransactions(100)
      ]);
      setCategories(allCats);
      setItems(activeIt);
      setTrashItems(deletedIt);
      setTransactions(allTxs);
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Gagal menyinkronkan data dengan server.'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshData();
    }
  }, [isAuthenticated, refreshData]);

  const createItem = async (itemData: Partial<InventoryItem>) => {
    try {
      await api.createItem(itemData);
      showToast('Barang berhasil ditambahkan ke inventori.', 'success');
      await refreshData();
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
      throw err;
    }
  };

  const updateItem = async (id: string, updates: Partial<InventoryItem>) => {
    try {
      await api.updateItem(id, updates);
      showToast('Data barang berhasil diperbarui.', 'success');
      await refreshData();
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
      throw err;
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await api.deleteItem(id);
      showToast('Barang dipindahkan ke kotak sampah.', 'info');
      await refreshData();
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
      throw err;
    }
  };

  const restoreItem = async (id: string) => {
    try {
      await api.restoreItem(id);
      showToast('Barang berhasil dipulihkan dari kotak sampah.', 'success');
      await refreshData();
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
      throw err;
    }
  };

  const permanentDeleteItem = async (id: string) => {
    try {
      await api.permanentDeleteItem(id);
      showToast('Barang telah dihapus permanen dari sistem.', 'info');
      await refreshData();
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
      throw err;
    }
  };

  const createCategory = async (code: string, name: string, description?: string) => {
    try {
      await api.createCategory({ code, name, description });
      showToast('Kategori baru berhasil dibuat.', 'success');
      await refreshData();
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
      throw err;
    }
  };

  const recordStockIn = async (payload: { itemId: string; quantity: number; referenceNumber?: string; sourceOrVendor?: string; notes?: string }) => {
    try {
      const res = await api.stockIn(payload);
      showToast(res.message, 'success');
      await refreshData();
      return res;
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
      throw err;
    }
  };

  const recordStockOut = async (payload: { itemId: string; quantity: number; referenceNumber?: string; recipientOrDestination?: string; notes?: string }) => {
    try {
      const res = await api.stockOut(payload);
      showToast(res.message, res.lowStockAlertTriggered ? 'warning' : 'success');
      await refreshData();
      return res;
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
      throw err;
    }
  };

  const recordBatchStockOut = async (payload: { items: Array<{ itemId: string; quantity: number }>; referenceNumber?: string; recipientOrDestination?: string; notes?: string }) => {
    try {
      const res = await api.batchStockOut(payload);
      showToast(res.message, res.lowStockAlertTriggered ? 'warning' : 'success');
      await refreshData();
      return res;
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
      throw err;
    }
  };

  const itemMap = useMemo(() => new Map(items.map(it => [it.id, it])), [items]);
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  return (
    <InventoryContext.Provider
      value={{
        activeTab,
        setActiveTab,
        items,
        categories,
        transactions,
        trashItems,
        isLoading,
        refreshData,
        createItem,
        updateItem,
        deleteItem,
        restoreItem,
        permanentDeleteItem,
        createCategory,
        recordStockIn,
        recordStockOut,
        recordBatchStockOut,
        toasts,
        showToast,
        removeToast,
        itemMap,
        categoryMap,
        VERSION,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used within an InventoryProvider');
  return ctx;
};
