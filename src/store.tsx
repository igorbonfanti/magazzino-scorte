import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  FieldPath,
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
} from 'firebase/firestore';
import { calcolaParametri } from './engine';
import type { Parametri } from './engine';
import { totaleContato } from './lib/conteggio';
import { COLL, DOC_PARAMETRI, db, idCodice, idStatistica } from './lib/firebase';
import { useAccesso } from './lib/auth';
import type { Articolo, DettaglioConteggio, Rilevazione, Sede, Statistica, TempiMap, Utente } from './types';

/**
 * Stato dell'applicazione, su Firestore.
 *
 * I dati di base — parametri, tempi, articoli, statistiche — cambiano di rado
 * e sono quasi 2.700 documenti: riscaricarli a ogni apertura costerebbe
 * letture e secondi, soprattutto col telefono in magazzino. Si tengono quindi
 * in cache nel browser, usando come marcatore la data di aggiornamento scritta
 * nei parametri: appena l'amministratore tocca qualcosa quella data cambia e
 * la cache si rifa' da sola.
 *
 * Le rilevazioni invece sono in ascolto continuo: quello che il magazziniere
 * conta col telefono compare sul PC mentre lo conta.
 */

const CHIAVE_CACHE = 'scorte.cache.v1';
const CHIAVE_SEDE = 'scorte.sede';
/** quanto si aspetta, digitando nella tabella, prima di scrivere su Firestore */
const ATTESA_SALVATAGGIO = 700;

export interface ModificheArticolo {
  fornitore?: string;
  lotto_minimo?: number;
  lotto_nota?: string;
  tipologia?: string;
  pezzi_per_collo?: number;
}

export interface ConfigScorte {
  lead_time_base: number;
  fornitore_default: string;
  periodo_consumi: string;
  elenco_sorvegliato: string[];
  esclusi: string[];
  aggiornato_il: string;
}

interface Base {
  config: ConfigScorte;
  tempi: TempiMap;
  articoli: Record<string, Articolo>;
  statistiche: Record<Sede, Record<string, Statistica>>;
}

export interface UltimaGiacenza {
  giacenza: number;
  data: string;
  stato: Rilevazione['stato'];
}

export interface Contesto {
  /** i dati di base sono arrivati */
  pronto: boolean;
  errore: string | null;
  profilo: Utente | null;
  /** l'archivio e' vuoto: serve l'importazione iniziale */
  daImportare: boolean;

  sede: Sede;
  cambiaSede: (sede: Sede) => void;
  /** l'operatore e' legato alla sua sede, l'admin no */
  puoCambiareSede: boolean;

  tempi: TempiMap;
  articoli: Record<string, Articolo>;
  sorvegliati: string[];
  rilevazioni: Rilevazione[];

  statistiche: (sede: Sede) => Record<string, Statistica>;
  statistica: (sede: Sede, codice: string) => Statistica | undefined;
  parametri: (sede: Sede, codice: string) => Parametri | undefined;
  parametriPrima: (sede: Sede, codice: string) => Parametri | undefined;

  cambiaTempo: (fornitore: string, giorni: number) => void;
  cambiaArticolo: (codice: string, modifiche: ModificheArticolo) => void;
  cambiaRifornimento: (sede: Sede, codice: string, da: boolean) => void;
  aggiungiSorvegliato: (codice: string) => void;
  togliSorvegliato: (codice: string) => void;
  spostaSorvegliato: (codice: string, verso: -1 | 1) => void;

  rilevazioneAperta: (sede: Sede) => Rilevazione | undefined;
  apriRilevazione: (sede: Sede) => void;
  scriviGiacenza: (id: string, codice: string, giacenza: number | null) => void;
  scriviConteggio: (id: string, codice: string, dettaglio: DettaglioConteggio | null) => void;
  segnaSaltato: (id: string, codice: string, saltato: boolean) => void;
  chiudiRilevazione: (id: string) => void;
  eliminaRilevazione: (id: string) => void;
  ultimaGiacenza: (sede: Sede, codice: string) => UltimaGiacenza | undefined;
  cambiaTrasferimento: (id: string, codice: string, dallAltraSede: boolean) => void;
  siTrasferisce: (rilevazione: Rilevazione, codice: string) => boolean;

  /** riscarica i dati di base saltando la cache */
  ricarica: () => Promise<void>;
}

const Ctx = createContext<Contesto | null>(null);

/* ------------------------------------------------------------------ */
/* dati di base: cache nel browser, marcata con la data di aggiornamento */
/* ------------------------------------------------------------------ */

function leggiCache(stamp: string): Base | null {
  try {
    const grezzo = localStorage.getItem(CHIAVE_CACHE);
    if (!grezzo) return null;
    const salvato = JSON.parse(grezzo) as { stamp: string; base: Base };
    return salvato.stamp === stamp ? salvato.base : null;
  } catch {
    return null;
  }
}

function scriviCache(stamp: string, base: Base): void {
  try {
    localStorage.setItem(CHIAVE_CACHE, JSON.stringify({ stamp, base }));
  } catch {
    /* spazio esaurito: si lavora lo stesso, solo piu' lenti al prossimo avvio */
  }
}

async function scaricaBase(config: ConfigScorte): Promise<Base> {
  const [tempiSnap, articoliSnap, statSnap] = await Promise.all([
    getDocs(collection(db, COLL.tempi)),
    getDocs(collection(db, COLL.articoli)),
    getDocs(collection(db, COLL.statistiche)),
  ]);

  const tempi: TempiMap = {};
  tempiSnap.forEach((d) => {
    const v = d.data() as { fornitore: string; giorni: number };
    tempi[v.fornitore] = v.giorni;
  });

  const articoli: Record<string, Articolo> = {};
  articoliSnap.forEach((d) => {
    const a = d.data() as Articolo;
    articoli[a.codice] = a;
  });

  const statistiche: Record<Sede, Record<string, Statistica>> = { ferraris: {}, spezia: {} };
  statSnap.forEach((d) => {
    const s = d.data() as Statistica;
    if (s.sede === 'ferraris' || s.sede === 'spezia') statistiche[s.sede][s.codice] = s;
  });

  return { config, tempi, articoli, statistiche };
}

/** Le mappe su Firestore sono indicizzate per ID codice: qui si torna ai codici veri. */
function decodificaRilevazione(r: Rilevazione): Rilevazione {
  function decodifica<T>(mappa: Record<string, T> | undefined): Record<string, T> | undefined {
    if (!mappa) return undefined;
    const out: Record<string, T> = {};
    for (const [chiave, valore] of Object.entries(mappa)) out[decodeURIComponent(chiave)] = valore;
    return out;
  }
  return {
    ...r,
    righe: decodifica(r.righe) ?? {},
    dettaglio: decodifica(r.dettaglio),
    trasferimenti: decodifica(r.trasferimenti),
    saltati: r.saltati?.map((c) => decodeURIComponent(c)),
  };
}

/* ------------------------------------------------------------------ */

export function ProviderScorte({ children }: { children: ReactNode }) {
  const { utente, profilo } = useAccesso();
  const [base, setBase] = useState<Base | null>(null);
  const [rilevazioni, setRilevazioni] = useState<Rilevazione[]>([]);
  const [errore, setErrore] = useState<string | null>(null);
  const [daImportare, setDaImportare] = useState(false);
  const [sedeScelta, setSedeScelta] = useState<Sede>(() =>
    localStorage.getItem(CHIAVE_SEDE) === 'spezia' ? 'spezia' : 'ferraris',
  );
  /** salvataggi rinviati, per non scrivere a ogni tasto */
  const rinvii = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const admin = profilo?.ruolo === 'admin';

  const carica = useCallback(
    async (saltaCache = false) => {
      if (!utente) return;
      setErrore(null);
      try {
        const configSnap = await getDoc(doc(db, COLL.config, DOC_PARAMETRI));
        if (!configSnap.exists()) {
          setDaImportare(true);
          setBase(null);
          return;
        }
        setDaImportare(false);
        const config = configSnap.data() as ConfigScorte;
        const stamp = config.aggiornato_il ?? '';
        const cache = saltaCache ? null : leggiCache(stamp);
        if (cache) {
          setBase({ ...cache, config });
          return;
        }
        const scaricata = await scaricaBase(config);
        scriviCache(stamp, scaricata);
        setBase(scaricata);
      } catch (e) {
        setErrore((e as Error)?.message ?? 'Impossibile leggere i dati.');
      }
    },
    [utente],
  );

  useEffect(() => {
    void carica();
  }, [carica]);

  /** rilevazioni in ascolto: l'admin le vede tutte, l'operatore solo la sua sede */
  useEffect(() => {
    if (!utente || !profilo) return;
    // Chi conta vede i conteggi di entrambe le sedi: sceglie il magazzino
    // all'inizio del giro, e le regole gli consentono la lettura.
    const q = query(collection(db, COLL.rilevazioni));
    return onSnapshot(
      q,
      (snap) => {
        const elenco: Rilevazione[] = [];
        snap.forEach((d) => elenco.push({ ...(d.data() as Omit<Rilevazione, 'id'>), id: d.id }));
        elenco.sort((a, b) => b.data.localeCompare(a.data));
        setRilevazioni(elenco.map(decodificaRilevazione));
      },
      (e) => setErrore(e.message),
    );
  }, [utente, profilo]);

  const tempi = useMemo(() => base?.tempi ?? {}, [base]);
  const articoli = useMemo(() => base?.articoli ?? {}, [base]);
  const sorvegliati = useMemo(() => base?.config.elenco_sorvegliato ?? [], [base]);

  const statistiche = useCallback((sede: Sede) => base?.statistiche[sede] ?? {}, [base]);
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
      const soloBase = { [base?.config.fornitore_default ?? 'altri fornitori']: base?.config.lead_time_base ?? 5 };
      return s && a ? calcolaParametri(s, a, soloBase) : undefined;
    },
    [statistiche, articoli, base],
  );

  /** aggiorna subito in memoria e poi su Firestore: l'interfaccia non aspetta la rete */
  const aggiornaBase = useCallback(
    (modifica: (b: Base) => Base, scrittura: () => Promise<unknown>) => {
      const quando = new Date().toISOString();
      setBase((b) => {
        if (!b) return b;
        const nuova = modifica(b);
        const conData = { ...nuova, config: { ...nuova.config, aggiornato_il: quando } };
        scriviCache(quando, conData);
        return conData;
      });
      scrittura()
        .then(() => updateDoc(doc(db, COLL.config, DOC_PARAMETRI), { aggiornato_il: quando }))
        .catch((e) => setErrore((e as Error).message));
    },
    [],
  );

  const valore = useMemo<Contesto>(() => {
    const sede: Sede = profilo?.ruolo === 'operatore' && profilo.sede ? profilo.sede : sedeScelta;

    function rinvia(chiave: string, azione: () => Promise<unknown>) {
      const attuale = rinvii.current.get(chiave);
      if (attuale) clearTimeout(attuale);
      rinvii.current.set(
        chiave,
        setTimeout(() => {
          rinvii.current.delete(chiave);
          azione().catch((e) => setErrore((e as Error).message));
        }, ATTESA_SALVATAGGIO),
      );
    }

    function subito(azione: () => Promise<unknown>) {
      azione().catch((e) => setErrore((e as Error).message));
    }

    /** aggiorna la rilevazione in memoria senza aspettare il giro su Firestore */
    function ottimistico(id: string, modifica: (r: Rilevazione) => Rilevazione) {
      setRilevazioni((elenco) => elenco.map((r) => (r.id === id ? modifica(r) : r)));
    }

    function aggiornaConfig(elenco: string[]) {
      aggiornaBase(
        (b) => ({ ...b, config: { ...b.config, elenco_sorvegliato: elenco } }),
        () => updateDoc(doc(db, COLL.config, DOC_PARAMETRI), { elenco_sorvegliato: elenco }),
      );
    }

    return {
      pronto: base !== null,
      errore,
      profilo,
      daImportare,

      sede,
      cambiaSede: (nuova) => {
        setSedeScelta(nuova);
        localStorage.setItem(CHIAVE_SEDE, nuova);
      },
      puoCambiareSede: admin || !profilo?.sede,

      tempi,
      articoli,
      sorvegliati,
      rilevazioni,

      statistiche,
      statistica,
      parametri,
      parametriPrima,

      cambiaTempo: (fornitore, giorni) =>
        aggiornaBase(
          (b) => ({ ...b, tempi: { ...b.tempi, [fornitore]: giorni } }),
          () => updateDoc(doc(db, COLL.tempi, fornitore), { giorni }),
        ),

      cambiaArticolo: (codice, modifiche) =>
        aggiornaBase(
          (b) => ({ ...b, articoli: { ...b.articoli, [codice]: { ...b.articoli[codice], ...modifiche } } }),
          () => updateDoc(doc(db, COLL.articoli, idCodice(codice)), { ...modifiche }),
        ),

      cambiaRifornimento: (quale, codice, da) =>
        aggiornaBase(
          (b) => ({
            ...b,
            statistiche: {
              ...b.statistiche,
              [quale]: {
                ...b.statistiche[quale],
                [codice]: { ...b.statistiche[quale][codice], rifornimento_da_altra_sede: da },
              },
            },
          }),
          () => updateDoc(doc(db, COLL.statistiche, idStatistica(quale, codice)), { rifornimento_da_altra_sede: da }),
        ),

      aggiungiSorvegliato: (codice) => {
        if (sorvegliati.includes(codice)) return;
        aggiornaConfig([...sorvegliati, codice]);
      },

      togliSorvegliato: (codice) => aggiornaConfig(sorvegliati.filter((c) => c !== codice)),

      spostaSorvegliato: (codice, verso) => {
        const elenco = [...sorvegliati];
        const i = elenco.indexOf(codice);
        const j = i + verso;
        if (i < 0 || j < 0 || j >= elenco.length) return;
        [elenco[i], elenco[j]] = [elenco[j], elenco[i]];
        aggiornaConfig(elenco);
      },

      rilevazioneAperta: (quale) => rilevazioni.find((r) => r.sede === quale && r.stato === 'bozza'),

      apriRilevazione: (quale) => {
        if (rilevazioni.some((r) => r.sede === quale && r.stato === 'bozza')) return;
        subito(() =>
          addDoc(collection(db, COLL.rilevazioni), {
            sede: quale,
            data: new Date().toISOString(),
            operatore_uid: utente?.uid ?? '',
            operatore_nome: profilo?.nome ?? utente?.email ?? '',
            stato: 'bozza',
            righe: {},
          }),
        );
      },

      scriviGiacenza: (id, codice, giacenza) => {
        ottimistico(id, (r) => {
          const righe = { ...r.righe };
          if (giacenza === null) delete righe[codice];
          else righe[codice] = giacenza;
          return { ...r, righe };
        });
        rinvia(`${id}|${codice}`, () =>
          updateDoc(
            doc(db, COLL.rilevazioni, id),
            new FieldPath('righe', idCodice(codice)),
            giacenza === null ? deleteField() : giacenza,
          ),
        );
      },

      scriviConteggio: (id, codice, dettaglio) => {
        const rimasti = (rilevazioni.find((r) => r.id === id)?.saltati ?? []).filter((c) => c !== codice);
        ottimistico(id, (r) => {
          const righe = { ...r.righe };
          const det = { ...r.dettaglio };
          if (dettaglio === null) {
            delete righe[codice];
            delete det[codice];
          } else {
            righe[codice] = totaleContato(dettaglio);
            det[codice] = dettaglio;
          }
          return { ...r, righe, dettaglio: det, saltati: rimasti };
        });
        subito(() =>
          updateDoc(
            doc(db, COLL.rilevazioni, id),
            new FieldPath('righe', idCodice(codice)),
            dettaglio === null ? deleteField() : totaleContato(dettaglio),
            new FieldPath('dettaglio', idCodice(codice)),
            dettaglio === null ? deleteField() : dettaglio,
            'saltati',
            rimasti.map(idCodice),
          ),
        );
      },

      segnaSaltato: (id, codice, saltato) => {
        const attuali = new Set(rilevazioni.find((r) => r.id === id)?.saltati ?? []);
        if (saltato) attuali.add(codice);
        else attuali.delete(codice);
        const elenco = [...attuali];
        ottimistico(id, (r) => ({ ...r, saltati: elenco }));
        subito(() => updateDoc(doc(db, COLL.rilevazioni, id), { saltati: elenco.map(idCodice) }));
      },

      chiudiRilevazione: (id) => {
        const chiusa_il = new Date().toISOString();
        ottimistico(id, (r) => ({ ...r, stato: 'chiusa', chiusa_il }));
        subito(() => updateDoc(doc(db, COLL.rilevazioni, id), { stato: 'chiusa', chiusa_il }));
      },

      eliminaRilevazione: (id) => {
        setRilevazioni((elenco) => elenco.filter((r) => r.id !== id));
        subito(() => deleteDoc(doc(db, COLL.rilevazioni, id)));
      },

      ultimaGiacenza: (quale, codice) => {
        const ultima = rilevazioni
          .filter((r) => r.sede === quale && r.righe[codice] !== undefined)
          .sort((a, b) => b.data.localeCompare(a.data))[0];
        return ultima ? { giacenza: ultima.righe[codice], data: ultima.data, stato: ultima.stato } : undefined;
      },

      cambiaTrasferimento: (id, codice, dallAltraSede) => {
        ottimistico(id, (r) => ({ ...r, trasferimenti: { ...r.trasferimenti, [codice]: dallAltraSede } }));
        subito(() =>
          updateDoc(doc(db, COLL.rilevazioni, id), new FieldPath('trasferimenti', idCodice(codice)), dallAltraSede),
        );
      },

      siTrasferisce: (rilevazione, codice) =>
        rilevazione.trasferimenti?.[codice] ??
        statistiche(rilevazione.sede)[codice]?.rifornimento_da_altra_sede ??
        false,

      ricarica: () => carica(true),
    };
  }, [
    base,
    errore,
    profilo,
    admin,
    daImportare,
    sedeScelta,
    tempi,
    articoli,
    sorvegliati,
    rilevazioni,
    statistiche,
    statistica,
    parametri,
    parametriPrima,
    aggiornaBase,
    utente,
    carica,
  ]);

  return <Ctx.Provider value={valore}>{children}</Ctx.Provider>;
}

export function useScorte(): Contesto {
  const c = useContext(Ctx);
  if (!c) throw new Error('useScorte va usato dentro ProviderScorte');
  return c;
}
