/** Esportazione CSV nel formato che Excel italiano apre senza chiedere nulla. */
export function scaricaCsv(nomeFile: string, righe: (string | number)[][]): void {
  const testo = righe
    .map((riga) =>
      riga
        .map((cella) => {
          const s = String(cella ?? '');
          return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(';'),
    )
    .join('\r\n');

  // BOM: senza, Excel sbaglia gli accenti
  const blob = new Blob(['﻿' + testo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFile;
  a.click();
  URL.revokeObjectURL(url);
}

export function dataOggi(): string {
  return new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function dataOra(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
