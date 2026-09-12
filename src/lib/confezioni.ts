/**
 * Da "quanti pezzi ordinare" a "quanti colli chiedere al fornitore".
 *
 * La quantità da ordinare è sempre un multiplo del lotto minimo, quindi il
 * numero di colli è esatto. Come si chiama il collo lo dice la nota del lotto
 * ("bancale da 192 pezzi", "40 rotoli", "espositore da 12"), che è scritta a
 * mano in "Articoli e lotti": quando la nota non si lascia interpretare si
 * ripiega su una forma neutra, senza inventare nulla.
 */

const PLURALI: Record<string, string> = {
  bancale: 'bancali',
  bancali: 'bancali',
  fascio: 'fasci',
  scatola: 'scatole',
  scatole: 'scatole',
  cartone: 'cartoni',
  cartoni: 'cartoni',
  confezione: 'confezioni',
  confezioni: 'confezioni',
  espositore: 'espositori',
  cassa: 'casse',
  pacco: 'pacchi',
  secchio: 'secchi',
  sacco: 'sacchi',
  rotolo: 'rotoli',
  latta: 'latte',
  fustino: 'fustini',
};

export interface Colli {
  /** quanti colli, o null se l'articolo non ha lotto minimo */
  quanti: number | null;
  /** come dirlo: "8 bancali", "2 × 40 rotoli", "3 × 50" */
  testo: string;
}

/**
 * @param daOrdinare quantità da ordinare, nell'unità di misura dell'articolo
 * @param lottoMinimo 0 = nessun lotto minimo
 * @param lottoNota come si ordina, testo libero
 */
export function contaColli(daOrdinare: number, lottoMinimo: number, lottoNota: string): Colli {
  if (lottoMinimo <= 0 || daOrdinare <= 0) return { quanti: null, testo: '—' };

  const quanti = Math.round(daOrdinare / lottoMinimo);
  const nota = (lottoNota ?? '').trim().toLowerCase();

  // "bancale da 192 pezzi", "fascio da 16 pezzi", "cartone 18 rotoli + 18 in omaggio"
  const contenitore = /^([a-zàèéìòù]+)/.exec(nota)?.[1];
  if (contenitore && PLURALI[contenitore]) {
    const nome = quanti === 1 ? contenitore : PLURALI[contenitore];
    return { quanti, testo: `${quanti} ${nome}` };
  }

  // "40 rotoli", "100 sacchi", "6 bombole": il numero in testa è la misura del lotto,
  // e il collo non ha un nome suo. Si dice quante volte quel lotto.
  const sciolto = /^(\d+)\s+([a-zàèéìòù]+)/.exec(nota);
  if (sciolto && Number(sciolto[1]) === lottoMinimo) {
    const unita = `${lottoMinimo} ${sciolto[2]}`;
    return { quanti, testo: quanti === 1 ? unita : `${quanti} × ${unita}` };
  }

  return { quanti, testo: `${quanti} × ${lottoMinimo}` };
}

export interface Collo {
  /** come si chiama il contenitore: "bancale", "fascio"... null se non ne ha uno */
  nome: string | null;
  /** cosa c'e' dentro: "sacchi", "rotoli"... null se la nota non lo dice */
  unita: string | null;
}

/**
 * Legge la nota del lotto per capire come si chiama il collo e cosa contiene.
 * Serve alle etichette del conteggio a magazzino: "1 bancale (30)".
 */
export function descriviCollo(lottoNota: string): Collo {
  const nota = (lottoNota ?? '').trim().toLowerCase();
  if (!nota) return { nome: null, unita: null };

  const contenitore = /^([a-zàèéìòù]+)/.exec(nota)?.[1];
  if (contenitore && PLURALI[contenitore]) {
    // "bancale da 30 sacchi", "cartone 18 rotoli + 18 in omaggio"
    const dentro = /\d+\s+([a-zàèéìòù]+)/.exec(nota)?.[1] ?? null;
    return { nome: contenitore, unita: dentro };
  }

  // "40 rotoli", "6 bombole": nessun contenitore, ma sappiamo cosa si conta
  const sciolto = /^\d+\s+([a-zàèéìòù]+)/.exec(nota)?.[1];
  return { nome: null, unita: sciolto ?? null };
}
