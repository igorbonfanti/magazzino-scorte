import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { valutaGiacenza } from '../engine';
import { formattaIntero } from '../money';
import { contaColli } from '../lib/confezioni';
import { dataOra, dataOggi, scaricaCsv } from '../lib/csv';
import { NOMI_SEDI } from '../seed';
import { useScorte } from '../store';
import type { Sede } from '../types';

const COLONNE = 11;

interface RigaOrdine {
  codice: string;
  descrizione: string;
  um: string;
  fornitore: string;
  giorniConsegna: number;
  giacenza: number;
  puntoRiordino: number;
  daOrdinare: number;
  colli: string;
  lottoMinimo: number;
  lottoNota: string;
  daAltraSede: boolean;
  /** ultima giacenza contata nell'altra sede, se mai contata */
  giacenzaAltra: number | null;
  dataAltra: string | null;
  /** quanto l'altra sede ha sopra il proprio punto di riordino */
  avanzoAltra: number | null;
}

interface Gruppo {
  titolo: string;
  dettaglio: string;
  interno: boolean;
  righe: RigaOrdine[];
}

/**
 * Ordine del giorno: si compila da solo dalle giacenze della rilevazione.
 *
 * Una tabella sola, con i fornitori come righe di separazione: così le colonne
 * restano incolonnate da un gruppo all'altro e l'intestazione si ripete a ogni
 * pagina stampata. La spunta "prendi da" sposta la riga fra l'ordine al
 * fornitore e il trasferimento interno, e vale solo per questo conteggio.
 */
export default function OrdineDelGiorno() {
  const s = useScorte();
  const sede = s.sede;
  const altraSede: Sede = sede === 'ferraris' ? 'spezia' : 'ferraris';

  const rilevazione = useMemo(
    () =>
      s.rilevazioni.find((r) => r.sede === sede && r.stato === 'bozza') ??
      s.rilevazioni.find((r) => r.sede === sede),
    [s.rilevazioni, sede],
  );

  const righe = useMemo<RigaOrdine[]>(() => {
    if (!rilevazione) return [];
    const out: RigaOrdine[] = [];
    for (const codice of s.sorvegliati) {
      const giacenza = rilevazione.righe[codice];
      if (giacenza === undefined) continue;
      const articolo = s.articoli[codice];
      const stat = s.statistica(sede, codice);
      const par = s.parametri(sede, codice);
      if (!articolo || !stat || !par) continue;
      const esito = valutaGiacenza(par, stat, giacenza);
      if (esito.stato !== 'ORDINA') continue;

      const ultima = s.ultimaGiacenza(altraSede, codice);
      const parAltra = s.parametri(altraSede, codice);

      out.push({
        codice,
        descrizione: articolo.descrizione,
        um: articolo.um,
        fornitore: articolo.fornitore,
        giorniConsegna: par.leadTime,
        giacenza,
        puntoRiordino: par.puntoRiordino,
        daOrdinare: esito.daOrdinare,
        colli: contaColli(esito.daOrdinare, par.lottoMinimo, articolo.lotto_nota).testo,
        lottoMinimo: par.lottoMinimo,
        lottoNota: articolo.lotto_nota,
        daAltraSede: s.siTrasferisce(rilevazione, codice),
        giacenzaAltra: ultima ? ultima.giacenza : null,
        dataAltra: ultima ? ultima.data : null,
        avanzoAltra:
          ultima && parAltra ? Math.max(0, ultima.giacenza - parAltra.puntoRiordino) : null,
      });
    }
    return out;
  }, [rilevazione, s, sede, altraSede]);

  const gruppi = useMemo<Gruppo[]>(() => {
    const perFornitore = new Map<string, RigaOrdine[]>();
    const interne: RigaOrdine[] = [];

    for (const r of righe) {
      if (r.daAltraSede) {
        interne.push(r);
        continue;
      }
      const elenco = perFornitore.get(r.fornitore) ?? [];
      elenco.push(r);
      perFornitore.set(r.fornitore, elenco);
    }

    const ordinati: Gruppo[] = [...perFornitore.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'it'))
      .map(([fornitore, elenco]) => ({
        titolo: fornitore,
        dettaglio: `consegna in ${elenco[0].giorniConsegna} giorni lavorativi · ${elenco.length} ${
          elenco.length === 1 ? 'riga' : 'righe'
        }`,
        interno: false,
        righe: elenco,
      }));

    if (interne.length > 0) {
      ordinati.push({
        titolo: `Da prendere da ${NOMI_SEDI[altraSede]}`,
        dettaglio: `trasferimento interno, non si ordina al fornitore · ${interne.length} ${
          interne.length === 1 ? 'riga' : 'righe'
        }`,
        interno: true,
        righe: interne,
      });
    }

    return ordinati;
  }, [righe, altraSede]);

  const fornitoriCoinvolti = gruppi.filter((g) => !g.interno).length;
  const daTrasferire = gruppi.find((g) => g.interno)?.righe.length ?? 0;
  const chiusa = rilevazione?.stato === 'chiusa';

  function esporta() {
    const testata = [
      'Fornitore',
      'Consegna (gg)',
      'Codice',
      'Articolo',
      'UM',
      'Giacenza',
      'Riordina a',
      'Da ordinare',
      'Colli',
      `Ultima a ${NOMI_SEDI[altraSede]}`,
      'Trasferimento interno',
      'Lotto minimo',
      'Come si ordina',
    ];
    const corpo = gruppi.flatMap((g) =>
      g.righe.map((r) => [
        g.interno ? g.titolo : r.fornitore,
        g.interno ? '' : r.giorniConsegna,
        r.codice,
        r.descrizione,
        r.um,
        r.giacenza,
        r.puntoRiordino,
        r.daOrdinare,
        r.colli,
        r.giacenzaAltra ?? 'mai contata',
        r.daAltraSede ? 'sì' : 'no',
        r.lottoMinimo || '',
        r.lottoNota,
      ]),
    );
    scaricaCsv(`ordine-${sede}-${new Date().toISOString().slice(0, 10)}.csv`, [testata, ...corpo]);
  }

  if (!rilevazione) {
    return (
      <section>
        <h2>Ordine del giorno — {NOMI_SEDI[sede]}</h2>
        <p className="nota">
          Non c&rsquo;è ancora nessuna rilevazione per questa sede. <Link to="/rilevazione">Aprine una</Link> e
          inserisci le giacenze: l&rsquo;ordine si compila da solo.
        </p>
      </section>
    );
  }

  return (
    <section className="stampabile">
      <div className="barra schermo">
        <h2>Ordine del giorno — {NOMI_SEDI[sede]}</h2>
        <div className="azioni">
          <button className="bottone" onClick={esporta} disabled={righe.length === 0}>
            Esporta CSV
          </button>
          <button className="bottone principale" onClick={() => window.print()} disabled={righe.length === 0}>
            Stampa
          </button>
        </div>
      </div>

      <div className="testata-stampa">
        <h2>Ordine del giorno — {NOMI_SEDI[sede]}</h2>
        <p>
          {dataOggi()} · rilevazione del {dataOra(rilevazione.data)}
          {chiusa ? ' (chiusa)' : ' (bozza)'}
        </p>
      </div>

      {righe.length === 0 ? (
        <p className="nota">
          Nessun articolo sotto il punto di riordino fra quelli contati. Se non hai ancora contato niente, vai alla{' '}
          <Link to="/rilevazione">rilevazione</Link>.
        </p>
      ) : (
        <>
          <div className="riepilogo-ordine">
            <div className="dato">
              <span className="numero">{formattaIntero(righe.length - daTrasferire)}</span>
              <span className="etichetta">righe da ordinare</span>
            </div>
            <div className="dato">
              <span className="numero">{formattaIntero(fornitoriCoinvolti)}</span>
              <span className="etichetta">{fornitoriCoinvolti === 1 ? 'fornitore' : 'fornitori'}</span>
            </div>
            <div className="dato">
              <span className="numero">{formattaIntero(daTrasferire)}</span>
              <span className="etichetta">da {NOMI_SEDI[altraSede]}</span>
            </div>
          </div>

          <p className="nota schermo">
            La spunta <strong>prendi da {NOMI_SEDI[altraSede]}</strong> sposta la riga dall&rsquo;ordine al fornitore
            al trasferimento interno, e vale <strong>solo per questo conteggio</strong>. La regola fissa per
            l&rsquo;articolo si cambia invece in <Link to="/articoli">Articoli e lotti</Link>.
            {chiusa && ' La rilevazione è chiusa: le decisioni non si possono più cambiare.'}
          </p>

          <div className="tabella-scorrevole">
            <table className="tabella tabella-ordine">
              <colgroup>
                <col className="c-codice" />
                <col className="c-articolo" />
                <col className="c-um" />
                <col className="c-num" />
                <col className="c-num" />
                <col className="c-quantita" />
                <col className="c-colli" />
                <col className="c-altra" />
                <col className="c-trasferisci" />
                <col className="c-num" />
                <col className="c-nota" />
              </colgroup>
              <thead>
                <tr>
                  <th>Codice</th>
                  <th>Articolo</th>
                  <th className="centro">UM</th>
                  <th className="num stacco">Giacenza</th>
                  <th className="num">Riordina a</th>
                  <th className="num stacco">Da ordinare</th>
                  <th className="num">Colli</th>
                  <th className="num stacco">A {NOMI_SEDI[altraSede]}</th>
                  <th className="centro col-trasferisci">Prendi da lì</th>
                  <th className="num stacco">Lotto min.</th>
                  <th>Come si ordina</th>
                </tr>
              </thead>
              {gruppi.map((gruppo) => (
                <tbody key={gruppo.titolo}>
                  <tr className={`riga-gruppo ${gruppo.interno ? 'interno' : ''}`}>
                    <th colSpan={COLONNE} scope="colgroup">
                      <span className="contenuto-gruppo">
                        <span className="nome-gruppo">{gruppo.titolo}</span>
                        <span className="dettaglio-gruppo">{gruppo.dettaglio}</span>
                      </span>
                    </th>
                  </tr>
                  {gruppo.righe.map((r) => (
                    <tr key={r.codice}>
                      <td className="codice">{r.codice}</td>
                      <td className="descrizione" title={r.descrizione}>
                        {r.descrizione}
                      </td>
                      <td className="centro secondario">{r.um}</td>
                      <td className="num stacco secondario">{formattaIntero(r.giacenza)}</td>
                      <td className="num secondario">{formattaIntero(r.puntoRiordino)}</td>
                      <td className="num forte grande stacco">{formattaIntero(r.daOrdinare)}</td>
                      <td className="num colli">{r.colli}</td>
                      <td className="num stacco altra-sede">
                        {r.giacenzaAltra === null ? (
                          <span className="tenue">mai contata</span>
                        ) : (
                          <>
                            <span className="forte">{formattaIntero(r.giacenzaAltra)}</span>
                            <div className="tenue piccolo">
                              {r.avanzoAltra && r.avanzoAltra > 0
                                ? `${formattaIntero(r.avanzoAltra)} sopra il suo riordino`
                                : 'già sotto il suo riordino'}
                              {r.dataAltra ? ` · ${dataOra(r.dataAltra).slice(0, 10)}` : ''}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="centro col-trasferisci">
                        <input
                          type="checkbox"
                          checked={r.daAltraSede}
                          disabled={chiusa}
                          onChange={(e) => s.cambiaTrasferimento(rilevazione.id, r.codice, e.target.checked)}
                          title={`Prendere la merce da ${NOMI_SEDI[altraSede]} invece di ordinarla`}
                        />
                      </td>
                      <td className="num stacco secondario">
                        {r.lottoMinimo > 0 ? formattaIntero(r.lottoMinimo) : '—'}
                      </td>
                      <td className="nota-riga">{r.lottoNota}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>

          <p className="firma-stampa">Ordine compilato da _______________________ il ____ / ____ / ________</p>
        </>
      )}
    </section>
  );
}
