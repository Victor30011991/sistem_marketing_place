import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/dm-sans';
import './styles.css';
import App from './App';
import { AppProvider } from './state/store';
import { FeedbackProvider } from './ui/feedback';
import { NuvemProvider } from './nuvem/NuvemProvider';
import { PedidosProvider } from './nuvem/PedidosProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AppProvider>
        <FeedbackProvider>
          <NuvemProvider>
            <PedidosProvider>
              <App />
            </PedidosProvider>
          </NuvemProvider>
        </FeedbackProvider>
      </AppProvider>
    </HashRouter>
  </StrictMode>,
);

// vira aplicativo instalável e abre sem internet (só no site publicado)
if (import.meta.env.PROD && 'serviceWorker' in navigator && !import.meta.env.VITE_NUVEM_FALSA) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
