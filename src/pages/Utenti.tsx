import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { COLL, db } from '../lib/firebase';
import { NOMI_SEDI, SEDI } from '../seed';
import { useScorte } from '../store';
import type { Ruolo, Sede, Utente } from '../types';

interface Riga extends Utente {
  uid: string;
}

/**
 * Chi puo' entrare, con che ruolo e in quale sede.
 *
 * L'elenco degli account sta in Firebase Authentication e da qui non si vede:
 * il browser non puo' interrogarlo, serve la console. Qui si gestisce l'altra
 * meta', cioe' il profilo: preso l'UID dalla console si assegnano nome, ruolo
 * e sede. Senza profilo l'utente entra ma non vede niente.
 */
export default function Utenti() {
  const s = useScorte();
  const [righe, setRighe] = useState<Riga[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState('');

  const [uid, setUid] = useState('');
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [ruolo, setRuolo] = useState<Ruolo>('operatore');
  const [sede, setSede] = useState<Sede | ''>('');

  const amministratore = s.profilo?.ruolo === 'admin';

  async function ricarica() {
    setCaricamento(true);
    try {
      const snap = await getDocs(collection(db, COLL.utenti));
      const elenco: Riga[] = [];
      snap.forEach((d) => elenco.push({ uid: d.id, ...(d.data() as Utente) }));
      elenco.sort((a, b) => a.email.localeCompare(b.email, 'it'));
      setRighe(elenco);
      setErrore('');
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setCaricamento(false);
    }
  }

  useEffect(() => {
    if (amministratore) void ricarica();
    else setCaricamento(false);
  }, [amministratore]);

  async function aggiungi(e: React.FormEvent) {
    e.preventDefault();
    const pulito = uid.trim();
    if (pulito.length < 20) {
      setErrore('L’UID non sembra valido: sono 28 caratteri, si copia dalla console Firebase.');
      return;
    }
    try {
      const profilo: Utente = {
        nome: nome.trim() || email.trim().split('@')[0],
        email: email.trim(),
        ruolo,
        sede: ruolo === 'admin' ? null : sede === '' ? null : sede,
      };
      await setDoc(doc(db, COLL.utenti, pulito), profilo);
      setUid('');
      setEmail('');
      setNome('');
      setSede('');
      setRuolo('operatore');
      await ricarica();
    } catch (err) {
      setErrore((err as Error).message);
    }
  }

  async function cambia(riga: Riga, modifiche: Partial<Utente>) {
    try {
      await updateDoc(doc(db, COLL.utenti, riga.uid), modifiche);
      setRighe((elenco) => elenco.map((r) => (r.uid === riga.uid ? { ...r, ...modifiche } : r)));
    } catch (err) {
      setErrore((err as Error).message);
    }
  }

  async function togli(riga: Riga) {
    if (!confirm(`Togliere il profilo di ${riga.email}? L’account resta in Firebase, ma non vedrà più nulla.`)) return;
    try {
      await deleteDoc(doc(db, COLL.utenti, riga.uid));
      await ricarica();
    } catch (err) {
      setErrore((err as Error).message);
    }
  }

  if (!amministratore) {
    return (
      <section>
        <h2>Utenti</h2>
        <p className="nota">Serve il ruolo di amministratore.</p>
      </section>
    );
  }

  return (
    <section>
      <div className="barra">
        <h2>Utenti e permessi</h2>
        <button className="bottone" onClick={() => void ricarica()}>
          Ricarica
        </button>
      </div>

      <p className="nota">
        L&rsquo;account con email e password si crea nella console Firebase, in <em>Authentication</em>. Qui si assegna
        cosa può fare: copia l&rsquo;UID dalla console e aggiungilo. Un utente senza profilo entra ma non vede niente;
        un operatore senza sede nemmeno.
      </p>

      {errore && <p className="accesso-errore">{errore}</p>}

      <form className="riquadro-utente" onSubmit={aggiungi}>
        <h3>Aggiungi un profilo</h3>
        <div className="campi-utente">
          <label>
            UID (dalla console)
            <input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="28 caratteri" required />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Nome
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="come lo chiamate" />
          </label>
          <label>
            Ruolo
            <select value={ruolo} onChange={(e) => setRuolo(e.target.value as Ruolo)}>
              <option value="operatore">operatore</option>
              <option value="admin">amministratore</option>
            </select>
          </label>
          <label>
            Sede
            <select value={sede} onChange={(e) => setSede(e.target.value as Sede | '')} disabled={ruolo === 'admin'}>
              <option value="">nessuna</option>
              {SEDI.map((q) => (
                <option key={q} value={q}>
                  {NOMI_SEDI[q]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="bottone principale" type="submit">
          Aggiungi
        </button>
      </form>

      <div className="tabella-scorrevole">
        <table className="tabella">
          <thead>
            <tr>
              <th>Email</th>
              <th>Nome</th>
              <th className="campo">Ruolo</th>
              <th className="campo">Sede</th>
              <th>UID</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {caricamento && (
              <tr>
                <td colSpan={6} className="tenue">
                  Carico…
                </td>
              </tr>
            )}
            {!caricamento && righe.length === 0 && (
              <tr>
                <td colSpan={6} className="tenue">
                  Nessun profilo. Aggiungi il primo qui sopra.
                </td>
              </tr>
            )}
            {righe.map((r) => (
              <tr key={r.uid}>
                <td>{r.email}</td>
                <td>{r.nome}</td>
                <td>
                  <select
                    className="scelta"
                    value={r.ruolo}
                    onChange={(e) => void cambia(r, { ruolo: e.target.value as Ruolo })}
                  >
                    <option value="operatore">operatore</option>
                    <option value="admin">amministratore</option>
                  </select>
                </td>
                <td>
                  <select
                    className="scelta"
                    value={r.sede ?? ''}
                    onChange={(e) => void cambia(r, { sede: (e.target.value || null) as Sede | null })}
                  >
                    <option value="">nessuna</option>
                    {SEDI.map((q) => (
                      <option key={q} value={q}>
                        {NOMI_SEDI[q]}
                      </option>
                    ))}
                  </select>
                  {r.ruolo === 'operatore' && !r.sede && <span className="prima">senza sede non vede niente</span>}
                </td>
                <td className="codice piccolo">{r.uid}</td>
                <td>
                  <button className="bottone piccolo" onClick={() => void togli(r)}>
                    Togli
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
