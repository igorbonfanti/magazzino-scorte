import { useState } from 'react';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { COLL, DOC_PARAMETRI, db, idCodice, idStatistica } from '../lib/firebase';
import { formattaIntero } from '../money';
import { NOMI_SEDI, SEDI, articoliDaSeed, seed, statisticheDaSeed } from '../seed';
import { useScorte } from '../store';

/** Firestore accetta al massimo 500 operazioni per blocco. */
const PER_BLOCCO = 500;

interface Conteggi {
  tempi: number;
  articoli: number;
  statistiche: number;
  ferraris: number;
  spezia: number;
  sorvegliati: number;
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
      const blocco0 = writeBatch(db);
      blocco0.set(doc(db, COLL.config, DOC_PARAMETRI), {
        lead_time_base: seed.meta.lead_time_base,
        fornitore_default: seed.meta.fornitore_default,
        periodo_consumi: seed.meta.periodo_consumi,
        elenco_sorvegliato: seed.elenco_sorvegliato,
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

      setEsito({
        tempi: tempiSnap.size,
        articoli: articoliSnap.size,
        statistiche: statSnap.size,
        ferraris,
        spezia,
        sorvegliati: seed.elenco_sorvegliato.length,
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
            <Riga cosa="Tempi di consegna" trovati={esito.tempi} attesi={21} />
            <Riga cosa="Articoli" trovati={esito.articoli} attesi={1063} />
            <Riga cosa="Statistiche" trovati={esito.statistiche} attesi={1590} />
            <Riga cosa="di cui Ferraris" trovati={esito.ferraris} attesi={920} />
            <Riga cosa="di cui Spezia" trovati={esito.spezia} attesi={670} />
            <Riga cosa="Elenco sorvegliato" trovati={esito.sorvegliati} attesi={75} />
          </tbody>
        </table>
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
