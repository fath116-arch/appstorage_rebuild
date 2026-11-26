/**
 * Silent Safe App Auto-Updater
 * Memastikan browser otomatis berpindah ke build production terbaru secara senyap
 * saat halaman dibuka atau ketika tidak ada modal / input formulir aktif.
 */

import { registerSW } from 'virtual:pwa-register';

const RELOAD_GUARD_KEY = 'fieldops_auto_reload_guard';
const RELOAD_COOLDOWN_MS = 30_000;
const INITIAL_OPEN_GRACE_MS = 8_000;
const HEALTH_POLL_INTERVAL_MS = 5 * 60 * 1000;

let initialized = false;
let pendingReloadBuildId: string | null = null;
let reloadInProgress = false;
let safetyWatchTimer: number | null = null;
const bootTimestamp = Date.now();

function getClientBuildId(): string {
  try {
    return typeof __APP_BUILD_ID__ === 'string' && __APP_BUILD_ID__ ? __APP_BUILD_ID__ : 'dev';
  } catch {
    return 'dev';
  }
}

function wasRecentlyReloaded(targetKey: string): boolean {
  try {
    const raw = sessionStorage.getItem(RELOAD_GUARD_KEY);
    if (!raw) return false;
    const [prevKey, tsStr] = raw.split('@');
    const prevTs = Number(tsStr || 0);
    if (prevKey === targetKey && Date.now() - prevTs < RELOAD_COOLDOWN_MS) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function markReloaded(targetKey: string): void {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, `${targetKey}@${Date.now()}`);
  } catch {
    // Abaikan jika sessionStorage diblokir
  }
}

function isSafeToReloadNow(): boolean {
  if (typeof document === 'undefined') return false;

  // Selama fase awal buka halaman, langsung izinkan reload agar user tidak melihat versi lama
  const isInitialBootWindow = Date.now() - bootTimestamp <= INITIAL_OPEN_GRACE_MS;

  // Cek apakah ada modal / dialog aktif (z-50 atau role=dialog / aria-modal=true)
  const activeModal = document.querySelector('[role="dialog"], [aria-modal="true"], .fixed.inset-0.z-50');
  if (activeModal) {
    return false;
  }

  if (isInitialBootWindow) {
    return true;
  }

  // Jangan mengganggu jika user sedang mengetik atau fokus di input/textarea/select
  const activeEl = document.activeElement as HTMLElement | null;
  if (activeEl) {
    const tag = activeEl.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || activeEl.isContentEditable) {
      return false;
    }
  }

  return true;
}

async function clearStaleCachesAndReload(reasonKey: string): Promise<void> {
  if (reloadInProgress) return;
  if (wasRecentlyReloaded(reasonKey)) return;

  reloadInProgress = true;
  markReloaded(reasonKey);

  try {
    if (typeof caches !== 'undefined') {
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys
          .filter((name) => !name.includes('fonts-cache'))
          .map((name) => caches.delete(name).catch(() => false))
      );
    }
  } catch {
    // Abaikan galat pembersihan cache
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update().catch(() => {});
      }
    }
  } catch {
    // Abaikan galat update SW
  }

  window.location.reload();
}

function scheduleSafeSilentReload(reasonKey: string): void {
  pendingReloadBuildId = reasonKey;

  if (isSafeToReloadNow()) {
    void clearStaleCachesAndReload(reasonKey);
    return;
  }

  if (safetyWatchTimer !== null) return;
  safetyWatchTimer = window.setInterval(() => {
    if (!pendingReloadBuildId) {
      if (safetyWatchTimer !== null) {
        window.clearInterval(safetyWatchTimer);
        safetyWatchTimer = null;
      }
      return;
    }
    if (isSafeToReloadNow()) {
      const keyToUse = pendingReloadBuildId;
      pendingReloadBuildId = null;
      if (safetyWatchTimer !== null) {
        window.clearInterval(safetyWatchTimer);
        safetyWatchTimer = null;
      }
      void clearStaleCachesAndReload(keyToUse);
    }
  }, 2000);
}

async function checkServerBuildVersion(): Promise<void> {
  if (!import.meta.env.PROD) return;
  const clientBuildId = getClientBuildId();
  if (!clientBuildId || clientBuildId === 'dev') return;

  try {
    const res = await fetch(`/api/health?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { buildId?: string };
    const serverBuildId = typeof data?.buildId === 'string' ? data.buildId.trim() : '';
    if (serverBuildId && serverBuildId !== 'dev' && serverBuildId !== clientBuildId) {
      scheduleSafeSilentReload(`build:${serverBuildId}`);
    }
  } catch {
    // Abaikan saat offline / server sedang restart
  }
}

export function initAppAutoUpdater(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  let swUpdateHandle: ((reloadPage?: boolean) => Promise<void>) | null = null;
  let initialController = 'serviceWorker' in navigator ? navigator.serviceWorker.controller : null;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!import.meta.env.PROD) return;
      // Hanya muat ulang bila sebelumnya sudah ada controller lama atau build baru mengambil alih
      if (initialController) {
        scheduleSafeSilentReload(`sw:${Date.now()}`);
      }
      initialController = navigator.serviceWorker.controller;
    });
  }

  swUpdateHandle = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (!import.meta.env.PROD) return;
      if (swUpdateHandle) {
        void swUpdateHandle(false).catch(() => {});
      }
      scheduleSafeSilentReload(`need-refresh:${getClientBuildId()}`);
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const runChecks = () => {
        void reg.update().catch(() => {});
        void checkServerBuildVersion();
      };

      window.setInterval(runChecks, HEALTH_POLL_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          runChecks();
        }
      });
      window.addEventListener('focus', () => {
        runChecks();
      });
    },
    onOfflineReady() {
      console.log('FieldOps IT: App is ready for offline operation.');
    },
  });

  // Cek langsung saat halaman pertama kali dibuka
  void checkServerBuildVersion();
}
