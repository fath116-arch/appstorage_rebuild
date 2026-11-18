/**
 * Canonical Inventory Context — Single Unified Source of Truth
 * FieldOps IT
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api, ToolBagRecord, TrashEntry } from '../services/api';
import { catalogApi, Jenis, Produk } from '../services/catalogApi';
import { Box, stockApi } from '../services/stockApi';
import { requestApi, RequestRecord } from '../services/requestApi';
import { activityApi, ActorOption, CanonicalTransactionView } from '../services/activityApi';
import { useAuth } from './AuthContext';
import { ToastMessage, ToastType, useToast } from './ToastContext';
import { APP_VERSION } from '../constants/version';
import { getErrorMessage } from '../utils/errorUtils';
import { isAdminOrDev, isWarehouseManager } from '../utils/permissions';

export type { ToastMessage };
export type TabType = 'dashboard' | 'catalog' | 'inout' | 'requests' | 'weekly-report' | 'integration';

interface InventoryContextType {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  products: Produk[];
  jenisList: Jenis[];
  boxes: Box[];
  transactions: CanonicalTransactionView[];
  requests: RequestRecord[];
  heldItems: RequestRecord[];
  actors: ActorOption[];
  trashItems: TrashEntry[];
  bags: ToolBagRecord[];
  lowOrOutCount: number;
  isLoading: boolean;
  refreshData: () => Promise<void>;
  purgeExpiredTrash: () => Promise<void>;
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
  VERSION: string;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const { toasts, showToast, removeToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const [products, setProducts] = useState<Produk[]>([]);
  const [jenisList, setJenisList] = useState<Jenis[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [transactions, setTransactions] = useState<CanonicalTransactionView[]>([]);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [heldItems, setHeldItems] = useState<RequestRecord[]>([]);
  const [actors, setActors] = useState<ActorOption[]>([]);
  const [trashItems, setTrashItems] = useState<TrashEntry[]>([]);
  const [bags, setBags] = useState<ToolBagRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const VERSION = APP_VERSION;

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const canSeeActors = isWarehouseManager(user?.role);
      const canSeeTrash = isAdminOrDev(user?.role);

      const [
        prodsRes,
        jenisRes,
        boxesRes,
        txsRes,
        reqsRes,
        heldRes,
        actorsRes,
        trashRes,
        bagsRes
      ] = await Promise.all([
        catalogApi.listProduk(),
        catalogApi.listJenis(),
        stockApi.listBoxes(),
        activityApi.getTransactions({ limit: 300 }),
        requestApi.list(),
        requestApi.listHeld(),
        canSeeActors ? activityApi.getActors().catch(() => []) : Promise.resolve([]),
        canSeeTrash ? api.getTrash().catch(() => []) : Promise.resolve([]),
        api.listBags().catch(() => [])
      ]);

      setProducts(prodsRes);
      setJenisList(jenisRes);
      setBoxes(boxesRes);
      setTransactions(txsRes);
      setRequests(reqsRes);
      setHeldItems(heldRes);
      setActors(actorsRes);
      setTrashItems(trashRes);
      setBags(bagsRes);
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Gagal menyinkronkan data dengan server.'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, user?.role]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshData();
    } else {
      setProducts([]);
      setJenisList([]);
      setBoxes([]);
      setTransactions([]);
      setRequests([]);
      setHeldItems([]);
      setActors([]);
      setTrashItems([]);
      setBags([]);
    }
  }, [isAuthenticated, refreshData]);

  const purgeExpiredTrash = async () => {
    try {
      const res = await api.purgeTrash();
      showToast(`Pembersihan selesai: ${res.purgedCount} entri kedaluwarsa dihapus permanen.`, 'info');
      await refreshData();
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
      throw err;
    }
  };

  const lowOrOutCount = useMemo(() => {
    let count = 0;
    for (const p of products) {
      const tipes = p.tipes || [];
      if (tipes.length === 0) {
        if (p.status_stok === 'menipis' || p.status_stok === 'habis') count++;
      } else {
        for (const t of tipes) {
          if (t.status_stok === 'menipis' || t.status_stok === 'habis') count++;
        }
      }
    }
    return count;
  }, [products]);

  return (
    <InventoryContext.Provider
      value={{
        activeTab,
        setActiveTab,
        products,
        jenisList,
        boxes,
        transactions,
        requests,
        heldItems,
        actors,
        trashItems,
        bags,
        lowOrOutCount,
        isLoading,
        refreshData,
        purgeExpiredTrash,
        toasts,
        showToast,
        removeToast,
        VERSION
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
