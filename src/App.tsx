import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Prontuario from './pages/Prontuario';
import Rilevazione from './pages/Rilevazione';
import OrdineDelGiorno from './pages/OrdineDelGiorno';
import ModuloRilevazione from './pages/ModuloRilevazione';
import Tempi from './pages/Tempi';
import Articoli from './pages/Articoli';
import Sorvegliati from './pages/Sorvegliati';
import Variazioni from './pages/Variazioni';
import Sintesi from './pages/Sintesi';
import Storico from './pages/Storico';
import Aiuto from './pages/Aiuto';
import Conta from './pages/Conta';
import { useTema } from './lib/tema';
import { NOMI_SEDI, SEDI, seed } from './seed';
import { useScorte } from './store';

export default function App() {
  const s = useScorte();
  const [tema, cambiaTema] = useTema();
  const posizione = useLocation();

  // Il conteggio a magazzino si apre a tutto schermo, senza menu: chi conta
  // tiene il telefono in mano e deve vedere solo l'articolo.
  if (posizione.pathname === '/conta') return <Conta />;

  return (
    <div className="app">
      <header className="intestazione schermo">
        <div>
          <h1>Scorte</h1>
          <p className="sottotitolo">Il Magazzino Edile — consumi {seed.meta.periodo_consumi}</p>
        </div>

        <div className="comandi-intestazione">
          <div className="scelta-sede">
            {SEDI.map((sede) => (
              <button
                key={sede}
                className={`bottone ${s.sede === sede ? 'principale' : ''}`}
                onClick={() => s.cambiaSede(sede)}
              >
                {NOMI_SEDI[sede]}
              </button>
            ))}
          </div>
          <button
            className="bottone"
            onClick={cambiaTema}
            title={tema === 'scuro' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
            aria-label={tema === 'scuro' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
          >
            {tema === 'scuro' ? '☀ Chiaro' : '☾ Scuro'}
          </button>
        </div>
      </header>

      <nav className="schermo">
        <span className="gruppo-nav">Sede</span>
        <NavLink to="/rilevazione">Rilevazione</NavLink>
        <NavLink to="/modulo">Modulo da stampare</NavLink>
        <NavLink to="/ordine">Ordine del giorno</NavLink>
        <NavLink to="/prontuario">Prontuario</NavLink>
        <span className="gruppo-nav">Parametri</span>
        <NavLink to="/tempi">Tempi di consegna</NavLink>
        <NavLink to="/articoli">Articoli e lotti</NavLink>
        <NavLink to="/sorvegliati">Elenco sorvegliato</NavLink>
        <span className="gruppo-nav">Controllo</span>
        <NavLink to="/variazioni">Variazioni</NavLink>
        <NavLink to="/sintesi">Sintesi</NavLink>
        <NavLink to="/storico">Storico</NavLink>
        <NavLink to="/aiuto">Come si calcola</NavLink>
      </nav>

      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/rilevazione" replace />} />
          <Route path="/rilevazione" element={<Rilevazione />} />
          <Route path="/conta" element={<Conta />} />
          <Route path="/modulo" element={<ModuloRilevazione />} />
          <Route path="/ordine" element={<OrdineDelGiorno />} />
          <Route path="/prontuario" element={<Prontuario />} />
          <Route path="/tempi" element={<Tempi />} />
          <Route path="/articoli" element={<Articoli />} />
          <Route path="/sorvegliati" element={<Sorvegliati />} />
          <Route path="/variazioni" element={<Variazioni />} />
          <Route path="/sintesi" element={<Sintesi />} />
          <Route path="/storico" element={<Storico />} />
          <Route path="/aiuto" element={<Aiuto />} />
          <Route path="*" element={<Navigate to="/rilevazione" replace />} />
        </Routes>
      </main>

      <footer className="pie schermo">
        I dati stanno per ora in questo browser. Accessi e archivio condiviso arrivano con Firebase, nella fase
        successiva.
      </footer>
    </div>
  );
}
