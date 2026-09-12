import type { Articolo, DettaglioConteggio } from '../types';
import { descriviCollo } from './confezioni';

/**
 * Regole del conteggio a magazzino, senza React né Firebase.
 *
 * Chi conta non digita un totale: batte i colli interi e poi aggiunge gli
 * sfusi. Teniamo le due cose separate, non solo la somma, così un conteggio
 * sbagliato si può ricontrollare senza rifarlo.
 */

/** Il totale è sempre ricalcolato da colli e sfusi, mai digitato a mano. */
export function totaleContato(d: DettaglioConteggio): number {
  return d.colli * d.pezziPerCollo + d.sfusi;
}

/** Quanti pezzi vale un collo per questo articolo, contando. */
export function pezziPerCollo(articolo: Pick<Articolo, 'pezzi_per_collo' | 'lotto_minimo'>): number {
  const scelto = articolo.pezzi_per_collo;
  if (scelto && scelto > 0) return scelto;
  return articolo.lotto_minimo > 0 ? articolo.lotto_minimo : 0;
}

/**
 * L'etichetta del tasto grande: "1 bancale (30)", "40 rotoli", "30 pezzi".
 * Se l'articolo non ha collo, non c'è tasto e si contano solo i pezzi.
 */
export function etichettaCollo(articolo: Pick<Articolo, 'lotto_nota' | 'pezzi_per_collo' | 'lotto_minimo'>): string | null {
  const quanti = pezziPerCollo(articolo);
  if (quanti <= 0) return null;
  const collo = descriviCollo(articolo.lotto_nota);
  if (collo.nome) return `1 ${collo.nome} (${quanti})`;
  if (collo.unita) return `${quanti} ${collo.unita}`;
  return `${quanti} pezzi`;
}

/** Come si legge il conteggio in corso: "10 bancali + 7 sfusi". */
export function descriviConteggio(
  d: DettaglioConteggio,
  articolo: Pick<Articolo, 'lotto_nota'>,
): string {
  const collo = descriviCollo(articolo.lotto_nota);
  const pezzi: string[] = [];
  if (d.colli > 0) {
    const nome = collo.nome
      ? d.colli === 1
        ? collo.nome
        : plurale(collo.nome)
      : d.colli === 1
        ? 'collo'
        : 'colli';
    pezzi.push(`${d.colli} ${nome} da ${d.pezziPerCollo}`);
  }
  if (d.sfusi > 0) pezzi.push(`${d.sfusi} sfusi`);
  return pezzi.join(' + ');
}

function plurale(nome: string): string {
  if (nome.endsWith('e')) return nome.slice(0, -1) + 'i';
  if (nome.endsWith('a')) return nome.slice(0, -1) + 'e';
  if (nome.endsWith('o')) return nome.slice(0, -1) + 'i';
  return nome;
}

export interface Coda {
  /** i codici ancora da contare, nell'ordine in cui proporli */
  daContare: string[];
  contati: number;
  totale: number;
}

/**
 * Cosa proporre e in che ordine.
 *
 * Si va nell'ordine del gruppo scelto, saltando quelli già contati. Chi è
 * stato messo da parte torna in fondo, non sparisce: è l'errore che fa finire
 * un conteggio con dei buchi che nessuno nota.
 */
export function costruisciCoda(codiciDelGruppo: string[], contati: Set<string>, saltati: Set<string>): Coda {
  const primi: string[] = [];
  const inCoda: string[] = [];
  for (const codice of codiciDelGruppo) {
    if (contati.has(codice)) continue;
    if (saltati.has(codice)) inCoda.push(codice);
    else primi.push(codice);
  }
  return {
    daContare: [...primi, ...inCoda],
    contati: codiciDelGruppo.filter((c) => contati.has(c)).length,
    totale: codiciDelGruppo.length,
  };
}
