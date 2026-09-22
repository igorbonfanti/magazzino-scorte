/**
 * Le scelte fatte a mano sull'elenco sorvegliato, e come sopravvivono a una
 * nuova importazione.
 *
 * L'elenco arriva dal file di partenza, ma dalla pagina "Elenco sorvegliato"
 * si aggiungono e si tolgono articoli: sono decisioni di chi sta a magazzino e
 * non devono sparire quando i consumi vengono rielaborati. Si registra il
 * delta - cosa e' stato messo dentro e cosa tolto - e alla prossima
 * importazione lo si riapplica sopra l'elenco nuovo.
 *
 * Non si salva l'elenco finale e basta: cosi' un articolo che nel frattempo e'
 * entrato da solo nella selezione automatica non resta marcato come forzatura,
 * e uno che ne e' uscito non ci rientra di straforo.
 */

export interface Forzature {
  dentro: string[];
  fuori: string[];
}

/** Cosa e' stato cambiato a mano, confrontando con l'elenco del file. */
export function calcolaForzature(daSeed: string[], adesso: string[]): Forzature {
  const nelSeed = new Set(daSeed);
  const nellElenco = new Set(adesso);
  return {
    dentro: adesso.filter((c) => !nelSeed.has(c)),
    fuori: daSeed.filter((c) => !nellElenco.has(c)),
  };
}

/**
 * L'elenco del file nuovo, con le forzature rimesse sopra.
 *
 * `esiste` serve a non far rientrare un codice che nel frattempo e' sparito
 * dall'anagrafica: sarebbe un sorvegliato senza articolo, e le pagine che lo
 * cercano non lo troverebbero.
 */
export function applicaForzature(
  daSeed: string[],
  forzature: Partial<Forzature> | undefined,
  esiste: (codice: string) => boolean = () => true,
): string[] {
  const fuori = new Set(forzature?.fuori ?? []);
  const dentro = (forzature?.dentro ?? []).filter((c) => esiste(c) && !daSeed.includes(c));
  return [...daSeed.filter((c) => !fuori.has(c)), ...dentro];
}
