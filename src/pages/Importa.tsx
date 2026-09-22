import { useState } from 'react';
import { collection, deleteDoc, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { COLL, DOC_PARAMETRI, db, idCodice, idStatistica } from '../lib/firebase';
import { formattaIntero } from '../money';
import { NOMI_SEDI, SEDI, articoliDaSeed, seed, statisticheDaSeed } from '../seed';
import type { Sede } from '../types';
import { applicaForzature } from '../lib/sorvegliati';
import { useScorte } from '../store';

/** Quante righe sede-articolo porta il file di partenza. */
function righeSeed(sede: Sede): number {
  return Object.keys(seed.sedi[sede].articoli).length;
}

/** Firestore accetta al massimo 500 operazioni per blocco. */
const PER_BLOCCO = 500;

interface Conteggi {
  tempi: number;
  articoli: number;
  statistiche: number;
  ferraris: number;
  spezia: number;
  sorvegliati: number;
  /** documenti rimasti da un'importazione precedente e non piu' nel file */
  residuiArticoli: string[];
  residuiStatistiche: string[];
}

/**
 * Importazione dei dati di partenza dal file seed.
 *
 * Si puo' rilanciare quante volte si vuole: ogni documento ha un ID costruito
 * dal suo codice, quindi la seconda passata riscrive gli stessi documenti
 * invece di creare doppioni. Le rilevazioni non vengono toccate.
 */
export default function Importa() {
  const s = useScorte();
  const [inCorso, setInCorso] = useState(false);
  const [avanzamento, setAvanzamento] = useState('');
  const [esito, setEsito] = useState<Conteggi | null>(null);
  const [errore, setErrore] = useState('');
  const [pulendo, setPulendo] = useState(false);

  const amministratore = s.profilo?.ruolo === 'admin';

  async function importa() {
    setInCorso(true);
    setErrore('');
    setEsito(null);
    try {
      const articoli = articoliDaSeed();

      // 1. parametri generali
      setAvanzamento('Parametri…');
      const adesso = new Date().toISOString();

      // Le scelte fatte a mano dalla pagina "Elenco sorvegliato" non si
      // buttano: si rileggono e si riapplicano sopra l'elenco nuovo. Prima
      // l'importazione le cancellava, e chi le aveva fatte se ne accorgeva
      // solo non trovando piu' un articolo nel giro di conteggio.
      const configVecchia = await getDoc(doc(db, COLL.config, DOC_PARAMETRI));
      const precedente = configVecchia.exists()
        ? (configVecchia.data() as { forzati_dentro?: string[]; forzati_fuori?: string[] })
        : {};
      const forzature = {
        dentro: precedente.forzati_dentro ?? [],
        fuori: precedente.forzati_fuori ?? [],
      };
      const sorvegliatiFinali = applicaForzature(
        seed.elenco_sorvegliato,
        forzature,
        (c) => articoli[c] !== undefined,
      );

      const blocco0 = writeBatch(db);
      blocco0.set(doc(db, COLL.config, DOC_PARAMETRI), {
        lead_time_base: seed.meta.lead_time_base,
        fornitore_default: seed.meta.fornitore_default,
        periodo_consumi: seed.meta.periodo_consumi,
        elenco_sorvegliato: sorvegliatiFinali,
        forzati_dentro: forzature.dentro,
        forzati_fuori: forzature.fuori,
        esclusi: seed.esclusi,
        aggiornato_il: adesso,
      });
      await blocco0.commit();

      // 2. tempi di consegna
      setAvanzamento('Tempi di consegna…');
      await scriviABlocchi(seed.tempi_consegna, (blocco, t) => {
        blocco.set(doc(db, COLL.tempi, t.fornitore), {
          fornitore: t.fornitore,
          giorni: t.giorni,
          fonte: t.fonte,
          note: t.note,
        });
      });

      // 3. articoli
      setAvanzamento('Articoli…');
      const elencoArticoli = Object.values(articoli);
      await scriviABlocchi(elencoArticoli, (blocco, a, i) => {
        if (i % 200 === 0) setAvanzamento(`Articoli… ${formattaIntero(i)} di ${formattaIntero(elencoArticoli.length)}`);
        blocco.set(doc(db, COLL.articoli, idCodice(a.codice)), a);
      });

      // 4. statistiche per sede
      for (const sede of SEDI) {
        const righe = Object.values(statisticheDaSeed(sede));
        setAvanzamento(`${NOMI_SEDI[sede]}…`);
        await scriviABlocchi(righe, (blocco, riga, i) => {
          if (i % 200 === 0) {
            setAvanzamento(`${NOMI_SEDI[sede]}… ${formattaIntero(i)} di ${formattaIntero(righe.length)}`);
          }
          blocco.set(doc(db, COLL.statistiche, idStatistica(sede, riga.codice)), riga);
        });
      }

      // 5. riconteggio da Firestore, non dal file: si verifica cosa c'e' davvero
      setAvanzamento('Conto quello che è arrivato…');
      const [tempiSnap, articoliSnap, statSnap] = await Promise.all([
        getDocs(collection(db, COLL.tempi)),
        getDocs(collection(db, COLL.articoli)),
        getDocs(collection(db, COLL.statistiche)),
      ]);

      let ferraris = 0;
      let spezia = 0;
      statSnap.forEach((d) => {
        const sede = (d.data() as { sede: string }).sede;
        if (sede === 'ferraris') ferraris++;
        if (sede === 'spezia') spezia++;
      });

      // Cosa c'e' su Firestore e non e' piu' nel file: l'importazione scrive
      // e riscrive, non cancella. Sono articoli usciti dal listino o passati
      // fra i dismessi, che altrimenti restano per sempre e si ritrovano
      // cercando in "Articoli e lotti".
      const residuiArticoli: string[] = [];
      articoliSnap.forEach((d) => {
        const codice = (d.data() as { codice: string }).codice;
        if (!articoli[codice]) residuiArticoli.push(codice);
      });
      const residuiStatistiche: string[] = [];
      statSnap.forEach((d) => {
        const r = d.data() as { sede: Sede; codice: string };
        if (!seed.sedi[r.sede]?.articoli[r.codice]) residuiStatistiche.push(`${r.sede} ${r.codice}`);
      });

      setEsito({
        tempi: tempiSnap.size,
        articoli: articoliSnap.size,
        statistiche: statSnap.size,
        ferraris,
        spezia,
        sorvegliati: sorvegliatiFinali.length,
        residuiArticoli: residuiArticoli.sort(),
        residuiStatistiche: residuiStatistiche.sort(),
      });
      setAvanzamento('');
      await s.ricarica();
    } catch (e) {
      setErrore((e as Error)?.message ?? 'Importazione non riuscita.');
      setAvanzamento('');
    } finally {
      setInCorso(false);
    }
  }

  /**
   * Toglie i documenti rimasti da un'importazione precedente.
   *
   * Sta in un bottone suo e non dentro l'importazione: cancellare e'
   * l'unica operazione che non si puo' rifare al contrario, e chi la
   * lancia deve prima aver visto l'elenco di cosa sparisce. Le rilevazioni
   * non vengono sfiorate.
   */
  async function togliResidui() {
    if (!esito) return;
    setPulendo(true);
    setErrore('');
    try {
      for (const codice of esito.residuiArticoli) {
        await deleteDoc(doc(db, COLL.articoli, idCodice(codice)));
      }
      for (const riga of esito.residuiStatistiche) {
        const [sede, codice] = riga.split(' ');
        await deleteDoc(doc(db, COLL.statistiche, idStatistica(sede, codice)));
      }
      setEsito({ ...esito, residuiArticoli: [], residuiStatistiche: [] });
      await s.ricarica();
    } catch (e) {
      setErrore((e as Error)?.message ?? 'Non sono riuscito a togliere i residui.');
    } finally {
      setPulendo(false);
    }
  }

  if (!amministratore) {
    return (
      <section>
        <h2>Importa dati iniziali</h2>
        <p className="nota">Serve il ruolo di amministratore.</p>
      </section>
    );
  }

  return (
    <section className="testo">
      <h2>Importa dati iniziali</h2>

      <p>
        Scrive su Firestore i dati di partenza: parametri, {formattaIntero(seed.tempi_consegna.length)} tempi di
        consegna, {formattaIntero(seed.articoli.length)} articoli e le statistiche di consumo delle due sedi. Si può
        rilanciare senza creare doppioni: ogni documento ha un ID costruito dal suo codice, quindi la seconda passata
        riscrive gli stessi documenti.
      </p>
      <p className="nota">
        Le rilevazioni non vengono toccate. I consumi non si ricalcolano: arrivano già elaborati dal file di partenza
        ({seed.meta.fonte}, {seed.meta.periodo_consumi}).
      </p>

      <button className="bottone principale" onClick={importa} disabled={inCorso}>
        {inCorso ? 'Importazione in corso…' : 'Importa adesso'}
      </button>

      {avanzamento && <p className="nota">{avanzamento}</p>}
      {errore && <p className="accesso-errore">{errore}</p>}

      {esito && (
        <table className="tabella" style={{ marginTop: 20 }}>
          <thead>
            <tr>
              <th>Cosa</th>
              <th className="num">Contati su Firestore</th>
              <th className="num">Attesi</th>
              <th>Esito</th>
            </tr>
          </thead>
          <tbody>
            <Riga cosa="Tempi di consegna" trovati={esito.tempi} attesi={seed.tempi_consegna.length} />
            <Riga cosa="Articoli" trovati={esito.articoli} attesi={seed.articoli.length} />
            <Riga
              cosa="Statistiche"
              trovati={esito.statistiche}
              attesi={righeSeed('ferraris') + righeSeed('spezia')}
            />
            <Riga cosa="di cui Ferraris" trovati={esito.ferraris} attesi={righeSeed('ferraris')} />
            <Riga cosa="di cui Spezia" trovati={esito.spezia} attesi={righeSeed('spezia')} />
            <Riga cosa="Elenco sorvegliato" trovati={esito.sorvegliati} attesi={esito.sorvegliati} />
          </tbody>
        </table>
      )}

      {esito && (esito.residuiArticoli.length > 0 || esito.residuiStatistiche.length > 0) && (
        <>
          <h3 style={{ marginTop: 24 }}>Rimasti da prima</h3>
          <p>
            Su Firestore ci sono {formattaIntero(esito.residuiArticoli.length)} articoli e{' '}
            {formattaIntero(esito.residuiStatistiche.length)} righe di consumo che il file di partenza non contiene
            piu&rsquo;. Sono codici usciti dal listino o passati fra i dismessi: l&rsquo;importazione scrive e
            riscrive, non cancella, quindi restano finche&rsquo; non si tolgono a mano.
          </p>
          <p className="nota">
            Articoli: {esito.residuiArticoli.join(', ') || '—'}
            <br />
            Righe di consumo: {esito.residuiStatistiche.join(', ') || '—'}
          </p>
          <button className="bottone" onClick={togliResidui} disabled={pulendo}>
            {pulendo ? 'Sto togliendo…' : 'Togli i residui'}
          </button>
          <p className="nota">Le rilevazioni non vengono toccate.</p>
        </>
      )}
    </section>
  );
}

function Riga({ cosa, trovati, attesi }: { cosa: string; trovati: number; attesi: number }) {
  const torna = trovati === attesi;
  return (
    <tr>
      <td>{cosa}</td>
      <td className="num forte">{formattaIntero(trovati)}</td>
      <td className="num secondario">{formattaIntero(attesi)}</td>
      <td>{torna ? <span className="ok">torna</span> : <span className="ordina">NON TORNA</span>}</td>
    </tr>
  );
}

/** Scrive a blocchi da 500, che è il massimo che Firestore accetta in una volta. */
async function scriviABlocchi<T>(
  elementi: T[],
  aggiungi: (blocco: ReturnType<typeof writeBatch>, elemento: T, indice: number) => void,
): Promise<void> {
  for (let inizio = 0; inizio < elementi.length; inizio += PER_BLOCCO) {
    const blocco = writeBatch(db);
    elementi.slice(inizio, inizio + PER_BLOCCO).forEach((elemento, i) => aggiungi(blocco, elemento, inizio + i));
    await blocco.commit();
  }
}
