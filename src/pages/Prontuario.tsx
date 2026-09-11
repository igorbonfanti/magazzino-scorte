import { useMemo } from 'react';
import { formattaCent, formattaIntero, sommaCent } from '../money';
import { dataOggi, scaricaCsv } from '../lib/csv';
import { NOMI_SEDI, seed } from '../seed';
import { useScorte } from '../store';

/** Prontuario di riordino della sede, nelle colonne del foglio di calcolo. */
export default function Prontuario() {
  const s = useScorte();
  const sede = s.sede;

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

  const totaleSorvegliati = sommaCent(righe.map((r) => r.par!.valoreMedioCent));

  const totaleSede = useMemo(
    () =>
      sommaCent(
        Object.values(s.statistiche(sede))
          .map((st) => s.parametri(sede, st.codice)?.valoreMedioCent ?? 0),
      ),
    [s, sede],
  );

  function esporta() {
    const testata = [
      'Codice',
      'Articolo',
      'UM',
      'Cl.',
      'Consumo sett. medio',
      'Consumo sett. MAX',
      'Riordina quando scendi a',
      "Quantità da ordinare",
      'Scorta massima',
      'Giorni di autonomia',
      'Ogni quanto riordina',
      'Attenzione',
      'Fornitore (consegna)',
      'Lotto minimo',
      'Scorta media',
      'Valore medio €',
    ];
    const corpo = righe.map(({ codice, articolo, stat, par }) => [
      codice,
      articolo.descrizione,
      articolo.um,
      par!.classe,
      Math.round(stat!.cons_sett_medio),
      stat!.cons_sett_max,
      par!.puntoRiordino,
      par!.lottoOrdine,
      par!.scortaMassima,
      Math.round(par!.giorniAutonomia),
      par!.ogniQuanto,
      stat!.nota,
      `${articolo.fornitore} · ${par!.leadTime} gg`,
      par!.lottoMinimo || '',
      par!.scortaMedia,
      formattaCent(par!.valoreMedioCent),
    ]);
    scaricaCsv(`prontuario-${sede}.csv`, [testata, ...corpo]);
  }

  return (
    <section className="stampabile">
      <div className="barra schermo">
        <h2>Prontuario — {NOMI_SEDI[sede]}</h2>
        <div className="azioni">
          <button className="bottone" onClick={esporta}>
            Esporta CSV
          </button>
          <button className="bottone principale" onClick={() => window.print()}>
            Stampa
          </button>
        </div>
      </div>

      <div className="testata-stampa">
        <h2>
          Prontuario di riordino — {NOMI_SEDI[sede]} · {righe.length} articoli
        </h2>
        <p>
          {dataOggi()} · consumi {seed.meta.periodo_consumi} · controlla la giacenza, se è scesa al livello indicato
          ordina la quantità della colonna &ldquo;quantità da ordinare&rdquo;.
        </p>
      </div>

      <div className="tabella-scorrevole">
        <table className="tabella">
          <thead>
            <tr>
              <th>Codice</th>
              <th>Articolo</th>
              <th>UM</th>
              <th>Cl.</th>
              <th className="num stacco">Consumo sett. medio</th>
              <th className="num">Consumo sett. MAX</th>
              <th className="num stacco">Riordina quando scendi a</th>
              <th className="num">Quantità da ordinare</th>
              <th className="num">Scorta massima</th>
              <th className="num stacco">Giorni di autonomia</th>
              <th>Ogni quanto riordina</th>
              <th className="stacco">Attenzione</th>
              <th>Fornitore (consegna)</th>
              <th className="num">Lotto minimo</th>
              <th className="num">Valore medio €</th>
            </tr>
          </thead>
          <tbody>
            {righe.map(({ codice, articolo, stat, par }) => (
              <tr key={codice} className={`riga-${par!.classe}`}>
                <td className="codice">{codice}</td>
                <td className="descrizione" title={articolo.descrizione}>
                  {articolo.descrizione}
                </td>
                <td className="secondario">{articolo.um}</td>
                <td>
                  <span className={`pastiglia classe-${par!.classe}`}>{par!.classe}</span>
                </td>
                <td className="num stacco secondario">{formattaIntero(Math.round(stat!.cons_sett_medio))}</td>
                <td className="num secondario">{formattaIntero(stat!.cons_sett_max)}</td>
                <td className="num forte grande stacco">{formattaIntero(par!.puntoRiordino)}</td>
                <td className="num forte">{formattaIntero(par!.lottoOrdine)}</td>
                <td className="num">{formattaIntero(par!.scortaMassima)}</td>
                <td className="num stacco secondario">{formattaIntero(Math.round(par!.giorniAutonomia))}</td>
                <td className="secondario">{par!.ogniQuanto}</td>
                <td className="nota-riga stacco">
                  {stat!.nota}
                  {stat!.rifornimento_da_altra_sede ? ' · prendere da Ferraris' : ''}
                </td>
                <td className="nota-riga">
                  {articolo.fornitore} · {par!.leadTime} gg
                </td>
                <td className="num">
                  {par!.lottoMinimo > 0 ? formattaIntero(par!.lottoMinimo) : '—'}
                  {articolo.lotto_nota && <div className="tenue piccolo">{articolo.lotto_nota}</div>}
                </td>
                <td className="num">{formattaCent(par!.valoreMedioCent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="riepilogo">
        <p>
          Valore medio della scorta sugli articoli sorvegliati: <strong>{formattaCent(totaleSorvegliati)} €</strong>
        </p>
        <p>
          Valore medio della scorta su tutti i {formattaIntero(Object.keys(s.statistiche(sede)).length)} articoli della
          sede: <strong>{formattaCent(totaleSede)} €</strong>
        </p>
        <ul className="legenda">
          <li>
            <span className="quadratino classe-A" /> Classe A — si riordina ogni 2
            settimane
          </li>
          <li>
            <span className="quadratino classe-B" /> Classe B — una volta al mese
          </li>
          <li>
            <span className="quadratino classe-C" /> Classe C — ogni 3 mesi
          </li>
        </ul>
      </div>
    </section>
  );
}
