/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, lazy, Suspense } from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { InventoryCatalog } from './components/InventoryCatalog';
import { TransactionHistory } from './components/TransactionHistory';
import { StockInOutModal } from './components/StockInOutModal';
import { StockInputModal } from './components/stock/StockInputModal';
import { TechnicianRequestsView } from './components/requests/TechnicianRequestsView';
import { LoginScreen } from './components/LoginScreen';
import { ToastContainer } from './components/ToastContainer';
import type { PrintDocumentData } from './components/PrintDocumentModal';
import type { CanonicalTransactionView } from './services/activityApi';

const WeeklyReport = lazy(() => import('./components/WeeklyReport').then(m => ({ default: m.WeeklyReport })));
const SettingsHub = lazy(() => import('./components/SettingsHub').then(m => ({ default: m.SettingsHub })));
const FieldTripChecklistModal = lazy(() => import('./components/FieldTripChecklistModal').then(m => ({ default: m.FieldTripChecklistModal })));
const PrintDocumentModal = lazy(() => import('./components/PrintDocumentModal').then(m => ({ default: m.PrintDocumentModal })));
const UserRoleSwitcher = lazy(() => import('./components/UserRoleSwitcher').then(m => ({ default: m.UserRoleSwitcher })));
const DownloadModal = lazy(() => import('./components/DownloadModal').then(m => ({ default: m.DownloadModal })));
const GoLiveModal = lazy(() => import('./components/GoLiveModal').then(m => ({ default: m.GoLiveModal })));
const MobileAccessModal = lazy(() => import('./components/MobileAccessModal').then(m => ({ default: m.MobileAccessModal })));
const BatchLabelPrintModal = lazy(() => import('./components/BatchLabelPrintModal').then(m => ({ default: m.BatchLabelPrintModal })));

const TabLoadingFallback: React.FC = () => (
  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center flex flex-col items-center justify-center space-y-3">
    <div className="w-8 h-8 border-2 border-slate-200 dark:border-slate-700 border-t-emerald-500 rounded-full animate-spin" />
    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Memuat modul...</span>
  </div>
);

const AppContent: React.FC = () => {
  const { activeTab, setActiveTab, openSettingsSection, refreshData, VERSION } = useInventory();
  const { isAuthenticated, isLoading } = useAuth();

  const [isStockInputOpen, setIsStockInputOpen] = useState(false);
  const [isStockOutOpen, setIsStockOutOpen] = useState(false);
  const [selectedItemForStockOut, setSelectedItemForStockOut] = useState<{ kode_id?: string; tipe_id?: number } | null>(null);

  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [isUserRoleOpen, setIsUserRoleOpen] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [isGoLiveOpen, setIsGoLiveOpen] = useState(false);
  const [isMobileAccessOpen, setIsMobileAccessOpen] = useState(false);
  const [isLabelPrintOpen, setIsLabelPrintOpen] = useState(false);

  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [printData, setPrintData] = useState<PrintDocumentData | null>(null);

  const handleOpenStockIn = () => {
    setIsStockInputOpen(true);
  };

  const handleOpenStockOut = (item?: { kode_id?: string; tipe_id?: number }) => {
    setSelectedItemForStockOut(item || null);
    setIsStockOutOpen(true);
  };

  const handlePrintTransaction = (tx: CanonicalTransactionView) => {
    setPrintData({
      type: tx.type === 'OUT' ? 'OUT' : 'IN',
      itemName: tx.item_name || '-',
      itemSku: tx.item_sku || '-',
      quantity: tx.quantity,
      unit: tx.item_unit || 'unit',
      referenceNumber: tx.reference_number || tx.id_aktivitas,
      recipientOrDestination: tx.recipient_destination || '-',
      performedBy: tx.is_on_behalf
        ? `${tx.actor_nama} (dicatat ${tx.recorded_by_nama})`
        : tx.actor_nama || tx.performed_by || '-',
      notes: tx.notes || '',
      date: tx.occurred_at || tx.waktu || new Date().toISOString(),
    });
    setIsPrintOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-2 border-slate-300 dark:border-slate-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginScreen />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Navbar
        onOpenChecklist={() => setIsChecklistOpen(true)}
        onOpenUserModal={() => setIsUserRoleOpen(true)}
        onOpenDownload={() => setIsDownloadOpen(true)}
        onOpenGoLive={() => setIsGoLiveOpen(true)}
        onOpenMobileAccess={() => setIsMobileAccessOpen(true)}
        onOpenLabelPrint={() => setIsLabelPrintOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20 md:pb-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            onOpenStockIn={() => handleOpenStockIn()}
            onOpenStockOut={() => handleOpenStockOut()}
            onOpenChecklist={() => setIsChecklistOpen(true)}
          />
        )}

        {activeTab === 'catalog' && (
          <InventoryCatalog
            onOpenStockIn={() => handleOpenStockIn()}
            onOpenStockOut={(it) => handleOpenStockOut(it)}
            onOpenChecklist={() => setIsChecklistOpen(true)}
            onOpenRestore={() => openSettingsSection('database')}
          />
        )}

        {activeTab === 'inout' && (
          <TransactionHistory
            onOpenStockIn={() => handleOpenStockIn()}
            onOpenStockOut={() => handleOpenStockOut()}
            onPrintTransaction={handlePrintTransaction}
          />
        )}

        {activeTab === 'requests' && <TechnicianRequestsView />}

        {activeTab === 'weekly-report' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <WeeklyReport />
          </Suspense>
        )}

        {activeTab === 'settings' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <SettingsHub />
          </Suspense>
        )}
      </main>

      <footer className="no-print border-t border-slate-200/60 dark:border-slate-800/80 glass py-4 pb-24 md:pb-6 mt-12 text-xs text-slate-600 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-white dark:bg-slate-100 border border-slate-200 dark:border-slate-300/50 flex items-center justify-center p-0.5 shrink-0">
              <img src="/logo.webp" alt="FieldOps IT" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-slate-900 dark:text-slate-100">FieldOps IT</span>
            <span className="font-medium text-slate-600 dark:text-slate-400">· Inventarisasi Data Barang &amp; Auto-Deduct Tiket Lapangan</span>
            <span className="font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-md">
              v{VERSION}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            <button
              onClick={() => setIsDownloadOpen(true)}
              className="text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 underline font-sans font-medium"
            >
              Download Source Code (.ZIP)
            </button>
            <span>·</span>
            <span>MariaDB Single Ledger · WIB (Asia/Jakarta)</span>
          </div>
        </div>
      </footer>

      <StockInputModal
        isOpen={isStockInputOpen}
        onClose={() => setIsStockInputOpen(false)}
        onSuccess={() => refreshData()}
      />

      <StockInOutModal
        isOpen={isStockOutOpen}
        onClose={() => setIsStockOutOpen(false)}
        initialItem={selectedItemForStockOut}
        onSuccessPrint={(data) => {
          setPrintData(data);
          setIsPrintOpen(true);
        }}
      />

      {isChecklistOpen && (
        <Suspense fallback={null}>
          <FieldTripChecklistModal
            isOpen={isChecklistOpen}
            onClose={() => setIsChecklistOpen(false)}
          />
        </Suspense>
      )}

      {isUserRoleOpen && (
        <Suspense fallback={null}>
          <UserRoleSwitcher
            isOpen={isUserRoleOpen}
            onClose={() => setIsUserRoleOpen(false)}
          />
        </Suspense>
      )}

      {isPrintOpen && (
        <Suspense fallback={null}>
          <PrintDocumentModal
            isOpen={isPrintOpen}
            onClose={() => setIsPrintOpen(false)}
            data={printData}
          />
        </Suspense>
      )}

      {isDownloadOpen && (
        <Suspense fallback={null}>
          <DownloadModal
            isOpen={isDownloadOpen}
            onClose={() => setIsDownloadOpen(false)}
          />
        </Suspense>
      )}

      {isGoLiveOpen && (
        <Suspense fallback={null}>
          <GoLiveModal
            isOpen={isGoLiveOpen}
            onClose={() => setIsGoLiveOpen(false)}
            onNavigateTab={(tab) => {
              setIsGoLiveOpen(false);
              setActiveTab(tab);
            }}
          />
        </Suspense>
      )}

      {isMobileAccessOpen && (
        <Suspense fallback={null}>
          <MobileAccessModal
            isOpen={isMobileAccessOpen}
            onClose={() => setIsMobileAccessOpen(false)}
          />
        </Suspense>
      )}

      {isLabelPrintOpen && (
        <Suspense fallback={null}>
          <BatchLabelPrintModal
            isOpen={isLabelPrintOpen}
            onClose={() => setIsLabelPrintOpen(false)}
          />
        </Suspense>
      )}

      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <InventoryProvider>
            <AppContent />
          </InventoryProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
