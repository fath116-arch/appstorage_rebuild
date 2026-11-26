import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker with auto-update and offline caching support
registerSW({
  immediate: true,
   onRegisteredSW(_url, reg) {
    if (!reg) return;
    setInterval(() => reg.update(), 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update();
    });
  },
  onOfflineReady() {
    console.log('FieldOps IT: App is ready for offline operation.');
  },
});

createRoot(document.getElementById('root')!).render(<App />);
