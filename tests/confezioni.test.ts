import { describe, expect, it } from 'vitest';
import { contaColli } from '../src/lib/confezioni';
import { calcolaParametri, valutaGiacenza } from '../src/engine';
import { articoliDaSeed, statisticheDaSeed, tempiDaSeed } from '../src/seed';
import type { SeedFile } from '../src/seed';
// Il motore si verifica contro dati CONGELATI, non contro il seed vivo.
// La fixture e' il seed dell'elaborazione di settembre 2026, con le sue 1.590
// righe attese: cosi' questi test restano una verifica indipendente del motore
// anche quando i consumi vengono rielaborati. Se puntassero al seed dell'app,
// a ogni rigenerazione diventerebbero rossi senza che il motore sia cambiato,
// e riallinearli li trasformerebbe in una verifica di se stessi.
import fixtureRaw from './fixture_motore.json';
import type { Sede } from '../src/types';

describe('da quantità a colli', () => {
  it('contenitore nominato nella nota: si contano i contenitori', () => {
    expect(contaColli(1536, 192, 'bancale da 192 pezzi').testo).toBe('8 bancali');
    expect(contaColli(192, 192, 'bancale da 192 pezzi').testo).toBe('1 bancale');
    expect(contaColli(24, 12, 'espositore da 12').testo).toBe('2 espositori');
    expect(contaColli(48, 16, 'fascio da 16 pezzi').testo).toBe('3 fasci');
    expect(contaColli(24, 12, 'scatola da 12 sacchetti').testo).toBe('2 scatole');
    // "cartone 18 rotoli + 18 in omaggio", lotto minimo 36
    expect(contaColli(72, 36, 'cartone 18 rotoli + 18 in omaggio').testo).toBe('2 cartoni');
  });

  it('nota senza contenitore: quante volte quel lotto', () => {
    expect(contaColli(80, 40, '40 rotoli').testo).toBe('2 × 40 rotoli');
    expect(contaColli(10, 5, '5 latte').testo).toBe('2 × 5 latte');
    expect(contaColli(12, 6, '6 bombole').testo).toBe('2 × 6 bombole');
    expect(contaColli(100, 50, '50 pezzi').testo).toBe('2 × 50 pezzi');
    // una volta sola: senza moltiplicatore
    expect(contaColli(40, 40, '40 rotoli').testo).toBe('40 rotoli');
  });

  it('nota che non torna con il lotto minimo: forma neutra, niente invenzioni', () => {
    // "40 pezzi per misura", ma il lotto minimo è 50
    expect(contaColli(100, 50, '40 pezzi per misura (40 x 1,25 m = 50 m)').testo).toBe('2 × 50');
    expect(contaColli(60, 30, '').testo).toBe('2 × 30');
  });

  it('senza lotto minimo non ci sono colli', () => {
    expect(contaColli(120, 0, 'nessun minimo')).toEqual({ quanti: null, testo: '—' });
  });

  it('i colli sono sempre un numero intero: la quantità è un multiplo del lotto', () => {
    const seed = fixtureRaw as unknown as SeedFile;
    const tempi = tempiDaSeed(seed);
    const articoli = articoliDaSeed(seed);
    const statistiche = { ferraris: statisticheDaSeed('ferraris', seed), spezia: statisticheDaSeed('spezia', seed) };
    const casi = seed.test_rilevazione as unknown as { sede: Sede; codice: string; giacenza: number }[];

    for (const caso of casi) {
      const stat = statistiche[caso.sede][caso.codice];
      const art = articoli[caso.codice];
      const par = calcolaParametri(stat, art, tempi);
      const esito = valutaGiacenza(par, stat, caso.giacenza);
      if (esito.daOrdinare === 0 || par.lottoMinimo === 0) continue;
      expect(esito.daOrdinare % par.lottoMinimo, `${caso.codice} non è multiplo del lotto`).toBe(0);
      const colli = contaColli(esito.daOrdinare, par.lottoMinimo, art.lotto_nota);
      expect(colli.quanti).toBe(esito.daOrdinare / par.lottoMinimo);
    }
  });

  it('le 12 righe dell’ordine di Ferraris in colli', () => {
    const seed = fixtureRaw as unknown as SeedFile;
    const tempi = tempiDaSeed(seed);
    const articoli = articoliDaSeed(seed);
    const stat = statisticheDaSeed('ferraris', seed);
    const casi = seed.test_rilevazione as unknown as { sede: Sede; codice: string; giacenza: number }[];
    const giacenze: Record<string, number> = {};
    for (const c of casi) if (c.sede === 'ferraris') giacenze[c.codice] = c.giacenza;

    const colli = seed.elenco_sorvegliato
      .filter((codice) => giacenze[codice] !== undefined)
      .map((codice) => {
        const par = calcolaParametri(stat[codice], articoli[codice], tempi);
        const esito = valutaGiacenza(par, stat[codice], giacenze[codice]);
        return { codice, esito, par, nota: articoli[codice].lotto_nota };
      })
      .filter((r) => r.esito.stato === 'ORDINA')
      .map((r) => [r.codice, contaColli(r.esito.daOrdinare, r.par.lottoMinimo, r.nota).testo]);

    expect(colli).toEqual([
      ['SABCEM25', '9 bancali'],
      ['CAR13', '4 bancali'],
      ['DF', '8 bancali'],
      ['FELGO', '2 × 40 rotoli'],
      ['TOPP', '13 bancali'],
      ['Y10', '8 bancali'],
      ['TACK20', '2 × 5 latte'],
      ['BOM15', '2 × 6 bombole'],
      ['MAT', '2 bancali'],
      ['SILUNIC', '2 espositori'],
      ['PORTAI', '2 × 50 pezzi'],
      ['SECP', '2 × 10 pezzi'],
    ]);
  });
});
