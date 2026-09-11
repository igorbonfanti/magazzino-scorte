import { useMemo } from 'react';
import { formattaCent, formattaDecimale, formattaIntero } from '../money';
import { NOMI_SEDI, seed } from '../seed';
import { useScorte } from '../store';
import type { Sede } from '../types';

const SEDI: Sede[] = ['ferraris', 'spezia'];

/**
 * Cosa cambia con i tempi di consegna per fornitore, rispetto ai 5 giorni
 * uguali per tutti di prima. Si aggiorna da sola quando si cambiano i giorni.
 */
export default function Variazioni() {
  const s = useScorte();

  const righe = useMemo(() => {
    const out = [];
    for (const sede of SEDI) {
      for (const codice of s.sorvegliati) {
        const articolo = s.articoli[codice];
        const stat = s.statistica(sede, codice);
        const ora = s.parametri(sede, codice);
        const prima = s.parametriPrima(sede, codice);
        if (!articolo || !stat || !ora || !prima) continue;
        if (ora.puntoRiordino === prima.puntoRiordino && ora.valoreMedioCent === prima.valoreMedioCent) continue;
        out.push({
          sede,
          codice,
          descrizione: articolo.descrizione,
          classe: ora.classe,
          fornitore: articolo.fornitore,
          giorni: ora.leadTime,
          riordinoPrima: prima.puntoRiordino,
          riordinoOra: ora.puntoRiordino,
          valorePrimaCent: prima.valoreMedioCent,
          valoreOraCent: ora.valoreMedioCent,
        });
      }
    }
    return out.sort(
      (a, b) => b.valoreOraCent - b.valorePrimaCent - (a.valoreOraCent - a.valorePrimaCent),
    );
  }, [s]);

  const totalePrima = righe.reduce((t, r) => t + r.valorePrimaCent, 0);
  const totaleOra = righe.reduce((t, r) => t + r.valoreOraCent, 0);

  return (
    <section>
      <h2>Cosa cambia con i tempi di consegna</h2>
      <p className="nota">
        Confronto fra i tempi per fornitore e i {seed.meta.lead_time_base} giorni uguali per tutti di prima, sui soli
        articoli sorvegliati. {formattaIntero(righe.length)} righe cambiano.
      </p>

      <div className="tabella-scorrevole">
        <table className="tabella">
          <thead>
            <tr>
              <th>Sede</th>
              <th>Codice</th>
              <th>Articolo</th>
              <th>Cl.</th>
              <th>Fornitore</th>
              <th className="num">Consegna gg</th>
              <th className="num">Riordino prima</th>
              <th className="num">Riordino ora</th>
              <th className="num">Differenza</th>
              <th className="num">Var. %</th>
              <th className="num">Scorta media € prima</th>
              <th className="num">Scorta media € ora</th>
              <th className="num">Differenza €</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => {
              const diff = r.riordinoOra - r.riordinoPrima;
              const diffCent = r.valoreOraCent - r.valorePrimaCent;
              const varPerc = r.riordinoPrima > 0 ? (diff / r.riordinoPrima) * 100 : 0;
              return (
                <tr key={`${r.sede}-${r.codice}`}>
                  <td>{r.sede === 'ferraris' ? 'Ferraris' : 'Spezia'}</td>
                  <td className="codice">{r.codice}</td>
                  <td>{r.descrizione}</td>
                  <td>{r.classe}</td>
                  <td>{r.fornitore}</td>
                  <td className="num">{r.giorni}</td>
                  <td className="num">{formattaIntero(r.riordinoPrima)}</td>
                  <td className="num forte">{formattaIntero(r.riordinoOra)}</td>
                  <td className={`num ${diff > 0 ? 'sale' : diff < 0 ? 'scende' : ''}`}>
                    {diff > 0 ? '+' : ''}
                    {formattaIntero(diff)}
                  </td>
                  <td className={`num ${diff > 0 ? 'sale' : diff < 0 ? 'scende' : ''}`}>
                    {varPerc > 0 ? '+' : ''}
                    {formattaDecimale(varPerc)}%
                  </td>
                  <td className="num">{formattaCent(r.valorePrimaCent)}</td>
                  <td className="num">{formattaCent(r.valoreOraCent)}</td>
                  <td className={`num ${diffCent > 0 ? 'sale' : diffCent < 0 ? 'scende' : ''}`}>
                    {diffCent > 0 ? '+' : ''}
                    {formattaCent(diffCent)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={10} className="forte">
                Totale sulle righe che cambiano
              </td>
              <td className="num forte">{formattaCent(totalePrima)}</td>
              <td className="num forte">{formattaCent(totaleOra)}</td>
              <td className="num forte">
                {totaleOra - totalePrima > 0 ? '+' : ''}
                {formattaCent(totaleOra - totalePrima)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="nota">
        Le sedi sono {NOMI_SEDI.ferraris} e {NOMI_SEDI.spezia}. Un tempo di consegna più lungo alza il punto di
        riordino e quindi il capitale fermo a magazzino; più corto lo abbassa.
      </p>
    </section>
  );
}
