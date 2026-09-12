import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { valutaGiacenza } from '../engine';
import { formattaIntero } from '../money';
import { dataOra } from '../lib/csv';
import { NOMI_SEDI, seed } from '../seed';
import type { Sede } from '../types';
import { useScorte } from '../store';

/**
 * Rilevazione delle giacenze: i 75 articoli sorvegliati, nell'ordine di stampa.
 * Si salva da sola in bozza a ogni tasto; "Chiudi rilevazione" blocca tutto.
 */
export default function Rilevazione() {
  const s = useScorte();
  const sede = s.sede;
  const altraSede: Sede = sede === 'ferraris' ? 'spezia' : 'ferraris';
  const campi = useRef<(HTMLInputElement | null)[]>([]);

  const aperta = s.rilevazioneAperta(sede);

  const righe = useMemo(
    () =>
      s.sorvegliati
        .map((codice) => ({
          codice,
          articolo: s.articoli[codice],
          stat: s.statistica(sede, codice),
          par: s.parametri(sede, codice),
        }))
        .filter((r) => r.articolo && r.stat && r.par),
    [s, sede],
  );

  const giacenze = aperta?.righe ?? {};
  const contate = Object.keys(giacenze).length;
  const daOrdinare = righe.filter((r) => {
    const g = giacenze[r.codice];
    if (g === undefined) return false;
    return valutaGiacenza(r.par!, r.stat!, g).stato === 'ORDINA';
  }).length;

  /** Le giacenze dei casi di prova del foglio di calcolo, per controllare i conti. */
  function caricaProva(id: string) {
    const casi = seed.test_rilevazione as unknown as { sede: string; codice: string; giacenza: number }[];
    for (const caso of casi) {
      if (caso.sede === sede) s.scriviGiacenza(id, caso.codice, caso.giacenza);
    }
  }

  function vaiAllaRiga(indice: number) {
    const prossimo = campi.current[indice];
    if (prossimo) {
      prossimo.focus();
      prossimo.select();
    }
  }

  if (!aperta) {
    return (
      <section>
        <div className="barra">
          <h2>Rilevazione — {NOMI_SEDI[sede]}</h2>
          <button className="bottone principale" onClick={() => s.apriRilevazione(sede)}>
            Apri una nuova rilevazione
          </button>
        </div>
        <p className="nota">
          Nessuna rilevazione aperta per questa sede. Aprendone una nuova puoi inserire le giacenze contate dei{' '}
          {s.sorvegliati.length} articoli sorvegliati.
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="barra">
        <h2>Rilevazione — {NOMI_SEDI[sede]}</h2>
        <div className="azioni">
          <span className="stato-salvataggio">Bozza salvata · aperta il {dataOra(aperta.data)}</span>
          <button className="bottone" onClick={() => caricaProva(aperta.id)}>
            Giacenze di prova
          </button>
          <Link className="bottone" to="/conta">
            Conta dal telefono
          </Link>
          <Link className="bottone" to="/ordine">
            Ordine del giorno
          </Link>
          <button
            className="bottone principale"
            onClick={() => {
              if (confirm('Chiudere la rilevazione? Dopo non si potranno più cambiare le giacenze.')) {
                s.chiudiRilevazione(aperta.id);
              }
            }}
          >
            Chiudi rilevazione
          </button>
        </div>
      </div>

      <p className="nota">
        Conta la merce e scrivi la giacenza. Con <strong>Invio</strong> passi alla riga sotto. {contate} articoli su{' '}
        {righe.length} contati, <strong>{daOrdinare}</strong> da ordinare.
      </p>

      <div className="tabella-scorrevole">
        <table className="tabella">
          <thead>
            <tr>
              <th>Codice</th>
              <th>Articolo</th>
              <th>UM</th>
              <th>Cl.</th>
              <th className="num stacco">Riordina quando scendi a</th>
              <th className="num">Scorta massima</th>
              <th className="num">Lotto d&rsquo;ordine</th>
              <th className="num">Lotto minimo</th>
              <th className="num stacco">Giacenza</th>
              <th>Stato</th>
              <th className="num">Da ordinare</th>
              <th className="num">Giorni residui</th>
              <th className="stacco">Nota</th>
              <th className="num stacco">Ultima a {NOMI_SEDI[altraSede]}</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r, i) => {
              const par = r.par!;
              const stat = r.stat!;
              const g = giacenze[r.codice];
              const esito = g === undefined ? null : valutaGiacenza(par, stat, g);
              return (
                <tr key={r.codice} className={`riga-${par.classe}`}>
                  <td className="codice">{r.codice}</td>
                  <td className="descrizione" title={r.articolo.descrizione}>
                    {r.articolo.descrizione}
                  </td>
                  <td className="secondario">{r.articolo.um}</td>
                  <td>
                    <span className={`pastiglia classe-${par.classe}`}>{par.classe}</span>
                  </td>
                  <td className="num forte stacco">{formattaIntero(par.puntoRiordino)}</td>
                  <td className="num secondario">{formattaIntero(par.scortaMassima)}</td>
                  <td className="num secondario">{formattaIntero(par.lottoOrdine)}</td>
                  <td className="num secondario">{par.lottoMinimo > 0 ? formattaIntero(par.lottoMinimo) : '—'}</td>
                  <td className="num stacco">
                    <input
                      ref={(el) => {
                        campi.current[i] = el;
                      }}
                      className="giacenza"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={g ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        s.scriviGiacenza(aperta.id, r.codice, v === '' ? null : Math.max(0, Number(v)));
                      }}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          vaiAllaRiga(i + 1);
                        }
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          vaiAllaRiga(i + 1);
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          vaiAllaRiga(i - 1);
                        }
                      }}
                    />
                  </td>
                  <td>
                    {esito === null ? (
                      <span className="tenue">da contare</span>
                    ) : esito.stato === 'ORDINA' ? (
                      <span className="ordina">ORDINA</span>
                    ) : (
                      <span className="ok">ok</span>
                    )}
                  </td>
                  <td className="num forte">{esito && esito.daOrdinare > 0 ? formattaIntero(esito.daOrdinare) : ''}</td>
                  <td className="num">{esito?.giorniResidui != null ? formattaIntero(esito.giorniResidui) : ''}</td>
                  <td className="nota-riga stacco">
                    {[stat.nota, r.articolo.lotto_nota].filter(Boolean).join(' · ')}
                    {stat.rifornimento_da_altra_sede ? ` · di norma si prende da ${NOMI_SEDI[altraSede]}` : ''}
                  </td>
                  <td className="num stacco altra-sede">
                    <GiacenzaAltraSede sede={altraSede} codice={r.codice} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Quanta merce c'è nell'altra sede, secondo il conteggio più recente. */
function GiacenzaAltraSede({ sede, codice }: { sede: Sede; codice: string }) {
  const s = useScorte();
  const ultima = s.ultimaGiacenza(sede, codice);
  if (!ultima) return <span className="tenue">mai contata</span>;
  return (
    <>
      <span className="forte">{formattaIntero(ultima.giacenza)}</span>
      <div className="tenue piccolo">
        {dataOra(ultima.data).slice(0, 10)}
        {ultima.stato === 'bozza' ? ' · bozza' : ''}
      </div>
    </>
  );
}
