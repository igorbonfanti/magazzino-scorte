import { describe, expect, it } from 'vitest';
import { calcolaParametri, valutaGiacenza } from '../src/engine';
import { articoliDaSeed, seed, statisticheDaSeed, tempiDaSeed } from '../src/seed';
import { formattaCent, sommaCent } from '../src/money';
import type { Sede } from '../src/types';

interface CasoRilevazione {
  sede: Sede;
  codice: string;
  giacenza: number;
  atteso: { stato: 'ORDINA' | 'ok'; da_ordinare: number; giorni_residui: number | null };
}

const tempi = tempiDaSeed();
const articoli = articoliDaSeed();
const statistiche = { ferraris: statisticheDaSeed('ferraris'), spezia: statisticheDaSeed('spezia') };
const casi = seed.test_rilevazione as unknown as CasoRilevazione[];

/** L'ordine del giorno di una sede, dalle giacenze contate. */
function ordineDelGiorno(sede: Sede, giacenze: Record<string, number>) {
  return seed.elenco_sorvegliato
    .filter((codice) => giacenze[codice] !== undefined)
    .map((codice) => {
      const stat = statistiche[sede][codice];
      const art = articoli[codice];
      const par = calcolaParametri(stat, art, tempi);
      const esito = valutaGiacenza(par, stat, giacenze[codice]);
      return {
        codice,
        fornitore: art.fornitore,
        giacenza: giacenze[codice],
        riordinaA: par.puntoRiordino,
        daOrdinare: esito.daOrdinare,
        stato: esito.stato,
        daAltraSede: stat.rifornimento_da_altra_sede,
      };
    })
    .filter((r) => r.stato === 'ORDINA');
}

describe('ordine del giorno di Ferraris con le giacenze di prova', () => {
  const giacenze: Record<string, number> = {};
  for (const caso of casi) {
    if (caso.sede === 'ferraris') giacenze[caso.codice] = caso.giacenza;
  }

  const righe = ordineDelGiorno('ferraris', giacenze);

  it('escono esattamente 12 righe da ordinare', () => {
    expect(righe.length).toBe(12);
  });

  it('codice, giacenza, punto di riordino e quantità coincidono', () => {
    const attese = [
      ['SABCEM25', 180, 206, 270],
      ['CAR13', 80, 155, 256],
      ['DF', 576, 1185, 1536],
      ['FELGO', 10, 18, 80],
      ['TOPP', 300, 747, 650],
      ['Y10', 0, 332, 576],
      ['TACK20', 0, 3, 10],
      ['BOM15', 1, 3, 12],
      ['MAT', 264, 269, 528],
      ['SILUNIC', 4, 5, 24],
      ['PORTAI', 20, 60, 100],
      ['SECP', 0, 5, 20],
    ];
    expect(righe.map((r) => [r.codice, r.giacenza, r.riordinaA, r.daOrdinare])).toEqual(attese);
  });

  it('nessuna riga di Ferraris va presa dall’altra sede', () => {
    expect(righe.filter((r) => r.daAltraSede)).toEqual([]);
  });

  it('le righe si raggruppano per fornitore', () => {
    const fornitori = [...new Set(righe.map((r) => r.fornitore))].sort((a, b) => a.localeCompare(b, 'it'));
    expect(fornitori.length).toBeGreaterThan(1);
    for (const f of fornitori) {
      expect(tempi[f] ?? tempi['altri fornitori']).toBeGreaterThan(0);
    }
  });
});

describe('sintesi per sede', () => {
  it('riproduce i totali del foglio SINTESI SEDI', () => {
    const atteso: Record<Sede, Record<string, [number, string, string]>> = {
      // classe: [articoli, giacenza media, picco]
      ferraris: {
        A: [30, '11.573,42', '18.412,99'],
        B: [96, '16.734,77', '23.696,98'],
        C: [794, '40.202,40', '48.391,24'],
      },
      spezia: {
        A: [17, '6.979,96', '11.194,28'],
        B: [51, '11.780,20', '16.372,35'],
        C: [602, '35.592,24', '43.480,14'],
      },
    };

    for (const sede of ['ferraris', 'spezia'] as Sede[]) {
      for (const [classe, [articoliAttesi, mediaAttesa, piccoAtteso]] of Object.entries(atteso[sede])) {
        const righe = Object.values(statistiche[sede]).filter((s) => s.classe === classe);
        const par = righe.map((s) => calcolaParametri(s, articoli[s.codice], tempi));
        expect(righe.length, `${sede} ${classe} articoli`).toBe(articoliAttesi);
        expect(formattaCent(sommaCent(par.map((p) => p.valoreMedioCent))), `${sede} ${classe} media`).toBe(mediaAttesa);
        expect(
          formattaCent(sommaCent(par.map((p, i) => p.scortaMassima * righe[i].co3_cent))),
          `${sede} ${classe} picco`,
        ).toBe(piccoAtteso);
      }
    }
  });
});
