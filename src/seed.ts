/**
 * Lettura del file seed (consumi già elaborati) e trasformazione nelle forme
 * usate dall'app e dai test. Nessun ricalcolo di medie, picchi, classi o cicli.
 */
import seedRaw from './data/scorte_seed.json';
import type { Articolo, Sede, Statistica, TempiMap, TempoConsegna } from './types';
import { tipologiaPredefinita } from './lib/tipologie';

interface StatisticaSeed {
  classe: Statistica['classe'];
  ciclo_gg: number;
  venduto_8m: number;
  cons_sett_medio: number;
  cons_sett_max: number;
  picco_su_media: number;
  giorni_con_uscite: number;
  lotto_calcolato: number;
  cons_medio_5gg: number;
  cons_giorno: number;
  co3_cent: number;
  nota: string;
  rop_prima_5gg: number;
  rifornimento_da_altra_sede: boolean;
}

export interface SeedFile {
  meta: {
    generato: string;
    periodo_consumi: string;
    fonte: string;
    lead_time_base: number;
    fornitore_default: string;
  };
  tempi_consegna: TempoConsegna[];
  articoli: Omit<Articolo, 'tipologia' | 'pezzi_per_collo'>[];
  sedi: Record<Sede, { nome: string; articoli: Record<string, StatisticaSeed> }>;
  elenco_sorvegliato: string[];
  esclusi: string[];
  candidati_rifornimento_da_ferraris_spezia: string[];
  test_parametri: unknown[];
  test_rilevazione: unknown[];
}

export const seed = seedRaw as unknown as SeedFile;

export const NOMI_SEDI: Record<Sede, string> = {
  ferraris: seed.sedi.ferraris.nome,
  spezia: seed.sedi.spezia.nome,
};

export const SEDI: Sede[] = ['ferraris', 'spezia'];

export function tempiDaSeed(): TempiMap {
  const out: TempiMap = {};
  for (const t of seed.tempi_consegna) out[t.fornitore] = t.giorni;
  return out;
}

export function articoliDaSeed(): Record<string, Articolo> {
  const out: Record<string, Articolo> = {};
  for (const a of seed.articoli) {
    // contando, di norma un collo vale un lotto minimo: dove non torna si
    // corregge a mano in "Articoli e lotti"
    out[a.codice] = { ...a, tipologia: tipologiaPredefinita(a), pezzi_per_collo: a.lotto_minimo };
  }
  return out;
}

export function statisticheDaSeed(sede: Sede): Record<string, Statistica> {
  const out: Record<string, Statistica> = {};
  for (const [codice, s] of Object.entries(seed.sedi[sede].articoli)) {
    out[codice] = {
      sede,
      codice,
      classe: s.classe,
      ciclo_gg: s.ciclo_gg,
      venduto_8m: s.venduto_8m,
      cons_sett_medio: s.cons_sett_medio,
      cons_sett_max: s.cons_sett_max,
      lotto_calcolato: s.lotto_calcolato,
      cons_medio_5gg: s.cons_medio_5gg,
      cons_giorno: s.cons_giorno,
      co3_cent: s.co3_cent,
      nota: s.nota,
      rop_prima_5gg: s.rop_prima_5gg,
      rifornimento_da_altra_sede: s.rifornimento_da_altra_sede,
    };
  }
  return out;
}

/** ID documento Firestore: i codici con "/" non sono ammessi negli ID. */
export function idCodice(codice: string): string {
  return encodeURIComponent(codice);
}
