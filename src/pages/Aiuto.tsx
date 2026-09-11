import { seed } from '../seed';

export default function Aiuto() {
  return (
    <section className="testo">
      <h2>Come si usa e come si calcola</h2>

      <h3>Il giro di tutti i giorni</h3>
      <ol>
        <li>Scegli la sede in alto a destra.</li>
        <li>
          Apri la <strong>Rilevazione</strong>, conta la merce e scrivi la giacenza. Con Invio passi alla riga sotto,
          la bozza si salva da sola.
        </li>
        <li>
          Vai all&rsquo;<strong>Ordine del giorno</strong>: esce già diviso per fornitore, con le quantità arrotondate
          ai lotti. Stampalo o esportalo in CSV.
        </li>
        <li>
          Quando hai finito, <strong>Chiudi rilevazione</strong>: le giacenze non si toccano più e il conteggio resta
          nello Storico.
        </li>
      </ol>

      <h3>Punto di riordino</h3>
      <p>
        Con 5 giorni di consegna il punto di riordino è il consumo della settimana più alta. Con un tempo diverso si
        prende il più prudente fra due calcoli: la settimana di punta scalata in proporzione ai giorni, oppure la
        settimana di punta più o meno i giorni di differenza a consumo medio. Quando la giacenza contata scende a quel
        valore o sotto, l&rsquo;articolo va ordinato.
      </p>

      <h3>Lotto d&rsquo;ordine</h3>
      <p>
        Il lotto calcolato viene portato al primo multiplo utile del lotto minimo del fornitore (bancale, scatola,
        pacco). Senza lotto minimo resta il lotto calcolato. Il lotto minimo si cambia in <strong>Articoli e lotti</strong>.
      </p>

      <h3>Scorte</h3>
      <ul>
        <li>Scorta di sicurezza: il punto di riordino meno il consumo medio previsto durante l&rsquo;attesa.</li>
        <li>Scorta massima: punto di riordino più lotto d&rsquo;ordine. È il magazzino appena arrivata la merce.</li>
        <li>Scorta media: scorta di sicurezza più metà lotto. È il capitale mediamente fermo.</li>
      </ul>

      <h3>Quanto ordinare</h3>
      <p>
        Si riporta la giacenza alla scorta massima, e comunque mai meno di un lotto d&rsquo;ordine; il risultato viene
        poi portato al multiplo del lotto minimo.
      </p>

      <h3>Classi e frequenza</h3>
      <ul>
        <li>A — i primi articoli fino all&rsquo;80% del costo del venduto, presenti in almeno 6 mesi su 8: ogni 2 settimane.</li>
        <li>B — fino al 95%, presenti in almeno 4 mesi: una volta al mese.</li>
        <li>C — tutto il resto: ogni 3 mesi.</li>
      </ul>

      <h3>Da dove arrivano i numeri</h3>
      <p>
        Medie, picchi, classi e cicli non si calcolano qui: arrivano già pronti dall&rsquo;elaborazione dei movimenti
        di {seed.meta.periodo_consumi} ({seed.meta.fonte}), con il perimetro depurato dalle fatture escluse.
        L&rsquo;app calcola solo ciò che dipende dai parametri modificabili: tempi di consegna, fornitore e lotto
        minimo. Cambiando quelli, ogni pagina si aggiorna subito.
      </p>

      <h3>Limiti da conoscere</h3>
      <p>
        Le fatture sono differite, quindi la variabilità è misurata sulle date di fattura e non sulle uscite giornaliere:
        se il gestionale riesce a estrarre il venduto per data di DDT, il calcolo migliora. Il modello non considera gli
        sconti quantità né le esigenze di assortimento a scaffale, e copre i soli articoli venduti nel 2026.
      </p>

      <h3>Dove stanno i dati, per ora</h3>
      <p>
        Rilevazioni e modifiche ai parametri sono salvate in questo browser, su questo computer. Non sono ancora
        condivise fra le due sedi: succederà con Firebase, insieme agli accessi con email e password.
      </p>
    </section>
  );
}
