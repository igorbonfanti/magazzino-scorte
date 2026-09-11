import { useMemo, useState } from 'react';
import { formattaIntero } from '../money';
import { NOMI_SEDI, seed } from '../seed';
import { useScorte } from '../store';

/**
 * Elenco degli articoli sorvegliati: è unico per le due sedi ed è l'ordine
 * con cui escono prontuario e rilevazione. Ogni aggiunta mostra i numeri
 * di entrambe le sedi.
 */
export default function Sorvegliati() {
  const s = useScorte();
  const [cerca, setCerca] = useState('');

  const candidati = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    if (q.length < 2) return [];
    return Object.values(s.articoli)
      .filter((a) => !s.sorvegliati.includes(a.codice))
      .filter((a) => a.codice.toLowerCase().includes(q) || a.descrizione.toLowerCase().includes(q))
      .slice(0, 12);
  }, [cerca, s.articoli, s.sorvegliati]);

  const inPiu = s.sorvegliati.filter((c) => !seed.elenco_sorvegliato.includes(c));
  const tolti = seed.elenco_sorvegliato.filter((c) => !s.sorvegliati.includes(c));

  return (
    <section>
      <h2>Elenco sorvegliato</h2>
      <p className="nota">
        {formattaIntero(s.sorvegliati.length)} articoli, uguali per le due sedi, nell&rsquo;ordine di stampa.
        {inPiu.length > 0 && ` ${inPiu.length} aggiunti.`}
        {tolti.length > 0 && ` ${tolti.length} tolti.`}
      </p>

      <div className="filtri">
        <input
          className="ricerca"
          type="search"
          placeholder="Aggiungi un articolo: cerca per codice o descrizione"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
        />
      </div>

      {candidati.length > 0 && (
        <div className="tabella-scorrevole candidati">
          <table className="tabella">
            <thead>
              <tr>
                <th>Codice</th>
                <th>Articolo</th>
                <th className="num">Ferraris: riordino / lotto</th>
                <th className="num">Spezia: riordino / lotto</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {candidati.map((a) => {
                const f = s.parametri('ferraris', a.codice);
                const p = s.parametri('spezia', a.codice);
                return (
                  <tr key={a.codice}>
                    <td className="codice">{a.codice}</td>
                    <td>{a.descrizione}</td>
                    <td className="num">
                      {f ? `${formattaIntero(f.puntoRiordino)} / ${formattaIntero(f.lottoOrdine)}` : 'non venduto qui'}
                    </td>
                    <td className="num">
                      {p ? `${formattaIntero(p.puntoRiordino)} / ${formattaIntero(p.lottoOrdine)}` : 'non venduto qui'}
                    </td>
                    <td>
                      <button
                        className="bottone piccolo"
                        onClick={() => {
                          s.aggiungiSorvegliato(a.codice);
                          setCerca('');
                        }}
                      >
                        Aggiungi
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="tabella-scorrevole">
        <table className="tabella">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Codice</th>
              <th>Articolo</th>
              <th>Fornitore</th>
              <th className="num">{NOMI_SEDI.ferraris}</th>
              <th className="num">{NOMI_SEDI.spezia}</th>
              <th>Ordine</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {s.sorvegliati.map((codice, i) => {
              const a = s.articoli[codice];
              const f = s.parametri('ferraris', codice);
              const p = s.parametri('spezia', codice);
              if (!a) return null;
              return (
                <tr key={codice}>
                  <td className="num tenue">{i + 1}</td>
                  <td className="codice">{codice}</td>
                  <td>{a.descrizione}</td>
                  <td>{a.fornitore}</td>
                  <td className="num">
                    {f ? `${formattaIntero(f.puntoRiordino)} / ${formattaIntero(f.lottoOrdine)}` : '—'}
                  </td>
                  <td className="num">
                    {p ? `${formattaIntero(p.puntoRiordino)} / ${formattaIntero(p.lottoOrdine)}` : '—'}
                  </td>
                  <td className="frecce">
                    <button className="bottone piccolo" disabled={i === 0} onClick={() => s.spostaSorvegliato(codice, -1)}>
                      ↑
                    </button>
                    <button
                      className="bottone piccolo"
                      disabled={i === s.sorvegliati.length - 1}
                      onClick={() => s.spostaSorvegliato(codice, 1)}
                    >
                      ↓
                    </button>
                  </td>
                  <td>
                    <button className="bottone piccolo" onClick={() => s.togliSorvegliato(codice)}>
                      Togli
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="nota">
        Tolti di proposito dal prontuario: {seed.esclusi.join(', ')}. Le colonne delle sedi mostrano il punto di
        riordino e il lotto d&rsquo;ordine.
      </p>
    </section>
  );
}
