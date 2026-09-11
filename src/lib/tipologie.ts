import type { Articolo } from '../types';

/**
 * Tipologia di materiale: serve a raggruppare gli articoli per come stanno in
 * magazzino, così chi conta fa un giro solo invece di saltare da una corsia
 * all'altra. Non arriva dal seed: è una classificazione di comodo, con un
 * primo assegnamento fatto sulle descrizioni e poi correggibile a mano
 * nella pagina "Articoli e lotti".
 */
export const TIPOLOGIE = [
  'Sacchi e premiscelati',
  'Laterizi e blocchi',
  'Cartongesso e profili',
  'Colle e rasanti',
  'Sigillanti e schiume',
  'Ferramenta e utensili',
  'Imballaggi e protezione',
  'Legno e serramenti',
  'Tubi e impianti',
  'Varie',
] as const;

export type Tipologia = (typeof TIPOLOGIE)[number];

export const SENZA_TIPOLOGIA: Tipologia = 'Varie';

/** Assegnazione esplicita per gli articoli del prontuario. */
const PER_CODICE: Record<string, Tipologia> = {
  // sacchi: malte, intonaci, colle in polvere, cementi rapidi
  MALTA: 'Sacchi e premiscelati',
  SABCEM25: 'Sacchi e premiscelati',
  ZM136: 'Sacchi e premiscelati',
  Z161: 'Sacchi e premiscelati',
  CLS25: 'Sacchi e premiscelati',
  LAMP25: 'Sacchi e premiscelati',
  TOPP: 'Sacchi e premiscelati',
  'KC1-30': 'Sacchi e premiscelati',
  KD2: 'Sacchi e premiscelati',
  LAMPO5: 'Sacchi e premiscelati',
  STA25: 'Sacchi e premiscelati',
  KERAEXB: 'Colle e rasanti',

  // piazzale
  DF: 'Laterizi e blocchi',
  '3F': 'Laterizi e blocchi',
  '4F': 'Laterizi e blocchi',
  MAT: 'Laterizi e blocchi',
  VOLT: 'Laterizi e blocchi',
  Y10: 'Laterizi e blocchi',
  TMAR: 'Laterizi e blocchi',

  // corsia cartongesso
  CAR13: 'Cartongesso e profili',
  CARIDRO: 'Cartongesso e profili',
  MON2: 'Cartongesso e profili',
  MON5: 'Cartongesso e profili',
  MON7: 'Cartongesso e profili',
  GUI2: 'Cartongesso e profili',
  GUI5: 'Cartongesso e profili',
  GUI7: 'Cartongesso e profili',
  STUGES: 'Cartongesso e profili',
  STUGESKNAUF: 'Cartongesso e profili',
  PARACG: 'Cartongesso e profili',
  VELO90: 'Cartongesso e profili',
  RETEPVC150: 'Cartongesso e profili',

  // colle e rasanti pronti
  H40NLB: 'Colle e rasanti',
  H40NLG: 'Colle e rasanti',
  BIOFLEX: 'Colle e rasanti',
  RASOTOPB: 'Colle e rasanti',
  BLOCK: 'Colle e rasanti',
  ECOPRI: 'Colle e rasanti',
  DISLIVMAPEI: 'Colle e rasanti',

  // cartucce, latte, bombolette
  SIL: 'Sigillanti e schiume',
  SILLA: 'Sigillanti e schiume',
  SILUNIC: 'Sigillanti e schiume',
  SILV: 'Sigillanti e schiume',
  '81249': 'Sigillanti e schiume',
  '85222001': 'Sigillanti e schiume',
  BOMBS: 'Sigillanti e schiume',
  TACK20: 'Sigillanti e schiume',
  UNO5: 'Sigillanti e schiume',
  SIKAREP: 'Sigillanti e schiume',
  BOM15: 'Sigillanti e schiume',

  // banco ferramenta
  DFM15: 'Ferramenta e utensili',
  DFM11: 'Ferramenta e utensili',
  AKF202M: 'Ferramenta e utensili',
  '80912': 'Ferramenta e utensili',
  FRASPU: 'Ferramenta e utensili',
  RULS: 'Ferramenta e utensili',
  PEN70C: 'Ferramenta e utensili',
  SEC: 'Ferramenta e utensili',
  SECP: 'Ferramenta e utensili',
  PORTAI: 'Ferramenta e utensili',

  // teli, sacchi, nastri
  FELGO: 'Imballaggi e protezione',
  'TELO25/4': 'Imballaggi e protezione',
  SCO: 'Imballaggi e protezione',
  SCOS: 'Imballaggi e protezione',
  SPAZZ: 'Imballaggi e protezione',
  SPAZZNE: 'Imballaggi e protezione',
  SPAZZTR: 'Imballaggi e protezione',
  CARTON50: 'Imballaggi e protezione',
  POLIEF40: 'Imballaggi e protezione',
  GUAGRI: 'Imballaggi e protezione',

  FODE: 'Legno e serramenti',
  FALTE: 'Legno e serramenti',

  AC10ML: 'Tubi e impianti',
  AC12ML: 'Tubi e impianti',
  '503': 'Tubi e impianti',
  '503CART': 'Tubi e impianti',
};

/** Parole nella descrizione che indicano il reparto, per tutto il resto del listino. */
const PER_PAROLA: [RegExp, Tipologia][] = [
  [/CARTONGESS|MONTANT|GUIDE CART|PARASPIGOL|VELOVETRO|STUCCO/i, 'Cartongesso e profili'],
  [/FORI|MATTON|BLOCCH|YTONG|TEGOL|VOLTIN|COPPO|TAVELL/i, 'Laterizi e blocchi'],
  [/COLLA|RASANT|ADESIV|PRIMER|INTONAC|MALTA|CEMENT|CALCE|GESSO|STABILITUR|MASSETT/i, 'Sacchi e premiscelati'],
  [/SILICON|SCHIUMA|SIGILL|MASTIC|GUAINA|BITUM|POLIURETAN/i, 'Sigillanti e schiume'],
  [/DISCH|PUNTA|TASSELL|VITE|CUTTER|PENNELL|RULL|FRATASS|SECCHI|CAZZUOL|MARTELL|LAMA|CHIAVE/i, 'Ferramenta e utensili'],
  [/TELO|SACCHI|SCOTCH|NASTRO|CARTONE|POLIETILEN|GUANT|FELTRO|PELLICOL/i, 'Imballaggi e protezione'],
  [/LEGNO|ABETE|FODERE|FALSITELA|TAVOL|LISTELL|COMPENSAT/i, 'Legno e serramenti'],
  [/TUBO|SCATOLETT|CURVA|RACCORD|POZZETT|GRIGLIA|SIFON|CANAL/i, 'Tubi e impianti'],
  [/PANNELL|ISOLANT|POLISTIR|LANA DI|RETE/i, 'Cartongesso e profili'],
];

/** Tipologia di partenza, prima che qualcuno la corregga a mano. */
export function tipologiaPredefinita(articolo: Pick<Articolo, 'codice' | 'descrizione'>): Tipologia {
  const esplicita = PER_CODICE[articolo.codice];
  if (esplicita) return esplicita;
  for (const [parola, tipologia] of PER_PAROLA) {
    if (parola.test(articolo.descrizione)) return tipologia;
  }
  return SENZA_TIPOLOGIA;
}

/** Ordine con cui stampare i gruppi: quello del giro di magazzino. */
export function ordineTipologia(t: string): number {
  const i = (TIPOLOGIE as readonly string[]).indexOf(t);
  return i < 0 ? TIPOLOGIE.length : i;
}
