import { useMemo } from 'react';
import { formattaCent, formattaDecimale, formattaIntero } from '../money';
import { NOMI_SEDI, seed } from '../seed';
import { useScorte } from '../store';
import type { Classe, Sede } from '../types';

const SEDI: Sede[] = ['ferraris', 'spezia'];
const CLASSI: Classe[] = ['A', 'B', 'C'];

interface Voce {
  articoli: number;
  vendutoCent: number;
  mediaCent: number;
  piccoCent: number;
}

function vuota(): Voce {
  return { articoli: 0, vendutoCent: 0, mediaCent: 0, piccoCent: 0 };
}

/** Ripartizione per punto vendita e per classe, come nel foglio SINTESI SEDI. */
export default function Sintesi() {
  const s = useScorte();

  const dati = useMemo(() => {
    const out: Record<Sede, Record<Classe | 'tutte', Voce>> = {
      ferraris: { A: vuota(), B: vuota(), C: vuota(), tutte: vuota() },
      spezia: { A: vuota(), B: vuota(), C: vuota(), tutte: vuota() },
    };
    for (const sede of SEDI) {
      for (const stat of Object.values(s.statistiche(sede))) {
        const par = s.parametri(sede, stat.codice);
        if (!par) continue;
        for (const chiave of [stat.classe, 'tutte'] as const) {
          const v = out[sede][chiave];
          v.articoli++;
          v.vendutoCent += stat.venduto_8m * stat.co3_cent;
          v.mediaCent += par.valoreMedioCent;
          v.piccoCent += par.scortaMassima * stat.co3_cent;
        }
      }
    }
    return out;
  }, [s]);

  return (
    <section>
      <h2>Sintesi per punto vendita</h2>
      <p className="nota">
        {seed.meta.periodo_consumi}, perimetro depurato. La giacenza media è il capitale mediamente fermo: scorta di
        sicurezza più metà lotto. Il picco è il magazzino appena arrivata la merce, cioè la scorta massima.
      </p>

      {SEDI.map((sede) => (
        <div className="gruppo" key={sede}>
          <h3>{NOMI_SEDI[sede]}</h3>
          <table className="tabella">
            <thead>
              <tr>
                <th>Classe</th>
                <th className="num">Articoli</th>
                <th className="num">Costo del venduto €</th>
                <th className="num">% sede</th>
                <th className="num">Giacenza media €</th>
                <th className="num">Picco €</th>
                <th>Ogni quanto si riordina</th>
              </tr>
            </thead>
            <tbody>
              {CLASSI.map((classe) => {
                const v = dati[sede][classe];
                const tot = dati[sede].tutte.vendutoCent;
                const quota = tot > 0 ? (v.vendutoCent / tot) * 100 : 0;
                return (
                  <tr key={classe}>
                    <td className="forte">{classe}</td>
                    <td className="num">{formattaIntero(v.articoli)}</td>
                    <td className="num">{formattaCent(v.vendutoCent)}</td>
                    <td className="num">{formattaDecimale(quota)}%</td>
                    <td className="num">{formattaCent(v.mediaCent)}</td>
                    <td className="num">{formattaCent(v.piccoCent)}</td>
                    <td>{classe === 'A' ? 'ogni 2 settimane' : classe === 'B' ? 'una volta al mese' : 'ogni 3 mesi'}</td>
                  </tr>
                );
              })}
              <tr className="totale">
                <td className="forte">tutte</td>
                <td className="num forte">{formattaIntero(dati[sede].tutte.articoli)}</td>
                <td className="num forte">{formattaCent(dati[sede].tutte.vendutoCent)}</td>
                <td className="num forte">100,0%</td>
                <td className="num forte">{formattaCent(dati[sede].tutte.mediaCent)}</td>
                <td className="num forte">{formattaCent(dati[sede].tutte.piccoCent)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      <p className="nota">
        Classe A: i primi articoli fino all&rsquo;80% del costo del venduto, presenti in almeno 6 mesi su 8. Classe B:
        fino al 95%, presenti in almeno 4 mesi. Classe C: tutto il resto.
      </p>
    </section>
  );
}
