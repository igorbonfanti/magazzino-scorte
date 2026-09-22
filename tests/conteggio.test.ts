import { describe, expect, it } from 'vitest';
import {
  costruisciCoda,
  descriviConteggio,
  etichettaCollo,
  pezziPerCollo,
  totaleContato,
} from '../src/lib/conteggio';
import { descriviCollo } from '../src/lib/confezioni';
import { articoliDaSeed } from '../src/seed';
import type { SeedFile } from '../src/seed';
// Dati congelati: vedi la nota in engine.test.ts.
import fixtureRaw from './fixture_motore.json';
const seed = fixtureRaw as unknown as SeedFile;

const articoli = articoliDaSeed(seed);

describe('come si legge la nota del lotto', () => {
  it('riconosce il contenitore e cosa contiene', () => {
    expect(descriviCollo('bancale da 30 sacchi')).toEqual({ nome: 'bancale', unita: 'sacchi' });
    expect(descriviCollo('fascio da 16 pezzi')).toEqual({ nome: 'fascio', unita: 'pezzi' });
    expect(descriviCollo('espositore da 12')).toEqual({ nome: 'espositore', unita: null });
    expect(descriviCollo('cartone 18 rotoli + 18 in omaggio')).toEqual({ nome: 'cartone', unita: 'rotoli' });
  });

  it('senza contenitore resta cosa si conta', () => {
    expect(descriviCollo('40 rotoli')).toEqual({ nome: null, unita: 'rotoli' });
    expect(descriviCollo('6 bombole')).toEqual({ nome: null, unita: 'bombole' });
  });

  it('nota vuota o senza informazioni', () => {
    expect(descriviCollo('')).toEqual({ nome: null, unita: null });
    expect(descriviCollo('nessun minimo')).toEqual({ nome: null, unita: null });
  });
});

describe('il totale non si digita: si ricava da colli e sfusi', () => {
  it('10 bancali da 30 più 7 sacchi fanno 307', () => {
    expect(totaleContato({ colli: 10, sfusi: 7, pezziPerCollo: 30 })).toBe(307);
  });

  it('solo colli, solo sfusi, niente', () => {
    expect(totaleContato({ colli: 3, sfusi: 0, pezziPerCollo: 64 })).toBe(192);
    expect(totaleContato({ colli: 0, sfusi: 12, pezziPerCollo: 30 })).toBe(12);
    expect(totaleContato({ colli: 0, sfusi: 0, pezziPerCollo: 30 })).toBe(0);
  });
});

describe('etichetta del tasto grande', () => {
  it('usa il nome del contenitore quando c’è', () => {
    expect(etichettaCollo(articoli['MALTA'])).toBe('1 bancale (30)');
    expect(etichettaCollo(articoli['CAR13'])).toBe('1 bancale (64)');
    expect(etichettaCollo(articoli['SILUNIC'])).toBe('1 espositore (12)');
  });

  it('senza contenitore dice cosa si conta', () => {
    expect(etichettaCollo(articoli['FELGO'])).toBe('40 rotoli');
    expect(etichettaCollo(articoli['BOM15'])).toBe('6 bombole');
  });

  it('senza lotto minimo non c’è tasto: si contano i pezzi', () => {
    expect(articoli['TMAR'].lotto_minimo).toBe(0);
    expect(etichettaCollo(articoli['TMAR'])).toBeNull();
  });

  it('il collo per contare si può staccare dal lotto per ordinare', () => {
    // RETEPVC150 si ordina a 500 mq ma si conta a rotoli da 50
    const rete = articoli['RETEPVC150'];
    expect(rete.lotto_minimo).toBe(500);
    expect(pezziPerCollo(rete)).toBe(500);
    expect(pezziPerCollo({ ...rete, pezzi_per_collo: 50 })).toBe(50);
    expect(etichettaCollo({ ...rete, pezzi_per_collo: 50 })).toBe('50 rotoli');
  });
});

describe('come si racconta il conteggio in corso', () => {
  it('colli al plurale e sfusi', () => {
    expect(descriviConteggio({ colli: 10, sfusi: 7, pezziPerCollo: 30 }, articoli['MALTA'])).toBe(
      '10 bancali da 30 + 7 sfusi',
    );
    expect(descriviConteggio({ colli: 1, sfusi: 0, pezziPerCollo: 30 }, articoli['MALTA'])).toBe('1 bancale da 30');
    expect(descriviConteggio({ colli: 0, sfusi: 4, pezziPerCollo: 30 }, articoli['MALTA'])).toBe('4 sfusi');
    expect(descriviConteggio({ colli: 2, sfusi: 0, pezziPerCollo: 12 }, articoli['SILUNIC'])).toBe(
      '2 espositori da 12',
    );
  });
});

describe('ordine con cui proporre gli articoli', () => {
  const gruppo = ['MALTA', 'SABCEM25', 'ZM136', 'CAR13', 'DF'];

  it('propone i non contati, nell’ordine del gruppo', () => {
    const coda = costruisciCoda(gruppo, new Set(['MALTA']), new Set());
    expect(coda.daContare).toEqual(['SABCEM25', 'ZM136', 'CAR13', 'DF']);
    expect(coda.contati).toBe(1);
    expect(coda.totale).toBe(5);
  });

  it('chi è stato saltato torna in fondo, non sparisce', () => {
    const coda = costruisciCoda(gruppo, new Set(), new Set(['SABCEM25', 'CAR13']));
    expect(coda.daContare).toEqual(['MALTA', 'ZM136', 'DF', 'SABCEM25', 'CAR13']);
  });

  it('contato batte saltato: non lo ripropone', () => {
    const coda = costruisciCoda(gruppo, new Set(['SABCEM25']), new Set(['SABCEM25']));
    expect(coda.daContare).not.toContain('SABCEM25');
    expect(coda.contati).toBe(1);
  });

  it('gruppo finito: coda vuota ma totale invariato', () => {
    const coda = costruisciCoda(gruppo, new Set(gruppo), new Set());
    expect(coda.daContare).toEqual([]);
    expect(coda.contati).toBe(5);
    expect(coda.totale).toBe(5);
  });
});

describe('tutti i 75 sorvegliati sono contabili', () => {
  it('ognuno ha un tasto collo o si conta a pezzi, senza etichette rotte', () => {
    for (const codice of seed.elenco_sorvegliato) {
      const a = articoli[codice];
      const etichetta = etichettaCollo(a);
      if (a.lotto_minimo === 0) {
        expect(etichetta, codice).toBeNull();
      } else {
        expect(etichetta, codice).toMatch(/\S/);
        expect(etichetta, codice).not.toContain('undefined');
        expect(etichetta, codice).not.toContain('null');
      }
    }
  });
});
