import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { COLL, auth, db } from './firebase';
import { eAmministratore, riconosciuto } from './ruoli';
import type { Utente } from '../types';

interface StatoAccesso {
  utente: User | null;
  /** ruolo e sede, dal documento scorte_utenti */
  profilo: Utente | null;
  caricamento: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<StatoAccesso | null>(null);

export function ProviderAccesso({ children }: { children: ReactNode }) {
  const [utente, setUtente] = useState<User | null>(null);
  const [profilo, setProfilo] = useState<Utente | null>(null);
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    // Persistenza locale: la sessione sopravvive alla chiusura del browser,
    // cosi' il login serve una volta ogni tanto e non a ogni apertura. Per chi
    // conta col telefono in mano e' la differenza fra usarla e non usarla.
    void setPersistence(auth, browserLocalPersistence);
    return onAuthStateChanged(auth, async (u) => {
      setUtente(u);
      if (!u) {
        setProfilo(null);
        setCaricamento(false);
        return;
      }
      setProfilo(await leggiProfilo(u));
      setCaricamento(false);
    });
  }, []);

  const valore = useMemo<StatoAccesso>(
    () => ({
      utente,
      profilo,
      caricamento,
      login: async (email, password) => {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      },
      logout: async () => {
        await signOut(auth);
      },
    }),
    [utente, profilo, caricamento],
  );

  return <Ctx.Provider value={valore}>{children}</Ctx.Provider>;
}

/**
 * Il profilo dell'utente collegato.
 *
 * Il ruolo NON viene dal documento: viene dagli elenchi di UID, gli stessi
 * delle regole Firestore. Cosi' non esiste il caso in cui il documento dice
 * una cosa e il database ne concede un'altra, e nessuno resta chiuso fuori
 * per un campo sbagliato. Il documento serve solo a tenere il nome per esteso
 * e la sede abituale, ed e' un di piu': se non c'e' o non si legge, l'app
 * funziona lo stesso.
 */
async function leggiProfilo(u: User): Promise<Utente> {
  const ruolo = eAmministratore(u.uid) ? 'admin' : 'operatore';
  const email = u.email ?? '';
  const base: Utente = {
    nome: u.displayName ?? email.split('@')[0],
    email,
    ruolo,
    sede: null,
  };

  try {
    const riferimento = doc(db, COLL.utenti, u.uid);
    const istantanea = await getDoc(riferimento);
    if (istantanea.exists()) {
      const salvato = istantanea.data() as Partial<Utente>;
      // nome e sede si prendono dal documento, il ruolo no: quello e' dell'elenco
      return { ...base, nome: salvato.nome || base.nome, sede: salvato.sede ?? null };
    }
    if (riconosciuto(u.uid)) await setDoc(riferimento, base);
  } catch {
    /* il documento e' un di piu': senza, si lavora con i valori ricavati dall'account */
  }

  return base;
}

export function useAccesso(): StatoAccesso {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAccesso va usato dentro <ProviderAccesso>');
  return ctx;
}

/** Traduce i codici di errore Firebase Auth in messaggi leggibili. */
export function messaggioErroreAuth(err: unknown): string {
  const codice = (err as { code?: string })?.code ?? '';
  switch (codice) {
    case 'auth/invalid-email':
      return 'Indirizzo email non valido.';
    case 'auth/user-disabled':
      return 'Utente disabilitato.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email o password errati.';
    case 'auth/too-many-requests':
      return 'Troppi tentativi falliti. Riprova fra qualche minuto.';
    case 'auth/network-request-failed':
      return 'Connessione assente: impossibile raggiungere Firebase.';
    default:
      return 'Accesso non riuscito. Riprova.';
  }
}
