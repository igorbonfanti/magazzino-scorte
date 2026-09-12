import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Progetto Firebase condiviso con le altre app del magazzino.
// Tutte le collection di questa app usano il prefisso scorte_ (vedi COLL sotto)
// e le regole Firestore isolano scorte_* dal resto del progetto.
const firebaseConfig = {
  apiKey: 'AIzaSyCLdOfp4z3FUJX2xt-xBZciyjxJZWeoh7A',
  authDomain: 'magazzino-edile-pos.firebaseapp.com',
  projectId: 'magazzino-edile-pos',
  storageBucket: 'magazzino-edile-pos.firebasestorage.app',
  messagingSenderId: '696561179056',
  appId: '1:696561179056:web:fc6b1db62ed256fd3fde75',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

/** Nomi delle collection Firestore. Unico punto di verita': non scrivere stringhe letterali altrove. */
export const COLL = {
  config: 'scorte_config',
  tempi: 'scorte_tempi',
  articoli: 'scorte_articoli',
  statistiche: 'scorte_statistiche',
  rilevazioni: 'scorte_rilevazioni',
  utenti: 'scorte_utenti',
} as const;

/** L'unico documento di configurazione. */
export const DOC_PARAMETRI = 'parametri';

/**
 * ID di documento a partire dal codice articolo.
 *
 * 34 codici su 1.063 contengono "/" (TELO25/4, RETE15/5), che Firestore non
 * accetta negli ID perche' separa i segmenti di percorso. Il codice originale
 * resta sempre nel campo "codice": questo e' solo l'indirizzo.
 */
export function idCodice(codice: string): string {
  return encodeURIComponent(codice);
}

/** ID di una riga sede-articolo. */
export function idStatistica(sede: string, codice: string): string {
  return `${sede}_${idCodice(codice)}`;
}
