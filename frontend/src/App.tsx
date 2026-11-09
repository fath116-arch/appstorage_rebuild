/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, lazy, Suspense } from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { InventoryCatalog } from './components/InventoryCatalog';
import { TransactionHistory } from './components/TransactionHistory';
import { CategoryManager } from './components/CategoryManager';
import { StockInOutModal } from './components/StockInOutModal';
import { ItemDetailModal } from './components/ItemDetailModal';
import { ItemFormModal } from './components/ItemFormModal';
import { LoginScreen } from './components/LoginScreen';
import { ToastContainer } from './components/ToastContainer';
import { InventoryItem, Transaction } from './types';

// Lazy-loaded heavy modules and infrequent modals for performance & memory efficiency
const WeeklyReport = lazy(() => import('./components/WeeklyReport').then(m => ({ default: m.WeeklyReport })));
const TicketIntegrationHub = lazy(() => import('./components/TicketIntegrationHub').then(m => ({ default: m.TicketIntegrationHub })));
const FieldTripChecklistModal = lazy(() => import('./components/FieldTripChecklistModal').then(m => ({ default: m.FieldTripChecklistModal })));
const PrintDocumentModal = lazy(() => import('./components/PrintDocumentModal').then(m => ({ default: m.PrintDocumentModal })));
const UserRoleSwitcher = lazy(() => import('./components/UserRoleSwitcher').then(m => ({ default: m.UserRoleSwitcher })));
const DownloadModal = lazy(() => import('./components/DownloadModal').then(m => ({ default: m.DownloadModal })));
const GoLiveModal = lazy(() => import('./components/GoLiveModal').then(m => ({ default: m.GoLiveModal })));
const MobileAccessModal = lazy(() => import('./components/MobileAccessModal').then(m => ({ default: m.MobileAccessModal })));
const WhatsAppConfigModal = lazy(() => import('./components/WhatsAppConfigModal').then(m => ({ default: m.WhatsAppConfigModal })));
const SecurityReportModal = lazy(() => import('./components/SecurityReportModal').then(m => ({ default: m.SecurityReportModal })));
const DataRestoreModal = lazy(() => import('./components/DataRestoreModal').then(m => ({ default: m.DataRestoreModal })));
const BatchLabelPrintModal = lazy(() => import('./components/BatchLabelPrintModal').then(m => ({ default: m.BatchLabelPrintModal })));
const SNPatternSettingsModal = lazy(() => import('./components/SNPatternSettingsModal').then(m => ({ default: m.SNPatternSettingsModal })));

const TabLoadingFallback: React.FC = () => (
  <div className="bg-white rounded-xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center space-y-3">
    <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
    <span className="text-xs text-slate-500 font-medium">Memuat modul...</span>
  </div>
);

const AppContent: React.FC = () => {
  const { activeTab, setActiveTab, VERSION } = useInventory();
  const { isAuthenticated, isLoading } = useAuth();

  // Modals state
  const [isStockInOutOpen, setIsStockInOutOpen] = useState(false);
  const [stockInOutMode, setStockInOutMode] = useState<'IN' | 'OUT'>('OUT');
  const [selectedItemForStock, setSelectedItemForStock] = useState<InventoryItem | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [isUserRoleOpen, setIsUserRoleOpen] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [isGoLiveOpen, setIsGoLiveOpen] = useState(false);
  const [isMobileAccessOpen, setIsMobileAccessOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isSecurityReportOpen, setIsSecurityReportOpen] = useState(false);
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [isLabelPrintOpen, setIsLabelPrintOpen] = useState(false);
  const [isSNPatternsOpen, setIsSNPatternsOpen] = useState(false);

  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [printData, setPrintData] = useState<any>(null);

  // Modal open helpers
  const handleOpenStockIn = (item?: InventoryItem) => {
    setStockInOutMode('IN');
    setSelectedItemForStock(item || null);
    setIsStockInOutOpen(true);
  };

  const handleOpenStockOut = (item?: InventoryItem) => {
    setStockInOutMode('OUT');
    setSelectedItemForStock(item || null);
    setIsStockInOutOpen(true);
  };

  const handleOpenDetail = (item: InventoryItem) => {
    setDetailItem(item);
    setIsDetailOpen(true);
  };

  const handleOpenAddItem = () => {
    setEditingItem(null);
    setIsFormOpen(true);
  };

  const handleOpenEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handlePrintTransaction = (tx: Transaction) => {
    setPrintData({
      type: tx.type,
      itemName: tx.itemName,
      itemSku: tx.itemSku,
      quantity: tx.quantity,
      unit: tx.unit,
      referenceNumber: tx.referenceNumber,
      recipientOrDestination: tx.recipientOrDestination,
      performedBy: tx.performedBy,
      notes: tx.notes,
      date: tx.date,
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
        onOpenWhatsApp={() => setIsWhatsAppOpen(true)}
        onOpenSecurityReport={() => setIsSecurityReportOpen(true)}
        onOpenRestore={() => setIsRestoreOpen(true)}
        onOpenLabelPrint={() => setIsLabelPrintOpen(true)}
        onOpenSNPatterns={() => setIsSNPatternsOpen(true)}
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
            onOpenAddItem={handleOpenAddItem}
            onOpenStockIn={(it) => handleOpenStockIn(it)}
            onOpenStockOut={(it) => handleOpenStockOut(it)}
            onOpenDetail={handleOpenDetail}
            onOpenChecklist={() => setIsChecklistOpen(true)}
            onOpenRestore={() => setIsRestoreOpen(true)}
          />
        )}

        {activeTab === 'inout' && (
          <TransactionHistory
            onOpenStockIn={() => handleOpenStockIn()}
            onOpenStockOut={() => handleOpenStockOut()}
            onPrintTransaction={handlePrintTransaction}
          />
        )}

        {activeTab === 'weekly-report' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <WeeklyReport />
          </Suspense>
        )}

        {activeTab === 'categories' && (
          <CategoryManager />
        )}

        {activeTab === 'integration' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <TicketIntegrationHub />
          </Suspense>
        )}
      </main>

      {/* Quiet Glass Footer */}
      <footer className="no-print border-t border-slate-200/60 dark:border-slate-800/80 glass py-4 pb-24 md:pb-6 mt-12 text-xs text-slate-600 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-white dark:bg-slate-100 border border-slate-200 dark:border-slate-300/50 flex items-center justify-center p-0.5 shrink-0">
              <img src="/logo.webp" alt="FieldOps IT" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-slate-900 dark:text-slate-100">FieldOps IT</span>
            <span className="font-medium text-slate-600 dark:text-slate-400">· Inventarisasi Suku Cadang &amp; Auto-Deduct Tiket Lapangan</span>
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
            <span>REST API v1 Ready · Cloud Synced</span>
          </div>
        </div>
      </footer>

      {/* Modals: conditional mounting and lazy loading */}
      <StockInOutModal
        isOpen={isStockInOutOpen}
        onClose={() => setIsStockInOutOpen(false)}
        mode={stockInOutMode}
        initialItem={selectedItemForStock}
        onSuccessPrint={(data) => {
          setPrintData(data);
          setIsPrintOpen(true);
        }}
      />

      <ItemDetailModal
        item={detailItem}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onOpenStockOut={(it) => handleOpenStockOut(it)}
        onOpenStockIn={(it) => handleOpenStockIn(it)}
        onOpenEdit={(it) => handleOpenEditItem(it)}
      />

      <ItemFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        editingItem={editingItem}
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

      {isWhatsAppOpen && (
        <Suspense fallback={null}>
          <WhatsAppConfigModal
            isOpen={isWhatsAppOpen}
            onClose={() => setIsWhatsAppOpen(false)}
          />
        </Suspense>
      )}

      {isSecurityReportOpen && (
        <Suspense fallback={null}>
          <SecurityReportModal
            isOpen={isSecurityReportOpen}
            onClose={() => setIsSecurityReportOpen(false)}
          />
        </Suspense>
      )}

      {isRestoreOpen && (
        <Suspense fallback={null}>
          <DataRestoreModal
            isOpen={isRestoreOpen}
            onClose={() => setIsRestoreOpen(false)}
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

      {isSNPatternsOpen && (
        <Suspense fallback={null}>
          <SNPatternSettingsModal
            isOpen={isSNPatternsOpen}
            onClose={() => setIsSNPatternsOpen(false)}
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
      <AuthProvider>
        <InventoryProvider>
          <AppContent />
        </InventoryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
