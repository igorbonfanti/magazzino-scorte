import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { calcolaParametri } from './engine';
import type { Parametri } from './engine';
import { articoliDaSeed, seed, statisticheDaSeed, tempiDaSeed } from './seed';
import type { Articolo, Rilevazione, Sede, Statistica, TempiMap } from './types';

/**
 * Stato dell'applicazione.
 *
 * Le statistiche di consumo arrivano dal seed e non si toccano. Quello che
 * l'amministratore può cambiare — tempi di consegna, fornitore, lotto minimo,
 * elenco sorvegliato, rifornimento da altra sede — viene tenuto qui come
 * scostamento dal seed e salvato nel browser.
 *
 * In Fase 2 questo modulo diventa il punto unico da riscrivere su Firestore:
 * le pagine non sanno da dove arrivano i dati.
 */

const CHIAVE = 'scorte.v1';

interface ModificheArticolo {
  fornitore?: string;
  lotto_minimo?: number;
  lotto_nota?: string;
  tipologia?: string;
}

interface StatoSalvato {
  tempi: Record<string, number>;
  articoli: Record<string, ModificheArticolo>;
  /** chiave `${sede}|${codice}` */
  rifornimenti: Record<string, boolean>;
  sorvegliati: string[] | null;
  rilevazioni: Rilevazione[];
  sedeCorrente: Sede;
}

const VUOTO: StatoSalvato = {
  tempi: {},
  articoli: {},
  rifornimenti: {},
  sorvegliati: null,
  rilevazioni: [],
  sedeCorrente: 'ferraris',
};

function leggiSalvato(): StatoSalvato {
  try {
    const grezzo = localStorage.getItem(CHIAVE);
    if (!grezzo) return VUOTO;
    return { ...VUOTO, ...(JSON.parse(grezzo) as Partial<StatoSalvato>) };
  } catch {
    return VUOTO;
  }
}

interface Contesto {
  sede: Sede;
  cambiaSede: (sede: Sede) => void;

  tempi: TempiMap;
  articoli: Record<string, Articolo>;
  sorvegliati: string[];
  rilevazioni: Rilevazione[];

  statistiche: (sede: Sede) => Record<string, Statistica>;
  statistica: (sede: Sede, codice: string) => Statistica | undefined;
  parametri: (sede: Sede, codice: string) => Parametri | undefined;
  /** parametri con i 5 giorni uguali per tutti, come prima dell'11 settembre */
  parametriPrima: (sede: Sede, codice: string) => Parametri | undefined;

  cambiaTempo: (fornitore: string, giorni: number) => void;
  cambiaArticolo: (codice: string, modifiche: ModificheArticolo) => void;
  cambiaRifornimento: (sede: Sede, codice: string, da: boolean) => void;
  aggiungiSorvegliato: (codice: string) => void;
  togliSorvegliato: (codice: string) => void;
  spostaSorvegliato: (codice: string, verso: -1 | 1) => void;

  rilevazioneAperta: (sede: Sede) => Rilevazione | undefined;
  apriRilevazione: (sede: Sede) => Rilevazione;
  scriviGiacenza: (id: string, codice: string, giacenza: number | null) => void;
  /** l'ultima giacenza contata per quell'articolo in quella sede */
  ultimaGiacenza: (sede: Sede, codice: string) => UltimaGiacenza | undefined;
  /** decisione di trasferimento valida solo per quella rilevazione */
  cambiaTrasferimento: (id: string, codice: string, dallAltraSede: boolean) => void;
  /** se per questo conteggio l'articolo si prende dall'altra sede */
  siTrasferisce: (rilevazione: Rilevazione, codice: string) => boolean;
  chiudiRilevazione: (id: string) => void;
  eliminaRilevazione: (id: string) => void;

  modificato: boolean;
  ripristinaSeed: () => void;
}

export interface UltimaGiacenza {
  giacenza: number;
  data: string;
  stato: Rilevazione['stato'];
}

const Ctx = createContext<Contesto | null>(null);

const STAT_SEED: Record<Sede, Record<string, Statistica>> = {
  ferraris: statisticheDaSeed('ferraris'),
  spezia: statisticheDaSeed('spezia'),
};
const ARTICOLI_SEED = articoliDaSeed();
const TEMPI_SEED = tempiDaSeed();

export function ProviderScorte({ children }: { children: ReactNode }) {
  const [salvato, setSalvato] = useState<StatoSalvato>(() => leggiSalvato());
  const primoGiro = useRef(true);

  useEffect(() => {
    if (primoGiro.current) {
      primoGiro.current = false;
      return;
    }
    try {
      localStorage.setItem(CHIAVE, JSON.stringify(salvato));
    } catch {
      /* spazio esaurito: si continua comunque a lavorare in memoria */
    }
  }, [salvato]);

  const tempi = useMemo<TempiMap>(() => ({ ...TEMPI_SEED, ...salvato.tempi }), [salvato.tempi]);

  const articoli = useMemo<Record<string, Articolo>>(() => {
    const out: Record<string, Articolo> = {};
    for (const [codice, a] of Object.entries(ARTICOLI_SEED)) {
      const m = salvato.articoli[codice];
      out[codice] = m ? { ...a, ...m } : a;
    }
    return out;
  }, [salvato.articoli]);

  const statistiche = useCallback(
    (sede: Sede) => {
      const base = STAT_SEED[sede];
      if (!Object.keys(salvato.rifornimenti).length) return base;
      const out: Record<string, Statistica> = {};
      for (const [codice, s] of Object.entries(base)) {
        const flag = salvato.rifornimenti[`${sede}|${codice}`];
        out[codice] = flag === undefined ? s : { ...s, rifornimento_da_altra_sede: flag };
      }
      return out;
    },
    [salvato.rifornimenti],
  );

  const statistica = useCallback((sede: Sede, codice: string) => statistiche(sede)[codice], [statistiche]);

  const parametri = useCallback(
    (sede: Sede, codice: string) => {
      const s = statistiche(sede)[codice];
      const a = articoli[codice];
      return s && a ? calcolaParametri(s, a, tempi) : undefined;
    },
    [statistiche, articoli, tempi],
  );

  const parametriPrima = useCallback(
    (sede: Sede, codice: string) => {
      const s = statistiche(sede)[codice];
      const a = articoli[codice];
      return s && a ? calcolaParametri(s, a, { [seed.meta.fornitore_default]: seed.meta.lead_time_base }) : undefined;
    },
    [statistiche, articoli],
  );

  const sorvegliati = salvato.sorvegliati ?? seed.elenco_sorvegliato;

  const aggiorna = useCallback((patch: (s: StatoSalvato) => StatoSalvato) => setSalvato(patch), []);

  const valore = useMemo<Contesto>(
    () => ({
      sede: salvato.sedeCorrente,
      cambiaSede: (sede) => aggiorna((s) => ({ ...s, sedeCorrente: sede })),

      tempi,
      articoli,
      sorvegliati,
      rilevazioni: salvato.rilevazioni,

      statistiche,
      statistica,
      parametri,
      parametriPrima,

      cambiaTempo: (fornitore, giorni) =>
        aggiorna((s) => ({ ...s, tempi: { ...s.tempi, [fornitore]: giorni } })),

      cambiaArticolo: (codice, modifiche) =>
        aggiorna((s) => ({
          ...s,
          articoli: { ...s.articoli, [codice]: { ...s.articoli[codice], ...modifiche } },
        })),

      cambiaRifornimento: (sede, codice, da) =>
        aggiorna((s) => ({ ...s, rifornimenti: { ...s.rifornimenti, [`${sede}|${codice}`]: da } })),

      aggiungiSorvegliato: (codice) =>
        aggiorna((s) => {
          const elenco = s.sorvegliati ?? seed.elenco_sorvegliato;
          if (elenco.includes(codice)) return s;
          return { ...s, sorvegliati: [...elenco, codice] };
        }),

      togliSorvegliato: (codice) =>
        aggiorna((s) => {
          const elenco = s.sorvegliati ?? seed.elenco_sorvegliato;
          return { ...s, sorvegliati: elenco.filter((c) => c !== codice) };
        }),

      spostaSorvegliato: (codice, verso) =>
        aggiorna((s) => {
          const elenco = [...(s.sorvegliati ?? seed.elenco_sorvegliato)];
          const i = elenco.indexOf(codice);
          const j = i + verso;
          if (i < 0 || j < 0 || j >= elenco.length) return s;
          [elenco[i], elenco[j]] = [elenco[j], elenco[i]];
          return { ...s, sorvegliati: elenco };
        }),

      rilevazioneAperta: (sede) => salvato.rilevazioni.find((r) => r.sede === sede && r.stato === 'bozza'),

      apriRilevazione: (sede) => {
        const esistente = salvato.rilevazioni.find((r) => r.sede === sede && r.stato === 'bozza');
        if (esistente) return esistente;
        const nuova: Rilevazione = {
          id: `${sede}-${Date.now()}`,
          sede,
          data: new Date().toISOString(),
          operatore_uid: 'locale',
          operatore_nome: 'Operatore',
          stato: 'bozza',
          righe: {},
        };
        aggiorna((s) => ({ ...s, rilevazioni: [nuova, ...s.rilevazioni] }));
        return nuova;
      },

      ultimaGiacenza: (sede, codice) => {
        const candidate = salvato.rilevazioni
          .filter((r) => r.sede === sede && r.righe[codice] !== undefined)
          .sort((a, b) => b.data.localeCompare(a.data));
        const ultima = candidate[0];
        return ultima
          ? { giacenza: ultima.righe[codice], data: ultima.data, stato: ultima.stato }
          : undefined;
      },

      cambiaTrasferimento: (id, codice, dallAltraSede) =>
        aggiorna((s) => ({
          ...s,
          rilevazioni: s.rilevazioni.map((r) =>
            r.id === id ? { ...r, trasferimenti: { ...r.trasferimenti, [codice]: dallAltraSede } } : r,
          ),
        })),

      siTrasferisce: (rilevazione, codice) =>
        rilevazione.trasferimenti?.[codice] ??
        statistiche(rilevazione.sede)[codice]?.rifornimento_da_altra_sede ??
        false,

      scriviGiacenza: (id, codice, giacenza) =>
        aggiorna((s) => ({
          ...s,
          rilevazioni: s.rilevazioni.map((r) => {
            if (r.id !== id || r.stato === 'chiusa') return r;
            const righe = { ...r.righe };
            if (giacenza === null) delete righe[codice];
            else righe[codice] = giacenza;
            return { ...r, righe };
          }),
        })),

      chiudiRilevazione: (id) =>
        aggiorna((s) => ({
          ...s,
          rilevazioni: s.rilevazioni.map((r) =>
            r.id === id ? { ...r, stato: 'chiusa', chiusa_il: new Date().toISOString() } : r,
          ),
        })),

      eliminaRilevazione: (id) =>
        aggiorna((s) => ({ ...s, rilevazioni: s.rilevazioni.filter((r) => r.id !== id) })),

      modificato:
        Object.keys(salvato.tempi).length > 0 ||
        Object.keys(salvato.articoli).length > 0 ||
        Object.keys(salvato.rifornimenti).length > 0 ||
        salvato.sorvegliati !== null,

      ripristinaSeed: () =>
        aggiorna((s) => ({ ...VUOTO, rilevazioni: s.rilevazioni, sedeCorrente: s.sedeCorrente })),
    }),
    [salvato, tempi, articoli, sorvegliati, statistiche, statistica, parametri, parametriPrima, aggiorna],
  );

  return <Ctx.Provider value={valore}>{children}</Ctx.Provider>;
}

export function useScorte(): Contesto {
  const c = useContext(Ctx);
  if (!c) throw new Error('useScorte va usato dentro ProviderScorte');
  return c;
}
