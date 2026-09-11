import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ProviderScorte } from './store';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <ProviderScorte>
        <App />
      </ProviderScorte>
    </HashRouter>
  </React.StrictMode>,
);
