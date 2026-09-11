export type Sede = 'ferraris' | 'spezia';
export type Classe = 'A' | 'B' | 'C';
export type Ruolo = 'admin' | 'operatore';

export interface Articolo {
  /** Codice originale, può contenere "/" (es. TELO25/4). Mai usato come ID Firestore. */
  codice: string;
  descrizione: string;
  um: string;
  fornitore: string;
  /** 0 = nessun lotto minimo */
  lotto_minimo: number;
  lotto_nota: string;
  /** reparto di magazzino, per l'ordine del giro di conteggio */
  tipologia: string;
}

export interface Statistica {
  sede: Sede;
  codice: string;
  classe: Classe;
  ciclo_gg: number;
  /** venduto dei mesi del periodo, serve solo alla sintesi per classe */
  venduto_8m: number;
  cons_sett_medio: number;
  cons_sett_max: number;
  lotto_calcolato: number;
  cons_medio_5gg: number;
  cons_giorno: number;
  /** costo unitario in centesimi interi */
  co3_cent: number;
  nota: string;
  rop_prima_5gg: number;
  rifornimento_da_altra_sede: boolean;
}

export interface TempoConsegna {
  fornitore: string;
  giorni: number;
  fonte: string;
  note: string;
}

/** fornitore -> giorni lavorativi */
export type TempiMap = Record<string, number>;

export interface Parametri {
  lead_time_base: number;
  fornitore_default: string;
  periodo_consumi: string;
  elenco_sorvegliato: string[];
  esclusi: string[];
  aggiornato_il?: string;
}

export type StatoRilevazione = 'bozza' | 'chiusa';

export interface Rilevazione {
  id: string;
  sede: Sede;
  data: string;
  operatore_uid: string;
  operatore_nome: string;
  stato: StatoRilevazione;
  righe: Record<string, number>;
  /**
   * Decisione presa per questo conteggio: prendere la merce dall'altra sede
   * invece di ordinarla. Vale solo per questa rilevazione e ha la precedenza
   * sulla regola fissa dell'articolo.
   */
  trasferimenti?: Record<string, boolean>;
  chiusa_il?: string;
}

export interface Utente {
  nome: string;
  email: string;
  ruolo: Ruolo;
  sede: Sede | null;
}
