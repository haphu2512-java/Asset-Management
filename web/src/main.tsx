import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PrefsProvider } from '@shared/prefs';
import { StoreProvider } from '@shared/store';
import { App } from './App';
import { ToastProvider } from './components/Toast';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PrefsProvider>
        <StoreProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </StoreProvider>
      </PrefsProvider>
    </BrowserRouter>
  </StrictMode>,
);
