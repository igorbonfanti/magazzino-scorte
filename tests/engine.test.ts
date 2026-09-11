import { describe, expect, it } from 'vitest';
import attesiRaw from './scorte_attesi.json';
import { calcolaParametri, valutaGiacenza } from '../src/engine';
import { articoliDaSeed, seed, statisticheDaSeed, tempiDaSeed } from '../src/seed';
import type { Sede } from '../src/types';

interface RigaAttesa {
  sede: Sede;
  codice: string;
  lead_time: number;
  punto_riordino: number;
  lotto_ordine: number;
  scorta_massima: number;
  scorta_sicurezza: number;
  scorta_media: number;
  valore_medio_cent: number;
}

interface CasoRilevazione {
  sede: Sede;
  codice: string;
  giacenza: number;
  atteso: { stato: 'ORDINA' | 'ok'; da_ordinare: number; giorni_residui: number | null };
}

interface CasoParametri {
  sede: Sede;
  codice: string;
  fornitore: string;
  lead_time: number;
  lotto_minimo: number;
  atteso: {
    punto_riordino: number;
    lotto_ordine: number;
    scorta_massima: number;
    scorta_sicurezza: number;
    scorta_media: number;
    giorni_autonomia: number;
    valore_medio_cent: number;
  };
}

const attesi = attesiRaw as unknown as RigaAttesa[];
const tempi = tempiDaSeed();
const articoli = articoliDaSeed();
const statistiche: Record<Sede, ReturnType<typeof statisticheDaSeed>> = {
  ferraris: statisticheDaSeed('ferraris'),
  spezia: statisticheDaSeed('spezia'),
};

function parametriDi(sede: Sede, codice: string) {
  const stat = statistiche[sede][codice];
  const art = articoli[codice];
  if (!stat || !art) throw new Error(`riga mancante: ${sede} ${codice}`);
  return { par: calcolaParametri(stat, art, tempi), stat, art };
}

describe('test esaustivo su tutte le righe sede-articolo', () => {
  it('copre 1.590 righe (920 Ferraris + 670 Spezia)', () => {
    expect(attesi.length).toBe(1590);
    expect(attesi.filter((r) => r.sede === 'ferraris').length).toBe(920);
    expect(attesi.filter((r) => r.sede === 'spezia').length).toBe(670);
  });

  it('ogni riga coincide esattamente con quella attesa', () => {
    const differenze: string[] = [];
    for (const atteso of attesi) {
      const { par } = parametriDi(atteso.sede, atteso.codice);
      const confronto: Record<string, number> = {
        lead_time: par.leadTime,
        punto_riordino: par.puntoRiordino,
        lotto_ordine: par.lottoOrdine,
        scorta_massima: par.scortaMassima,
        scorta_sicurezza: par.scortaSicurezza,
        scorta_media: par.scortaMedia,
        valore_medio_cent: par.valoreMedioCent,
      };
      for (const [campo, valore] of Object.entries(confronto)) {
        const previsto = atteso[campo as keyof RigaAttesa];
        if (valore !== previsto) {
          differenze.push(`${atteso.sede} ${atteso.codice} ${campo}: ${valore} invece di ${previsto}`);
        }
      }
    }
    expect(differenze).toEqual([]);
  });
});

describe('test di rilevazione', () => {
  const casi = seed.test_rilevazione as unknown as CasoRilevazione[];

  it('sono 35 casi', () => {
    expect(casi.length).toBe(35);
  });

  it('stato, quantita da ordinare e giorni residui coincidono', () => {
    const differenze: string[] = [];
    for (const caso of casi) {
      const { par, stat } = parametriDi(caso.sede, caso.codice);
      const esito = valutaGiacenza(par, stat, caso.giacenza);
      if (esito.stato !== caso.atteso.stato) {
        differenze.push(`${caso.codice} stato ${esito.stato} invece di ${caso.atteso.stato}`);
      }
      if (esito.daOrdinare !== caso.atteso.da_ordinare) {
        differenze.push(`${caso.codice} da ordinare ${esito.daOrdinare} invece di ${caso.atteso.da_ordinare}`);
      }
      if (esito.giorniResidui !== caso.atteso.giorni_residui) {
        differenze.push(`${caso.codice} giorni residui ${esito.giorniResidui} invece di ${caso.atteso.giorni_residui}`);
      }
    }
    expect(differenze).toEqual([]);
  });
});

describe('test puntuali dal file Excel', () => {
  const casi = seed.test_parametri as unknown as CasoParametri[];

  it('Ferraris MALTA: LT 3, lotto minimo 30 -> riordino 219, lotto 330, scorta massima 549', () => {
    const art = articoli['MALTA'];
    expect(art.fornitore).toBe('Laterlite');
    expect(art.lotto_minimo).toBe(30);
    const { par } = parametriDi('ferraris', 'MALTA');
    expect(par.leadTime).toBe(3);
    expect(par.puntoRiordino).toBe(219);
    expect(par.lottoOrdine).toBe(330);
    expect(par.scortaMassima).toBe(549);
  });

  it('i casi di test_parametri tornano tutti', () => {
    const differenze: string[] = [];
    for (const caso of casi) {
      const { par, art } = parametriDi(caso.sede, caso.codice);
      expect(art.fornitore).toBe(caso.fornitore);
      const confronto: Record<string, number> = {
        lead_time: par.leadTime,
        lotto_minimo: par.lottoMinimo,
        punto_riordino: par.puntoRiordino,
        lotto_ordine: par.lottoOrdine,
        scorta_massima: par.scortaMassima,
        scorta_sicurezza: par.scortaSicurezza,
        scorta_media: par.scortaMedia,
        valore_medio_cent: par.valoreMedioCent,
      };
      const previsti: Record<string, number> = {
        lead_time: caso.lead_time,
        lotto_minimo: caso.lotto_minimo,
        punto_riordino: caso.atteso.punto_riordino,
        lotto_ordine: caso.atteso.lotto_ordine,
        scorta_massima: caso.atteso.scorta_massima,
        scorta_sicurezza: caso.atteso.scorta_sicurezza,
        scorta_media: caso.atteso.scorta_media,
        valore_medio_cent: caso.atteso.valore_medio_cent,
      };
      for (const [campo, valore] of Object.entries(confronto)) {
        if (valore !== previsti[campo]) {
          differenze.push(`${caso.sede} ${caso.codice} ${campo}: ${valore} invece di ${previsti[campo]}`);
        }
      }
      const autonomia = Math.round(par.giorniAutonomia * 10) / 10;
      if (Math.abs(autonomia - caso.atteso.giorni_autonomia) > 0.1) {
        differenze.push(
          `${caso.sede} ${caso.codice} giorni_autonomia: ${autonomia} invece di ${caso.atteso.giorni_autonomia}`,
        );
      }
    }
    expect(differenze).toEqual([]);
  });

  it('cambiando i giorni di consegna il riordino segue: Laterlite 3 -> 5 porta MALTA a 276', () => {
    const stat = statistiche.ferraris['MALTA'];
    const art = articoli['MALTA'];
    const conCinque = calcolaParametri(stat, art, { ...tempi, Laterlite: 5 });
    expect(conCinque.leadTime).toBe(5);
    expect(conCinque.puntoRiordino).toBe(276);
    expect(conCinque.lottoOrdine).toBe(330);
  });

  it('un fornitore non in tabella ricade su "altri fornitori" (5 giorni)', () => {
    const stat = statistiche.ferraris['TMAR'];
    const par = calcolaParametri(stat, { ...articoli['TMAR'], fornitore: 'fornitore mai visto' }, tempi);
    expect(par.leadTime).toBe(5);
  });
});

describe('elenco sorvegliato e dati di base', () => {
  it('75 codici sorvegliati, tutti presenti in entrambe le sedi', () => {
    expect(seed.elenco_sorvegliato.length).toBe(75);
    for (const codice of seed.elenco_sorvegliato) {
      expect(articoli[codice], `articolo ${codice}`).toBeDefined();
      expect(statistiche.ferraris[codice], `Ferraris ${codice}`).toBeDefined();
      expect(statistiche.spezia[codice], `Spezia ${codice}`).toBeDefined();
    }
  });

  it('21 fornitori con tempi di consegna, compreso il predefinito', () => {
    expect(seed.tempi_consegna.length).toBe(21);
    expect(tempi['altri fornitori']).toBe(5);
  });

  it('1.063 articoli; gli esclusi non sono sorvegliati', () => {
    expect(seed.articoli.length).toBe(1063);
    for (const escluso of seed.esclusi) {
      expect(seed.elenco_sorvegliato).not.toContain(escluso);
    }
  });

  it('i codici con la barra diventano ID validi per Firestore', () => {
    const conBarra = seed.articoli.filter((a) => a.codice.includes('/'));
    expect(conBarra.length).toBe(34);
    for (const a of conBarra) {
      const id = encodeURIComponent(a.codice);
      expect(id).not.toContain('/');
      expect(decodeURIComponent(id)).toBe(a.codice);
    }
  });
});
