import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Regista o service worker (necessário para o "Instalar app" funcionar e
// para a app abrir mais depressa). Só corre em produção/https, nunca falha
// o carregamento da app se o browser não suportar.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Falha ao registar o service worker:', err);
    });
  });
}
