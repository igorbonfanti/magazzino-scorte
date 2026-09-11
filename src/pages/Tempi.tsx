import { useMemo } from 'react';
import { formattaIntero } from '../money';
import { seed } from '../seed';
import { useScorte } from '../store';

/**
 * Tempi di consegna per fornitore. Cambiare i giorni ricalcola subito
 * prontuario, rilevazione e ordine del giorno di entrambe le sedi.
 */
export default function Tempi() {
  const s = useScorte();

  const conteggi = useMemo(() => {
    const perFornitore: Record<string, { totale: number; sorvegliati: number }> = {};
    for (const a of Object.values(s.articoli)) {
      const voce = (perFornitore[a.fornitore] ??= { totale: 0, sorvegliati: 0 });
      voce.totale++;
      if (s.sorvegliati.includes(a.codice)) voce.sorvegliati++;
    }
    return perFornitore;
  }, [s.articoli, s.sorvegliati]);

  return (
    <section>
      <div className="barra">
        <h2>Tempi di consegna</h2>
        {s.modificato && (
          <button
            className="bottone"
            onClick={() => {
              if (confirm('Rimettere tempi, fornitori, lotti ed elenco sorvegliato come nel file di partenza?')) {
                s.ripristinaSeed();
              }
            }}
          >
            Ripristina i valori di partenza
          </button>
        )}
      </div>

      <p className="nota">
        Giorni lavorativi dall&rsquo;ordine alla consegna. Il valore si può cambiare qui: il ricalcolo è immediato su
        tutte le pagine. Gli articoli di un fornitore non elencato usano{' '}
        <strong>{seed.meta.fornitore_default}</strong>, {seed.meta.lead_time_base} giorni.
      </p>

      <div className="tabella-scorrevole">
        <table className="tabella">
          <thead>
            <tr>
              <th>Fornitore</th>
              <th className="num campo">Consegna (gg lavorativi)</th>
              <th className="num">Articoli</th>
              <th className="num">Di cui sorvegliati</th>
              <th>Da dove viene il dato</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {seed.tempi_consegna.map((t) => {
              const attuale = s.tempi[t.fornitore];
              const cambiato = attuale !== t.giorni;
              const c = conteggi[t.fornitore] ?? { totale: 0, sorvegliati: 0 };
              return (
                <tr key={t.fornitore} className={cambiato ? 'cambiata' : undefined}>
                  <td className="forte">{t.fornitore}</td>
                  <td className="num">
                    <input
                      className="giorni"
                      type="number"
                      min={1}
                      max={60}
                      step={1}
                      value={attuale}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v) && v >= 1 && v <= 60) s.cambiaTempo(t.fornitore, Math.trunc(v));
                      }}
                    />
                    {cambiato && <span className="prima">era {t.giorni}</span>}
                  </td>
                  <td className="num">{formattaIntero(c.totale)}</td>
                  <td className="num">{c.sorvegliati > 0 ? formattaIntero(c.sorvegliati) : '—'}</td>
                  <td className="nota-riga">{t.fonte}</td>
                  <td className="nota-riga">{t.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
