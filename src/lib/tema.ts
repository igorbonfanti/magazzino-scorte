import { useEffect, useState } from 'react';

export type Tema = 'chiaro' | 'scuro';

const CHIAVE = 'scorte.tema';

function temaIniziale(): Tema {
  try {
    const salvato = localStorage.getItem(CHIAVE);
    if (salvato === 'chiaro' || salvato === 'scuro') return salvato;
  } catch {
    /* niente localStorage: si parte dalle preferenze del sistema */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'scuro' : 'chiaro';
}

/** Tema chiaro o scuro, ricordato fra una visita e l'altra. La stampa resta sempre chiara. */
export function useTema(): [Tema, () => void] {
  const [tema, setTema] = useState<Tema>(temaIniziale);

  useEffect(() => {
    document.documentElement.dataset.tema = tema;
    try {
      localStorage.setItem(CHIAVE, tema);
    } catch {
      /* si continua senza ricordarselo */
    }
  }, [tema]);

  return [tema, () => setTema((t) => (t === 'scuro' ? 'chiaro' : 'scuro'))];
}
