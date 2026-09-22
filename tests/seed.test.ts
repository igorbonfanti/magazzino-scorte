import { describe, expect, it } from 'vitest';
import { calcolaParametri, valutaGiacenza } from '../src/engine';
import { articoliDaSeed, seed, statisticheDaSeed, tempiDaSeed } from '../src/seed';
import { idCodice, idStatistica } from '../src/lib/firebase';
import type { Sede } from '../src/types';

/**
 * Il seed VIVO, quello che l'app importa.
 *
 * Qui non ci sono numeri scritti a mano: ci sono le proprieta' che devono
 * valere comunque, oggi e fra due mesi con dati rielaborati. I numeri fissi
 * stanno in engine.test.ts, contro una fixture congelata.
 *
 * Il perche' della divisione: il seed cambia a ogni rielaborazione dei
 * consumi. Se i test del motore leggessero da qui, diventerebbero rossi a ogni
 * giro senza che il motore sia cambiato; e riallinearli ai numeri nuovi li
 * renderebbe una verifica di se stessi.
 */
const SEDI: Sede[] = ['ferraris', 'spezia'];
const tempi = tempiDaSeed();
const articoli = articoliDaSeed();
const statistiche: Record<Sede, ReturnType<typeof statisticheDaSeed>> = {
  ferraris: statisticheDaSeed('ferraris'),
  spezia: statisticheDaSeed('spezia'),
};

describe('il seed e ben formato', () => {
  it('ogni statistica ha il suo articolo in anagrafica', () => {
    const orfane: string[] = [];
    for (const sede of SEDI) {
      for (const codice of Object.keys(statistiche[sede])) {
        if (!articoli[codice]) orfane.push(`${sede} ${codice}`);
      }
    }
    expect(orfane).toEqual([]);
  });

  it('ogni sorvegliato esiste in ENTRAMBE le sedi', () => {
    const mancanti: string[] = [];
    for (const codice of seed.elenco_sorvegliato) {
      if (!articoli[codice]) mancanti.push(`${codice}: non in anagrafica`);
      for (const sede of SEDI) {
        if (!statistiche[sede][codice]) mancanti.push(`${codice}: manca a ${sede}`);
      }
    }
    expect(mancanti).toEqual([]);
  });

  it('gli esclusi non sono sorvegliati', () => {
    const doppi = seed.esclusi.filter((c) => seed.elenco_sorvegliato.includes(c));
    expect(doppi).toEqual([]);
  });

  it('i costi sono centesimi interi, mai virgola mobile', () => {
    const rotti: string[] = [];
    for (const sede of SEDI) {
      for (const s of Object.values(statistiche[sede])) {
        if (!Number.isInteger(s.co3_cent)) rotti.push(`${sede} ${s.codice}: ${s.co3_cent}`);
      }
    }
    expect(rotti).toEqual([]);
  });

  it('classe e ciclo sono fra quelli ammessi e vanno d accordo', () => {
    const cicli: Record<string, number> = { A: 15, B: 30, C: 90 };
    const rotti: string[] = [];
    for (const sede of SEDI) {
      for (const s of Object.values(statistiche[sede])) {
        if (!['A', 'B', 'C'].includes(s.classe)) rotti.push(`${sede} ${s.codice}: classe ${s.classe}`);
        else if (s.ciclo_gg !== cicli[s.classe]) {
          rotti.push(`${sede} ${s.codice}: classe ${s.classe} con ciclo ${s.ciclo_gg}`);
        }
      }
    }
    expect(rotti).toEqual([]);
  });

  it('i codici diventano ID Firestore validi e distinti', () => {
    const visti = new Map<string, string>();
    const rotti: string[] = [];
    for (const a of seed.articoli) {
      const id = idCodice(a.codice);
      if (id.includes('/')) rotti.push(`${a.codice}: l ID contiene una barra`);
      if (decodeURIComponent(id) !== a.codice) rotti.push(`${a.codice}: non torna indietro`);
      if (id === '.' || id === '..' || /^__.*__$/.test(id)) rotti.push(`${a.codice}: ID riservato`);
      const gia = visti.get(id);
      if (gia !== undefined) rotti.push(`${a.codice} e ${gia}: stesso ID ${id}`);
      visti.set(id, a.codice);
    }
    expect(rotti).toEqual([]);
    // la barra c'e' davvero: se sparisse, questo controllo non proverebbe piu' niente
    expect(seed.articoli.filter((a) => a.codice.includes('/')).length).toBeGreaterThan(0);
  });

  it('gli ID delle statistiche non collidono fra sedi', () => {
    const visti = new Set<string>();
    const doppi: string[] = [];
    for (const sede of SEDI) {
      for (const codice of Object.keys(statistiche[sede])) {
        const id = idStatistica(sede, codice);
        if (visti.has(id)) doppi.push(id);
        visti.add(id);
      }
    }
    expect(doppi).toEqual([]);
  });

  it('ogni articolo ha un fornitore con un tempo di consegna noto', () => {
    const senza = new Set<string>();
    for (const codice of seed.elenco_sorvegliato) {
      const f = articoli[codice].fornitore;
      if (tempi[f] === undefined && f !== seed.meta.fornitore_default) senza.add(f);
    }
    expect([...senza]).toEqual([]);
  });
});

describe('i casi di verifica del seed tornano col motore', () => {
  it('test_parametri', () => {
    const casi = seed.test_parametri as unknown as Array<{
      sede: Sede; codice: string; lead_time: number;
      atteso: Record<string, number>;
    }>;
    expect(casi.length).toBeGreaterThan(0);
    const differenze: string[] = [];
    for (const caso of casi) {
      const par = calcolaParametri(statistiche[caso.sede][caso.codice], articoli[caso.codice], tempi);
      const ottenuto: Record<string, number> = {
        punto_riordino: par.puntoRiordino,
        lotto_ordine: par.lottoOrdine,
        scorta_massima: par.scortaMassima,
        scorta_sicurezza: par.scortaSicurezza,
        scorta_media: par.scortaMedia,
        valore_medio_cent: par.valoreMedioCent,
      };
      expect(par.leadTime).toBe(caso.lead_time);
      for (const [campo, valore] of Object.entries(ottenuto)) {
        if (valore !== caso.atteso[campo]) {
          differenze.push(`${caso.sede} ${caso.codice} ${campo}: ${valore} invece di ${caso.atteso[campo]}`);
        }
      }
    }
    expect(differenze).toEqual([]);
  });

  it('test_rilevazione', () => {
    const casi = seed.test_rilevazione as unknown as Array<{
      sede: Sede; codice: string; giacenza: number;
      atteso: { stato: 'ORDINA' | 'ok'; da_ordinare: number; giorni_residui: number | null };
    }>;
    expect(casi.length).toBeGreaterThan(0);
    const differenze: string[] = [];
    for (const caso of casi) {
      const stat = statistiche[caso.sede][caso.codice];
      const par = calcolaParametri(stat, articoli[caso.codice], tempi);
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
