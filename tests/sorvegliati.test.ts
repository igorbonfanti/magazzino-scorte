import { describe, expect, it } from 'vitest';
import { applicaForzature, calcolaForzature } from '../src/lib/sorvegliati';

/**
 * Le scelte fatte a mano sull'elenco sorvegliato devono sopravvivere a una
 * nuova importazione. Prima non succedeva: l'importazione riscriveva l'elenco
 * con quello del file e le aggiunte sparivano senza lasciare traccia.
 */
describe('cosa e stato cambiato a mano', () => {
  it('riconosce aggiunte e rimozioni', () => {
    const f = calcolaForzature(['A', 'B', 'C'], ['A', 'C', 'D']);
    expect(f.dentro).toEqual(['D']);
    expect(f.fuori).toEqual(['B']);
  });

  it('nessuna modifica, nessuna forzatura', () => {
    const f = calcolaForzature(['A', 'B'], ['A', 'B']);
    expect(f.dentro).toEqual([]);
    expect(f.fuori).toEqual([]);
  });
});

describe('le forzature si rimettono sopra l elenco nuovo', () => {
  it('l aggiunta resta, la rimozione resta', () => {
    const elenco = applicaForzature(['A', 'B', 'C'], { dentro: ['D'], fuori: ['B'] });
    expect(elenco).toEqual(['A', 'C', 'D']);
  });

  it('senza forzature l elenco e quello del file', () => {
    expect(applicaForzature(['A', 'B'], undefined)).toEqual(['A', 'B']);
    expect(applicaForzature(['A', 'B'], { dentro: [], fuori: [] })).toEqual(['A', 'B']);
  });

  it('un codice sparito dall anagrafica non rientra', () => {
    // MORTO non esiste piu' a listino: rimetterlo darebbe un sorvegliato
    // senza articolo, e le pagine che lo cercano non lo troverebbero
    const elenco = applicaForzature(['A'], { dentro: ['VIVO', 'MORTO'], fuori: [] }, (c) => c !== 'MORTO');
    expect(elenco).toEqual(['A', 'VIVO']);
  });

  it('non duplica un codice che intanto e entrato nella selezione automatica', () => {
    // era stato aggiunto a mano, adesso ci arriva da solo: deve comparire una volta
    const elenco = applicaForzature(['A', 'D'], { dentro: ['D'], fuori: [] });
    expect(elenco).toEqual(['A', 'D']);
  });

  it('un tolto a mano resta fuori anche se il file lo ripropone', () => {
    const elenco = applicaForzature(['A', 'B'], { dentro: [], fuori: ['B'] });
    expect(elenco).toEqual(['A']);
  });

  it('il giro completo: si cambia, si reimporta, si ritrova quello che si era scelto', () => {
    const primaDelCambio = ['A', 'B', 'C'];
    const sceltoAMano = ['A', 'C', 'D'];
    const f = calcolaForzature(primaDelCambio, sceltoAMano);

    // arriva un file nuovo: C non c'e' piu', entra E
    const fileNuovo = ['A', 'B', 'E'];
    expect(applicaForzature(fileNuovo, f)).toEqual(['A', 'E', 'D']);
  });
});
