import { useState } from 'react';
import { valutaGiacenza } from '../engine';
import { formattaIntero } from '../money';
import { dataOra } from '../lib/csv';
import { NOMI_SEDI } from '../seed';
import { useScorte } from '../store';

/** Storico delle rilevazioni, per sede e data, con il dettaglio in sola lettura. */
export default function Storico() {
  const s = useScorte();
  const [aperta, setAperta] = useState<string | null>(null);

  if (s.rilevazioni.length === 0) {
    return (
      <section>
        <h2>Storico rilevazioni</h2>
        <p className="nota">Non è ancora stata fatta nessuna rilevazione.</p>
      </section>
    );
  }

  const dettaglio = s.rilevazioni.find((r) => r.id === aperta);

  return (
    <section>
      <h2>Storico rilevazioni</h2>

      <table className="tabella">
        <thead>
          <tr>
            <th>Sede</th>
            <th>Aperta il</th>
            <th>Stato</th>
            <th className="num">Articoli contati</th>
            <th className="num">Da ordinare</th>
            <th>Chiusa il</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {s.rilevazioni.map((r) => {
            const contati = Object.keys(r.righe).length;
            const ordina = Object.entries(r.righe).filter(([codice, giacenza]) => {
              const par = s.parametri(r.sede, codice);
              const stat = s.statistica(r.sede, codice);
              return par && stat && valutaGiacenza(par, stat, giacenza).stato === 'ORDINA';
            }).length;
            return (
              <tr key={r.id}>
                <td>{NOMI_SEDI[r.sede]}</td>
                <td>{dataOra(r.data)}</td>
                <td>
                  {r.stato === 'bozza' ? <span className="tenue">bozza</span> : <span className="ok">chiusa</span>}
                </td>
                <td className="num">{formattaIntero(contati)}</td>
                <td className="num forte">{formattaIntero(ordina)}</td>
                <td>{r.chiusa_il ? dataOra(r.chiusa_il) : '—'}</td>
                <td className="azioni-riga">
                  <button className="bottone piccolo" onClick={() => setAperta(aperta === r.id ? null : r.id)}>
                    {aperta === r.id ? 'Chiudi' : 'Dettaglio'}
                  </button>
                  <button
                    className="bottone piccolo"
                    onClick={() => {
                      if (confirm('Eliminare questa rilevazione?')) s.eliminaRilevazione(r.id);
                    }}
                  >
                    Elimina
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {dettaglio && (
        <div className="gruppo">
          <h3>
            {NOMI_SEDI[dettaglio.sede]} · {dataOra(dettaglio.data)}
          </h3>
          <div className="tabella-scorrevole">
            <table className="tabella">
              <thead>
                <tr>
                  <th>Codice</th>
                  <th>Articolo</th>
                  <th className="num">Giacenza</th>
                  <th className="num">Riordina a</th>
                  <th>Stato</th>
                  <th className="num">Da ordinare</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(dettaglio.righe).map(([codice, giacenza]) => {
                  const par = s.parametri(dettaglio.sede, codice);
                  const stat = s.statistica(dettaglio.sede, codice);
                  const esito = par && stat ? valutaGiacenza(par, stat, giacenza) : null;
                  return (
                    <tr key={codice}>
                      <td className="codice">{codice}</td>
                      <td>{s.articoli[codice]?.descrizione ?? ''}</td>
                      <td className="num">{formattaIntero(giacenza)}</td>
                      <td className="num">{par ? formattaIntero(par.puntoRiordino) : '—'}</td>
                      <td>
                        {esito?.stato === 'ORDINA' ? <span className="ordina">ORDINA</span> : <span className="ok">ok</span>}
                      </td>
                      <td className="num forte">{esito && esito.daOrdinare > 0 ? formattaIntero(esito.daOrdinare) : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
