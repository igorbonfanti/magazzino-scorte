/**
 * Chi e' chi, per UID.
 *
 * Deve restare allineato a firestore.rules: le regole decidono cosa il
 * database concede davvero, questo file decide solo cosa l'app fa vedere.
 * Se qui ci fosse un UID in piu', quella persona vedrebbe dei menu che poi
 * non funzionano; se ne mancasse uno, si troverebbe fuori da pagine a cui
 * avrebbe diritto. Aggiungendo una persona si tocca sempre tutti e due.
 *
 * Si e' scelto di NON tenere il ruolo in un documento Firestore: due sistemi
 * di permessi sullo stesso progetto divergono, e chi si ritrova col ruolo
 * sbagliato nel documento resta chiuso fuori senza modo di rimediare da solo.
 */

/** Accesso completo, gli stessi UID di autorizzato() nelle regole. */
export const UID_AMMINISTRATORI = [
  '0nGqBTD30QTsovcf7f19KASy9Eg1', // bonfanti.igor
  '4Dak4tLe20O8gWtnSOh3h7Z3h5X2', // amministrazione
  'iJRRRJDpvSeKwqfU1bJKQ3oSNy83', // commerciale
  'pET8M4MguvfvZaEwt2DilGwRUuC2', // carnevale.carlino
] as const;

/** Solo il conteggio, gli stessi UID di magazziniere() nelle regole. */
export const UID_MAGAZZINIERI = [
  'g6SSbwfEfrMPZCDKLZExsUxzmDJ3', // Arturo
  'QCW0XAmHr0WGjeaPYGmyuOtkW4s2', // Charlie
] as const;

export function eAmministratore(uid: string): boolean {
  return (UID_AMMINISTRATORI as readonly string[]).includes(uid);
}

export function eMagazziniere(uid: string): boolean {
  return (UID_MAGAZZINIERI as readonly string[]).includes(uid);
}

/** Chi non e' in nessuno dei due elenchi non ha niente da fare qui. */
export function riconosciuto(uid: string): boolean {
  return eAmministratore(uid) || eMagazziniere(uid);
}
