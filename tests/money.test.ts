import { describe, expect, it } from 'vitest';
import { euroACent, formattaCent, formattaDecimale, formattaEuro, formattaIntero, moltiplicaCent, sommaCent } from '../src/money';
import { articoliDaSeed, statisticheDaSeed, tempiDaSeed } from '../src/seed';
import { calcolaParametri } from '../src/engine';

describe('importi in centesimi interi', () => {
  it('somma e moltiplica senza virgola mobile', () => {
    expect(sommaCent([77848, 70221, 96720])).toBe(244789);
    expect(moltiplicaCent(296, 263)).toBe(77848);
    // il classico 0.1 + 0.2 non deve capitare mai
    expect(sommaCent([10, 20])).toBe(30);
  });

  it('formatta con separatore delle migliaia italiano', () => {
    expect(formattaIntero(1185)).toBe('1.185');
    expect(formattaIntero(68510)).toBe('68.510');
    expect(formattaIntero(999)).toBe('999');
    expect(formattaCent(6851059)).toBe('68.510,59');
    expect(formattaEuro(77848)).toBe('778,48 €');
    expect(formattaDecimale(14.24)).toBe('14,2');
  });

  it('legge gli euro digitati dall amministratore', () => {
    expect(euroACent('778,48')).toBe(77848);
    expect(euroACent('1.185,00')).toBe(118500);
    expect(euroACent('12')).toBe(1200);
    expect(euroACent('abc')).toBeNull();
  });
});

describe('totali di scorta media per sede', () => {
  const tempi = tempiDaSeed();
  const articoli = articoliDaSeed();

  function totaleCent(sede: 'ferraris' | 'spezia'): number {
    const stat = statisticheDaSeed(sede);
    return sommaCent(Object.values(stat).map((s) => calcolaParametri(s, articoli[s.codice], tempi).valoreMedioCent));
  }

  it('Ferraris 68.510,59 € e Spezia 54.352,40 €', () => {
    expect(formattaCent(totaleCent('ferraris'))).toBe('68.510,59');
    expect(formattaCent(totaleCent('spezia'))).toBe('54.352,40');
  });
});
