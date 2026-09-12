# Scorte — Il Magazzino Edile

Porta sul web il modello `SCORTE_OTTIMALI_2026.xlsx`: gli operatori delle due sedi
contano le giacenze dal loro PC e l'ordine del giorno si compila da solo.

**In linea:** https://igorbonfanti.github.io/magazzino-scorte/

## Cosa fa

| Pagina | A cosa serve |
|---|---|
| **Conteggio** (`#/conta`) | Schermata a tutto schermo per il telefono di chi conta: un articolo alla volta, un tasto grande che batte un collo intero, gli sfusi a parte. Conteggio alla cieca, con contatore di quanti ne mancano. |
| **Rilevazione** | I 75 articoli sorvegliati: si scrive la giacenza contata e si vede subito cosa ordinare. Con Invio si passa alla riga sotto, la bozza si salva da sola. |
| **Modulo da stampare** | Il foglio cartaceo per chi conta in magazzino, raggruppato per tipologia di materiale o per fornitore. |
| **Ordine del giorno** | Le righe da ordinare, divise per fornitore, con quantità, colli e giorni di consegna. Stampa A4 ed esportazione CSV. |
| **Prontuario** | Le colonne del foglio di calcolo, colorate per classe, con il valore medio della scorta. |
| **Tempi di consegna** | I giorni di ogni fornitore. Si cambiano qui e tutto si ricalcola. |
| **Articoli e lotti** | Fornitore, lotto minimo, come si ordina, tipologia di materiale, rifornimento dall'altra sede. |
| **Elenco sorvegliato** | Quali articoli entrano nel prontuario e in che ordine. |
| **Variazioni** | Cosa è cambiato passando dai 5 giorni uguali per tutti ai tempi per fornitore. |
| **Sintesi** | Articoli, costo del venduto, giacenza media e picco, per sede e per classe. |
| **Storico** | Le rilevazioni fatte, con il dettaglio in sola lettura. |

## Come si calcola

I consumi — medie, picchi, classi, cicli — **non** si calcolano nell'app: arrivano
già elaborati dai movimenti di gennaio–agosto 2026, nel file
[`src/data/scorte_seed.json`](src/data/scorte_seed.json). L'app calcola solo ciò
che dipende dai parametri modificabili:

```
puntoRiordino   = ceil(max(G · LT / 5, G + F · (LT − 5) / 5))
scortaSicurezza = max(0, round(puntoRiordino − V · LT / 5))
lottoOrdine     = LM > 0 ? max(LM, ceil(L / LM) · LM) : L
scortaMassima   = puntoRiordino + lottoOrdine
scortaMedia     = scortaSicurezza + ceil(lottoOrdine / 2)
```

dove `F` e `G` sono il consumo settimanale medio e massimo, `L` il lotto
calcolato, `V` il consumo medio su 5 giorni, `LT` i giorni di consegna del
fornitore e `LM` il lotto minimo. Tutto in [`src/engine.ts`](src/engine.ts),
funzioni pure senza dipendenze.

Gli importi viaggiano sempre in **centesimi interi**
([`src/money.ts`](src/money.ts)): nessun calcolo monetario in virgola mobile.

## Dove stanno i dati

**In questa prima versione i dati stanno nel browser** (`localStorage`), sul
computer di chi usa l'app. Questo significa che:

- le rilevazioni e le modifiche ai parametri **non sono condivise** fra le due sedi
  né fra computer diversi;
- svuotando i dati del sito si perde tutto;
- non c'è login: chi apre l'indirizzo vede tutto.

Tutto l'accesso ai dati passa da un unico modulo,
[`src/store.tsx`](src/store.tsx): è il punto da riscrivere su Firestore nella
fase successiva, senza toccare le pagine.

## Sviluppo

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 42 test: motore, importi, colli, ordine del giorno, conteggio
npm run build
```

I test confrontano il motore con
[`tests/scorte_attesi.json`](tests/scorte_attesi.json): tutte e 1.590 le righe
sede-articolo devono coincidere esattamente, e i 35 casi di rilevazione del
foglio di calcolo devono dare stesso stato, stessa quantità e stessi giorni
residui.

## Pubblicazione

Ogni push su `main` fa partire
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): installa, esegue
i test, compila e pubblica su GitHub Pages. Se i test falliscono non si pubblica
niente.

Il `base` in [`vite.config.ts`](vite.config.ts) deve coincidere con il nome del
repository, altrimenti su Pages non si caricano CSS e JavaScript.

**Da fare una volta sola, su un repository nuovo:** in Settings > Pages,
*Build and deployment* > *Source*, scegliere **GitHub Actions**. Il workflow non
puo' farlo da solo: creare il sito Pages richiede i permessi di amministratore,
che il token delle Actions non ha. Senza questo passaggio il workflow fallisce
con `Create Pages site failed: Resource not accessible by integration`.

## Cosa manca, in ordine

1. **Accessi e archivio condiviso** con Firebase Auth e Firestore, sul progetto
   già esistente. Collezioni con prefisso `scorte_`, regole da aggiungere a
   quelle attuali senza sostituirle. I codici articolo con `/` (34 su 1.063)
   vanno negli ID come `encodeURIComponent(codice)`, tenendo il codice originale
   in un campo a parte.
2. **Aggiornamento dei consumi**: nuovo seed elaborato con lo stesso metodo, senza
   toccare il motore.
3. **Giacenze automatiche** dal gestionale Zucchetti tramite la VM G2, al posto
   del conteggio a mano.
