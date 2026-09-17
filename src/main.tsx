import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ProviderAccesso } from './lib/auth';
import { ProviderScorte } from './store';
import './tema.css';
import './base.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <ProviderAccesso>
        <ProviderScorte>
          <App />
        </ProviderScorte>
      </ProviderAccesso>
    </HashRouter>
  </React.StrictMode>,
);
