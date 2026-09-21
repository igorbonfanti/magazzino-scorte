import { useMemo, useState } from 'react';
import { formattaIntero } from '../money';
import { TIPOLOGIE } from '../lib/tipologie';
import { NOMI_SEDI, seed } from '../seed';
import { useScorte } from '../store';
import type { Sede } from '../types';

const SEDI: Sede[] = ['ferraris', 'spezia'];
const MAX_RIGHE = 60;

/**
 * Fornitore, lotto minimo e nota del lotto di ogni articolo.
 * Cambiando il lotto minimo cambia subito il lotto d'ordine di entrambe le sedi.
 */
export default function Articoli() {
  const s = useScorte();
  const [cerca, setCerca] = useState('');
  const [soloSorvegliati, setSoloSorvegliati] = useState(true);
  const [soloAmbigui, setSoloAmbigui] = useState(false);

  const fornitori = useMemo(
    () => [...new Set([...seed.tempi_consegna.map((t) => t.fornitore), ...Object.values(s.articoli).map((a) => a.fornitore)])].sort((a, b) => a.localeCompare(b, 'it')),
    [s.articoli],
  );

  /**
   * Descrizioni che non bastano a riconoscere l'articolo perche' identiche a
   * quelle di un altro codice: LAMP25 e LAMP5 sono tutti e due "LAMPOCEM
   * CEMENTO RAPIDO", e chi conta non sa se ha in mano il sacco da 25 o da 5.
   * Arrivano cosi' dal gestionale: si correggono a mano, qui.
   */
  const ambigue = useMemo(() => {
    const quante = new Map<string, number>();
    for (const a of Object.values(s.articoli)) {
      const chiave = a.descrizione.trim().toUpperCase();
      quante.set(chiave, (quante.get(chiave) ?? 0) + 1);
    }
    return new Set([...quante.entries()].filter(([, n]) => n > 1).map(([d]) => d));
  }, [s.articoli]);

  const quantiAmbigui = useMemo(
    () => Object.values(s.articoli).filter((a) => ambigue.has(a.descrizione.trim().toUpperCase())).length,
    [s.articoli, ambigue],
  );

  const trovati = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    const tutti = Object.values(s.articoli);
    const filtrati = tutti.filter((a) => {
      if (soloSorvegliati && !s.sorvegliati.includes(a.codice)) return false;
      if (soloAmbigui && !ambigue.has(a.descrizione.trim().toUpperCase())) return false;
      if (!q) return true;
      return a.codice.toLowerCase().includes(q) || a.descrizione.toLowerCase().includes(q) || a.fornitore.toLowerCase().includes(q);
    });
    return filtrati.sort((a, b) => a.codice.localeCompare(b.codice, 'it'));
  }, [s.articoli, s.sorvegliati, cerca, soloSorvegliati, soloAmbigui, ambigue]);

  const mostrati = trovati.slice(0, MAX_RIGHE);

  return (
    <section>
      <div className="barra">
        <h2>Articoli, fornitori e lotti</h2>
      </div>

      <div className="filtri">
        <input
          className="ricerca"
          type="search"
          placeholder="Cerca per codice, descrizione o fornitore"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
        />
        <label className="spunta">
          <input type="checkbox" checked={soloSorvegliati} onChange={(e) => setSoloSorvegliati(e.target.checked)} />
          solo i {s.sorvegliati.length} sorvegliati
        </label>
        <label className="spunta">
          <input type="checkbox" checked={soloAmbigui} onChange={(e) => setSoloAmbigui(e.target.checked)} />
          solo le descrizioni doppie ({formattaIntero(quantiAmbigui)})
        </label>
        <span className="nota">
          {formattaIntero(trovati.length)} articoli
          {trovati.length > MAX_RIGHE ? ` · mostrati i primi ${MAX_RIGHE}, restringi la ricerca` : ''}
        </span>
      </div>

      <div className="tabella-scorrevole">
        <table className="tabella">
          <thead>
            <tr>
              <th>Codice</th>
              <th>Articolo</th>
              <th>UM</th>
              <th className="campo">Tipologia</th>
              <th className="campo">Fornitore</th>
              <th className="num">Consegna</th>
              <th className="num campo">Lotto minimo</th>
              <th className="num campo">Pezzi per collo, contando</th>
              <th className="campo">Come si ordina</th>
              <th className="num">Ferraris: riordino / lotto</th>
              <th className="num">Spezia: riordino / lotto</th>
              <th>Sorv.</th>
              <th>Da altra sede</th>
            </tr>
          </thead>
          <tbody>
            {mostrati.map((a) => {
              const parF = s.parametri('ferraris', a.codice);
              const parS = s.parametri('spezia', a.codice);
              const sorvegliato = s.sorvegliati.includes(a.codice);
              return (
                <tr key={a.codice}>
                  <td className="codice">{a.codice}</td>
                  <td>
                    <input
                      className="testo-descrizione"
                      type="text"
                      value={a.descrizione}
                      onChange={(e) => s.cambiaArticolo(a.codice, { descrizione: e.target.value })}
                    />
                    {ambigue.has(a.descrizione.trim().toUpperCase()) && (
                      <div className="prima">uguale a un altro codice: aggiungi la misura</div>
                    )}
                  </td>
                  <td>{a.um}</td>
                  <td>
                    <select
                      className="scelta"
                      value={a.tipologia}
                      onChange={(e) => s.cambiaArticolo(a.codice, { tipologia: e.target.value })}
                      title="Reparto di magazzino, usato dal modulo di rilevazione"
                    >
                      {TIPOLOGIE.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="scelta"
                      value={a.fornitore}
                      onChange={(e) => s.cambiaArticolo(a.codice, { fornitore: e.target.value })}
                    >
                      {fornitori.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="num">{s.tempi[a.fornitore] ?? s.tempi[seed.meta.fornitore_default]} gg</td>
                  <td className="num">
                    <input
                      className="giorni"
                      type="number"
                      min={0}
                      step={1}
                      value={a.lotto_minimo}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v) && v >= 0) s.cambiaArticolo(a.codice, { lotto_minimo: Math.trunc(v) });
                      }}
                    />
                  </td>
                  <td className="num">
                    <input
                      className="giorni"
                      type="number"
                      min={0}
                      step={1}
                      value={a.pezzi_per_collo}
                      title="Quanti pezzi stanno in un collo quando si conta a magazzino"
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v) && v >= 0) s.cambiaArticolo(a.codice, { pezzi_per_collo: Math.trunc(v) });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="testo-breve"
                      type="text"
                      placeholder="bancale da 30 sacchi"
                      value={a.lotto_nota}
                      onChange={(e) => s.cambiaArticolo(a.codice, { lotto_nota: e.target.value })}
                    />
                  </td>
                  <td className="num">
                    {parF ? `${formattaIntero(parF.puntoRiordino)} / ${formattaIntero(parF.lottoOrdine)}` : '—'}
                  </td>
                  <td className="num">
                    {parS ? `${formattaIntero(parS.puntoRiordino)} / ${formattaIntero(parS.lottoOrdine)}` : '—'}
                  </td>
                  <td className="centro">
                    <input
                      type="checkbox"
                      checked={sorvegliato}
                      onChange={(e) =>
                        e.target.checked ? s.aggiungiSorvegliato(a.codice) : s.togliSorvegliato(a.codice)
                      }
                      title="Articolo nel prontuario e nella rilevazione"
                    />
                  </td>
                  <td className="centro sedi-flag">
                    {SEDI.map((sede) => {
                      const stat = s.statistica(sede, a.codice);
                      if (!stat) return null;
                      return (
                        <label key={sede} title={`${NOMI_SEDI[sede]}: prendere la merce dall'altra sede`}>
                          <input
                            type="checkbox"
                            checked={stat.rifornimento_da_altra_sede}
                            onChange={(e) => s.cambiaRifornimento(sede, a.codice, e.target.checked)}
                          />
                          {sede === 'ferraris' ? 'Fer' : 'Spe'}
                        </label>
                      );
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="nota">
        La <strong>descrizione</strong> si può correggere: quella del gestionale a volte non distingue due articoli
        diversi — LAMP25 e LAMP5 sono tutti e due &ldquo;LAMPOCEM CEMENTO RAPIDO&rdquo; — e chi conta non sa cosa ha
        in mano. La spunta <em>solo le descrizioni doppie</em> mostra tutti i casi da sistemare.
        La <strong>tipologia</strong> è il reparto di magazzino: raggruppa le righe del modulo cartaceo di rilevazione,
        così chi conta fa un giro solo. <strong>Pezzi per collo</strong> è quanto vale un tocco del tasto grande nel
        conteggio da telefono: di norma è il lotto minimo, ma dove non coincide va corretto qui (RETEPVC150 si ordina a
        500 mq e si conta a rotoli da 50). Il lotto d&rsquo;ordine è il lotto calcolato portato al primo multiplo utile del
        lotto minimo. Con lotto minimo a 0 resta il lotto calcolato. I 7 articoli che a Spezia converrebbe prendere da Ferraris partono con la spunta
        tolta: {seed.candidati_rifornimento_da_ferraris_spezia.join(', ')}.
      </p>
    </section>
  );
}
