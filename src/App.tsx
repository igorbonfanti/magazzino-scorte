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
import Accesso from './pages/Accesso';
import Importa from './pages/Importa';
import Utenti from './pages/Utenti';
import { useTema } from './lib/tema';
import { useAccesso } from './lib/auth';
import { NOMI_SEDI, SEDI, seed } from './seed';
import { useScorte } from './store';
import type { Sede } from './types';

export default function App() {
  const { utente, profilo, caricamento, logout } = useAccesso();
  const s = useScorte();
  const [tema, cambiaTema] = useTema();
  const posizione = useLocation();

  if (caricamento) return <Attesa messaggio="Un attimo…" />;
  if (!utente) return <Accesso />;

  const admin = profilo?.ruolo === 'admin';

  // archivio vuoto: prima di ogni altra cosa i dati vanno caricati
  if (s.daImportare) {
    return (
      <div className="app">
        <Intestazione nome={profilo?.nome} ruolo={profilo?.ruolo} tema={tema} cambiaTema={cambiaTema} logout={logout} />
        <main>
          {admin ? (
            <Importa />
          ) : (
            <section className="testo">
              <h2>Archivio vuoto</h2>
              <p>I dati del magazzino non sono ancora stati caricati. Deve farlo l&rsquo;amministratore.</p>
            </section>
          )}
        </main>
      </div>
    );
  }

  if (!s.pronto) {
    return <Attesa messaggio={s.errore ? `Errore: ${s.errore}` : 'Carico i dati del magazzino…'} />;
  }

  // Il magazziniere fa solo la conta: nessun menu, nessuna altra pagina.
  // Qualunque indirizzo digiti, finisce sul conteggio.
  if (!admin) return <Conta />;

  // anche per l'amministratore il conteggio si apre a tutto schermo
  if (posizione.pathname === '/conta') return <Conta />;

  return (
    <div className="app">
      <Intestazione
        nome={profilo?.nome}
        ruolo={profilo?.ruolo}
        tema={tema}
        cambiaTema={cambiaTema}
        logout={logout}
        sede={s.sede}
        cambiaSede={s.puoCambiareSede ? s.cambiaSede : undefined}
      />

      <nav className="ag-nav">
        <span className="ag-nav-gruppo">Sede</span>
        <NavLink to="/rilevazione">Rilevazione</NavLink>
        <NavLink to="/conta">Conta dal telefono</NavLink>
        <NavLink to="/modulo">Modulo da stampare</NavLink>
        <NavLink to="/ordine">Ordine del giorno</NavLink>
        <NavLink to="/prontuario">Prontuario</NavLink>
        {admin && (
          <>
            <span className="ag-nav-gruppo">Parametri</span>
            <NavLink to="/tempi">Tempi di consegna</NavLink>
            <NavLink to="/articoli">Articoli e lotti</NavLink>
            <NavLink to="/sorvegliati">Elenco sorvegliato</NavLink>
            <span className="ag-nav-gruppo">Controllo</span>
            <NavLink to="/variazioni">Variazioni</NavLink>
            <NavLink to="/sintesi">Sintesi</NavLink>
            <NavLink to="/utenti">Utenti</NavLink>
            <NavLink to="/importa">Importa dati</NavLink>
          </>
        )}
        <span className="ag-nav-gruppo">Altro</span>
        <NavLink to="/storico">Storico</NavLink>
        <NavLink to="/aiuto">Come si calcola</NavLink>
      </nav>

      {s.errore && <p className="avviso-errore schermo">Problema con Firestore: {s.errore}</p>}

      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/rilevazione" replace />} />
          <Route path="/rilevazione" element={<Rilevazione />} />
          <Route path="/modulo" element={<ModuloRilevazione />} />
          <Route path="/ordine" element={<OrdineDelGiorno />} />
          <Route path="/prontuario" element={<Prontuario />} />
          <Route path="/storico" element={<Storico />} />
          <Route path="/aiuto" element={<Aiuto />} />
          {admin && (
            <>
              <Route path="/tempi" element={<Tempi />} />
              <Route path="/articoli" element={<Articoli />} />
              <Route path="/sorvegliati" element={<Sorvegliati />} />
              <Route path="/variazioni" element={<Variazioni />} />
              <Route path="/sintesi" element={<Sintesi />} />
              <Route path="/utenti" element={<Utenti />} />
              <Route path="/importa" element={<Importa />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/rilevazione" replace />} />
        </Routes>
      </main>

      <footer className="pie schermo">
        Consumi {seed.meta.periodo_consumi} · dati condivisi fra le due sedi su Firestore
      </footer>
    </div>
  );
}

function Intestazione({
  nome,
  ruolo,
  tema,
  cambiaTema,
  logout,
  sede,
  cambiaSede,
}: {
  nome?: string;
  ruolo?: string;
  tema: string;
  cambiaTema: () => void;
  logout: () => Promise<void>;
  sede?: Sede;
  cambiaSede?: (s: Sede) => void;
}) {
  return (
    <header className="ag-header">
      <div className="ag-logo">ME</div>
      <div className="ag-titolo">
        <h1>Il Magazzino Edile</h1>
        <span className="ag-modulo">Scorte</span>
        <p className="ag-sottotitolo">
          {nome}
          {ruolo === 'admin' ? ' · amministratore' : ''}
        </p>
      </div>

      <div className="ag-azioni">
        {sede && cambiaSede && (
          <div className="scelta-sede">
            {SEDI.map((quale) => (
              <button
                key={quale}
                className={`bottone ${sede === quale ? 'principale' : ''}`}
                onClick={() => cambiaSede(quale)}
              >
                {NOMI_SEDI[quale]}
              </button>
            ))}
          </div>
        )}
        {sede && !cambiaSede && <span className="bottone principale">{NOMI_SEDI[sede]}</span>}
        <button className="bottone" onClick={cambiaTema} title="Cambia tema">
          {tema === 'scuro' ? '☀' : '☾'}
        </button>
        <button className="bottone" onClick={() => void logout()}>
          Esci
        </button>
      </div>
    </header>
  );
}

function Attesa({ messaggio }: { messaggio: string }) {
  return (
    <div className="attesa">
      <p>{messaggio}</p>
    </div>
  );
}
