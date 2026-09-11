/**
 * Tutti gli importi viaggiano in centesimi interi.
 * Nessun calcolo monetario in virgola mobile.
 */

/** Somma di importi in centesimi. */
export function sommaCent(valori: readonly number[]): number {
  let tot = 0;
  for (const v of valori) tot += Math.trunc(v);
  return tot;
}

/** Prodotto quantità (intera) × prezzo unitario in centesimi. */
export function moltiplicaCent(quantita: number, prezzoCent: number): number {
  return Math.trunc(quantita) * Math.trunc(prezzoCent);
}

/** "77.848" centesimi -> "778,48" */
export function formattaCent(cent: number): string {
  const n = Math.trunc(cent);
  const negativo = n < 0;
  const abs = Math.abs(n);
  const intero = Math.floor(abs / 100);
  const dec = String(abs % 100).padStart(2, '0');
  return `${negativo ? '-' : ''}${formattaIntero(intero)},${dec}`;
}

/** "77.848" centesimi -> "778,48 €" */
export function formattaEuro(cent: number): string {
  return `${formattaCent(cent)} €`;
}

/** Separatore delle migliaia italiano: 1185 -> "1.185" */
export function formattaIntero(n: number): string {
  const negativo = n < 0;
  const cifre = String(Math.abs(Math.trunc(n)));
  let out = '';
  for (let i = 0; i < cifre.length; i++) {
    if (i > 0 && (cifre.length - i) % 3 === 0) out += '.';
    out += cifre[i];
  }
  return (negativo ? '-' : '') + out;
}

/** Numero con un decimale, virgola italiana: 14.2 -> "14,2" */
export function formattaDecimale(n: number, decimali = 1): string {
  const fattore = 10 ** decimali;
  const arrotondato = Math.round(n * fattore) / fattore;
  const intero = Math.trunc(Math.abs(arrotondato));
  const resto = Math.abs(arrotondato) - intero;
  const dec = String(Math.round(resto * fattore)).padStart(decimali, '0');
  const segno = arrotondato < 0 ? '-' : '';
  return decimali > 0 ? `${segno}${formattaIntero(intero)},${dec}` : `${segno}${formattaIntero(intero)}`;
}

/** Da euro con virgola/punto a centesimi interi (input admin). */
export function euroACent(testo: string): number | null {
  const pulito = testo.trim().replace(/\./g, '').replace(',', '.');
  if (pulito === '' || !/^-?\d+(\.\d{0,2})?$/.test(pulito)) return null;
  const [int, dec = ''] = pulito.replace('-', '').split('.');
  const cent = Number(int) * 100 + Number((dec + '00').slice(0, 2));
  return pulito.startsWith('-') ? -cent : cent;
}
