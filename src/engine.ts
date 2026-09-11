/**
 * Motore di calcolo delle scorte — funzioni pure, nessuna dipendenza da Firebase.
 *
 * I consumi (medie, picchi, classi, cicli) NON si calcolano qui: arrivano già
 * pronti dal seed, elaborati sui movimenti gennaio–agosto 2026. Qui si calcola
 * solo ciò che dipende dai parametri modificabili: punto di riordino, lotto
 * d'ordine, scorte e quantità da ordinare.
 */
import type { Articolo, Classe, Statistica, TempiMap } from './types';

export const FORNITORE_DEFAULT = 'altri fornitori';
export const LEAD_TIME_BASE = 5;

/** Tutti i valori in gioco sono positivi: metà per eccesso. */
export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

/** Taglia l'errore di virgola mobile alla sesta cifra decimale. */
export function round6(x: number): number {
  return Math.floor(x * 1e6 + 0.5) / 1e6;
}

/** Giorni lavorativi di consegna del fornitore dell'articolo. */
export function leadTime(articolo: Pick<Articolo, 'fornitore'>, tempi: TempiMap): number {
  return tempi[articolo.fornitore] ?? tempi[FORNITORE_DEFAULT] ?? LEAD_TIME_BASE;
}

export interface Parametri {
  /** giorni lavorativi di consegna usati nel calcolo */
  leadTime: number;
  /** giacenza alla quale bisogna riordinare */
  puntoRiordino: number;
  scortaSicurezza: number;
  /** quantità d'ordine, già portata al multiplo del lotto minimo */
  lottoOrdine: number;
  scortaMassima: number;
  scortaMedia: number;
  /** giorni coperti dalla scorta media (da mostrare arrotondato all'intero) */
  giorniAutonomia: number;
  /** valore della scorta media, in centesimi interi */
  valoreMedioCent: number;
  /** ogni quanto si ordina, dal ciclo dell'articolo */
  ogniQuanto: string;
  classe: Classe;
  lottoMinimo: number;
}

const CICLI: Record<number, string> = {
  15: 'ogni 2 settimane',
  30: 'una volta al mese',
  90: 'ogni 3 mesi',
};

export function ogniQuanto(cicloGg: number): string {
  return CICLI[cicloGg] ?? `ogni ${cicloGg} giorni`;
}

/**
 * Punto di riordino.
 *
 * Con 5 giorni di consegna è il consumo della settimana più alta. Con un tempo
 * diverso si prende il più prudente fra due calcoli: la settimana di punta
 * scalata in proporzione, oppure la settimana di punta più o meno i giorni di
 * differenza a consumo medio.
 */
export function puntoRiordino(stat: Pick<Statistica, 'cons_sett_medio' | 'cons_sett_max'>, lt: number): number {
  const F = stat.cons_sett_medio;
  const G = stat.cons_sett_max;
  return Math.ceil(round6(Math.max((G * lt) / 5, G + (F * (lt - 5)) / 5)));
}

/** Lotto d'ordine: il lotto calcolato, portato al multiplo del lotto minimo. */
export function lottoOrdine(lottoCalcolato: number, lottoMinimo: number): number {
  const LM = lottoMinimo || 0;
  if (LM <= 0) return lottoCalcolato;
  return Math.max(LM, Math.ceil(lottoCalcolato / LM) * LM);
}

/** Tutti i parametri di una riga sede-articolo. */
export function calcolaParametri(stat: Statistica, articolo: Articolo, tempi: TempiMap): Parametri {
  const lt = leadTime(articolo, tempi);
  const V = stat.cons_medio_5gg;
  const W = stat.cons_giorno;
  const LM = articolo.lotto_minimo || 0;

  const pr = puntoRiordino(stat, lt);
  const ss = Math.max(0, roundHalfUp(pr - (V * lt) / 5));
  const lo = lottoOrdine(stat.lotto_calcolato, LM);
  const sMax = pr + lo;
  const sMed = ss + Math.ceil(lo / 2);

  return {
    leadTime: lt,
    puntoRiordino: pr,
    scortaSicurezza: ss,
    lottoOrdine: lo,
    scortaMassima: sMax,
    scortaMedia: sMed,
    giorniAutonomia: W > 0 ? sMed / W : 0,
    valoreMedioCent: sMed * stat.co3_cent,
    ogniQuanto: ogniQuanto(stat.ciclo_gg),
    classe: stat.classe,
    lottoMinimo: LM,
  };
}

export type Stato = 'ORDINA' | 'ok';

export interface EsitoRilevazione {
  stato: Stato;
  daOrdinare: number;
  /** null quando l'articolo non ha consumo giornaliero */
  giorniResidui: number | null;
}

/** Esito della rilevazione per una giacenza contata. */
export function valutaGiacenza(par: Parametri, stat: Pick<Statistica, 'cons_giorno'>, giacenza: number): EsitoRilevazione {
  const LM = par.lottoMinimo || 0;
  const W = stat.cons_giorno;
  const stato: Stato = giacenza <= par.puntoRiordino ? 'ORDINA' : 'ok';
  const grezzo = Math.max(par.lottoOrdine, par.scortaMassima - giacenza);
  const daOrdinare = stato === 'ORDINA' ? (LM > 0 ? Math.ceil(grezzo / LM) * LM : grezzo) : 0;
  return {
    stato,
    daOrdinare,
    giorniResidui: W > 0 ? roundHalfUp(giacenza / W) : null,
  };
}

/**
 * Colori delle righe per classe. A schermo li applica il CSS, con le variabili
 * --classe-a/b/c: nel tema scuro diventano le versioni scure degli stessi toni,
 * mentre in stampa tornano sempre questi. Qui restano come riferimento e per
 * chi esporta i dati altrove.
 */
export const COLORI_CLASSE: Record<Classe, string> = {
  A: '#E3F0E8',
  B: '#FBF3DC',
  C: '#EFEFEF',
};
