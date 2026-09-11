import { useMemo, useState } from 'react';
import { formattaIntero } from '../money';
import { dataOggi } from '../lib/csv';
import { ordineTipologia } from '../lib/tipologie';
import { NOMI_SEDI } from '../seed';
import { useScorte } from '../store';

type Raggruppamento = 'tipologia' | 'fornitore' | 'prontuario';

/**
 * Modulo cartaceo per il conteggio in magazzino.
 *
 * Chi conta gira una corsia alla volta, non segue l'ordine del prontuario:
 * per questo le righe si raggruppano per tipologia di materiale o per
 * fornitore, e la casella della giacenza è grande abbastanza da scriverci
 * a matita.
 */
export default function ModuloRilevazione() {
  const s = useScorte();
  const sede = s.sede;
  const [raggruppa, setRaggruppa] = useState<Raggruppamento>('tipologia');
  const [mostraLivelli, setMostraLivelli] = useState(false);
  const [paginaPerGruppo, setPaginaPerGruppo] = useState(false);

  const gruppi = useMemo(() => {
    const righe = s.sorvegliati
      .map((codice) => ({ codice, articolo: s.articoli[codice], par: s.parametri(sede, codice) }))
      .filter((r) => r.articolo && r.par);

    if (raggruppa === 'prontuario') {
      return [{ titolo: `Prontuario — ${righe.length} articoli`, sottotitolo: '', righe }];
    }

    const mappa = new Map<string, typeof righe>();
    for (const r of righe) {
      const chiave = raggruppa === 'tipologia' ? r.articolo.tipologia : r.articolo.fornitore;
      const elenco = mappa.get(chiave) ?? [];
      elenco.push(r);
      mappa.set(chiave, elenco);
    }

    return [...mappa.entries()]
      .sort((a, b) =>
        raggruppa === 'tipologia'
          ? ordineTipologia(a[0]) - ordineTipologia(b[0])
          : a[0].localeCompare(b[0], 'it'),
      )
      .map(([titolo, elenco]) => ({
        titolo,
        sottotitolo:
          raggruppa === 'fornitore'
            ? `consegna in ${elenco[0].par!.leadTime} giorni lavorativi`
            : `${elenco.length} ${elenco.length === 1 ? 'articolo' : 'articoli'}`,
        righe: [...elenco].sort((a, b) => a.articolo.descrizione.localeCompare(b.articolo.descrizione, 'it')),
      }));
  }, [s, sede, raggruppa]);

  const totale = gruppi.reduce((t, g) => t + g.righe.length, 0);

  return (
    <section className="pagina-modulo">
      <div className="barra schermo">
        <h2>Modulo di rilevazione da stampare</h2>
        <button className="bottone principale" onClick={() => window.print()}>
          Stampa
        </button>
      </div>

      <div className="filtri schermo">
        <label className="spunta">
          Raggruppa per
          <select
            className="scelta"
            value={raggruppa}
            onChange={(e) => setRaggruppa(e.target.value as Raggruppamento)}
          >
            <option value="tipologia">tipologia di materiale</option>
            <option value="fornitore">fornitore</option>
            <option value="prontuario">ordine del prontuario</option>
          </select>
        </label>
        <label className="spunta">
          <input type="checkbox" checked={mostraLivelli} onChange={(e) => setMostraLivelli(e.target.checked)} />
          stampa anche il livello di riordino
        </label>
        <label className="spunta">
          <input type="checkbox" checked={paginaPerGruppo} onChange={(e) => setPaginaPerGruppo(e.target.checked)} />
          una pagina per gruppo
        </label>
        <span className="nota">
          {totale} articoli in {gruppi.length} {gruppi.length === 1 ? 'gruppo' : 'gruppi'}
        </span>
      </div>

      <p className="nota schermo">
        La tipologia di ogni articolo si corregge in <strong>Articoli e lotti</strong>: serve a far girare il magazzino
        una corsia alla volta. Senza il livello di riordino il conteggio è alla cieca, e chi conta scrive solo quello
        che vede.
      </p>

      <div className="modulo">
        <div className="testata-modulo">
          <div>
            <h2>Rilevazione giacenze — {NOMI_SEDI[sede]}</h2>
            <p>Conta la merce e scrivi la quantità nella casella. Se un articolo non si trova, scrivi 0.</p>
          </div>
          <div className="campi-testata">
            <span>Data {dataOggi()}</span>
            <span>Contata da ______________________</span>
          </div>
        </div>

        {gruppi.map((gruppo) => (
          <div className={`gruppo-modulo ${paginaPerGruppo ? 'pagina-nuova' : ''}`} key={gruppo.titolo}>
            <h3>
              {gruppo.titolo}
              {gruppo.sottotitolo && <span className="tenue"> · {gruppo.sottotitolo}</span>}
            </h3>
            <table className="tabella-modulo">
              <thead>
                <tr>
                  <th className="col-codice">Codice</th>
                  <th>Articolo</th>
                  <th className="col-um">UM</th>
                  {mostraLivelli && <th className="col-livello">Riordina a</th>}
                  <th className="col-giacenza">Quantità contata</th>
                  <th className="col-spunta">✓</th>
                </tr>
              </thead>
              <tbody>
                {gruppo.righe.map(({ codice, articolo, par }) => (
                  <tr key={codice}>
                    <td className="codice">{codice}</td>
                    <td>
                      {articolo.descrizione}
                      {articolo.lotto_nota && <span className="tenue piccolo"> — {articolo.lotto_nota}</span>}
                    </td>
                    <td className="col-um">{articolo.um}</td>
                    {mostraLivelli && <td className="col-livello">{formattaIntero(par!.puntoRiordino)}</td>}
                    <td className="col-giacenza" />
                    <td className="col-spunta" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <p className="firma-modulo">
          Conteggio finito alle ______ : ______ · firma ______________________
        </p>
      </div>
    </section>
  );
}
