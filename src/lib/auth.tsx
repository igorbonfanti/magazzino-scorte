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
 * Legge il profilo, e se non c'e' lo crea come operatore senza sede.
 *
 * Nessuno puo' farsi amministratore da solo: il primo admin si promuove a mano
 * dalla console Firebase, cambiando "ruolo" in "admin" sul proprio documento.
 * Da li' in poi e' l'admin ad assegnare ruoli e sedi agli altri.
 */
async function leggiProfilo(u: User): Promise<Utente> {
  const riferimento = doc(db, COLL.utenti, u.uid);
  const istantanea = await getDoc(riferimento);
  if (istantanea.exists()) return istantanea.data() as Utente;

  const nuovo: Utente = {
    nome: u.displayName ?? (u.email ?? '').split('@')[0],
    email: u.email ?? '',
    ruolo: 'operatore',
    sede: null,
  };
  await setDoc(riferimento, nuovo);
  return nuovo;
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
