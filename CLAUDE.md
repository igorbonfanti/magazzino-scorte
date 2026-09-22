# magazzino-scorte — istruzioni per chi lavora su questo repository

App di conteggio giacenze e riordino per due punti vendita, Via Ferraris 3 e
Via La Spezia 10. In produzione su GitHub Pages, usata ogni giorno da due
magazzinieri.

---

## Le tre cose da non fare senza chiedere

**1. Non toccare le formule del motore** (`src/engine.ts`). Sono verificate riga
per riga contro 1.590 righe attese. Cambiare una formula significa rifare quella
verifica, e i numeri che ne escono sono ordini veri di merce vera.

```
puntoRiordino   = ceil(max(G · LT/5,  G + F · (LT−5)/5))
scortaSicurezza = max(0, round(puntoRiordino − V · LT/5))
lottoOrdine     = LM > 0 ? max(LM, ceil(L/LM) · LM) : L
scortaMassima   = puntoRiordino + lottoOrdine
scortaMedia     = scortaSicurezza + ceil(lottoOrdine/2)
```

**2. Non modificare `src/data/scorte_seed.json` a mano.** È generato da un altro
progetto, `ottimizzazione-scorte`, a partire dalle fatture elettroniche e dai
listini. Una modifica fatta qui sparisce alla rigenerazione successiva, e nel
frattempo i numeri non corrispondono più a nulla di verificabile. Se un valore
è sbagliato, si corregge là.

**3. Non far scrivere niente a Firestore per provare.** Le collection `scorte_*`
sono quelle di produzione, e le regole agganciano i nomi esatti: non esiste un
prefisso di prova. Per guardare l'app con dati diversi c'è il ramo
`anteprima-seed-2026-09`, che legge la base dal file e stacca Firestore dalla
rete all'avvio. Vedi il fondo di questo file.

---

## Com'è organizzata la verifica, e perché

I test sono divisi in due, e la divisione è voluta.

**`tests/engine.test.ts`, `money`, `ordine`, `confezioni`, `conteggio` leggono
`tests/fixture_motore.json`**, che è una copia **congelata** del seed di
settembre 2026. Insieme a `tests/scorte_attesi.json` — 1.590 righe
sede-articolo calcolate fuori da qui — formano la verifica indipendente del
motore.

**`tests/seed.test.ts` legge il seed VIVO**, quello che l'app importa. Lì non
ci sono numeri scritti a mano: ci sono le proprietà che devono valere comunque
— ogni sorvegliato presente in entrambe le sedi, costi in centesimi interi,
classi e cicli coerenti, ID Firestore validi e distinti, e i casi di verifica
del seed che tornano col motore.

**Perché così.** Prima tutti i test leggevano il seed vivo. Quando i consumi
sono stati rielaborati a settembre 2026, dodici test sono diventati rossi senza
che il motore fosse cambiato: avevano dentro i conteggi del vecchio dataset
(1.063 articoli, 75 sorvegliati, 34 codici con la barra, i totali in euro).
Riallinearli ai numeri nuovi li avrebbe trasformati in una verifica di sé
stessi — il motore confrontato col proprio output.

Se rielabori i consumi e qualcosa diventa rosso in `engine.test.ts`, **il
problema è nel motore, non nei dati**: la fixture non cambia.

---

## Cosa è cambiato a settembre 2026

Il seed è stato rifatto da zero. Sostanza del cambiamento:

| | prima | adesso |
|---|---|---|
| articoli in anagrafica | 1.063 | **4.189** (tutto il listino attivo) |
| righe per sede | 920 / 670 | **1.334 / 1.334** |
| elenco sorvegliato | 75 | **102** |
| fonte | un foglio Excel | fatture elettroniche FatturaPA |

**Perché l'anagrafica è tutta.** Serve poter cercare e mettere in monitoraggio
qualunque codice dall'app, non solo quelli già sorvegliati. Gli articoli senza
statistiche ci sono lo stesso: `parametri()` restituisce `undefined` e le
pagine mostrano "non venduto qui". È voluto.

**Perché ogni sorvegliato ha la riga in tutte e due le sedi.** Dove non si è
venduto, la riga c'è a zero con la nota. Così la regola "ogni sorvegliato esiste
in entrambe le sedi" vale per costruzione.

Cosa era andato storto nella vecchia analisi, in breve: leggeva i PDF delle
fatture a colonne, e i codici di otto caratteri o più si fondevano con la
descrizione (`RETEPVC150` diventava `RETEPVC1R5E0TE`). **166 articoli
risultavano fermi mentre si muovevano**, per 76.000 euro di venduto. Fra questi
i contenitori PVC, che risultavano immobili da otto mesi.

---

## Le forzature sull'elenco sorvegliato

Quando si aggiunge o si toglie un articolo dalla pagina **Elenco sorvegliato**,
oltre all'elenco viene registrato il **delta rispetto al file di partenza**, in
`forzati_dentro` e `forzati_fuori` dentro il documento dei parametri. Alla
prossima importazione quel delta viene riapplicato sopra l'elenco nuovo.

La logica sta in `src/lib/sorvegliati.ts`, è pura e ha i suoi test
(`tests/sorvegliati.test.ts`). **Non salvare l'elenco finale e basta**: così un
articolo che intanto è entrato da solo nella selezione automatica non resta
marcato come forzatura, e uno che ne è uscito non ci rientra di straforo.

Prima non era così: l'importazione riscriveva l'elenco col suo e le scelte
fatte a mano sparivano senza lasciare traccia. Corretto il 22/09/2026.

## L'importazione scrive, non cancella

Ogni documento ha un ID costruito dal codice, quindi reimportare riscrive gli
stessi documenti invece di duplicarli. Ma **i codici usciti dal listino
restano**: al primo import di settembre 2026 erano rimasti `PP10CO` e `TRA`
(passati fra i dismessi), più le righe di consumo di `COMO` e `ORMO`.

Dopo l'importazione la pagina elenca i residui e offre un bottone per
toglierli. È un bottone separato apposta: cancellare è l'unica operazione che
non si rifà al contrario, e chi la lancia deve prima aver visto cosa sparisce.
Le rilevazioni non vengono mai toccate.

---

## Cosa sapere sui numeri, prima di fidarsene

- **Il 9,6% del venduto non è attribuibile.** 486 righe stanno su un codice
  jolly `000`, battute senza articolo in anagrafica. Sono 78.558 euro che non
  entrano nel consumo di nessuno. È così nel gestionale, non è un errore di
  lettura.
- **Il periodo è gennaio–agosto 2026**, otto mesi: non contiene un ciclo
  stagionale completo. Agosto vale il 40% di un mese normale.
- **Le vendite di commessa sono tenute fuori dal consumo** ma restano nel
  venduto: un cantiere che ritira 608 sacchi in un giorno non si è servito
  dalla scorta. Le righe toccate lo dicono nel campo `nota`.
- **La classe A/B/C è per frequenza di uscita, non per valore.** Decide solo
  ogni quanto si riordina (15/30/90 giorni). Il punto di riordino e la scorta
  di sicurezza non dipendono dalla classe.

---

## Provare senza toccare la produzione

```bash
git checkout anteprima-seed-2026-09
npm run dev -- --mode anteprima      # serve .env.anteprima con VITE_ANTEPRIMA=1
```

Legge la base dal seed invece che da Firestore e stacca la rete di Firestore
all'avvio. Serve perché nel browser può esserci una sessione Firebase ancora
valida: senza, l'app leggerebbe le rilevazioni vere dei magazzinieri e un clic
su "chiudi rilevazione" arriverebbe in produzione.

Verifica dalla console che sia davvero staccato:

```js
performance.getEntriesByType('resource')
  .filter(e => /firestore\.googleapis|securetoken/.test(e.name)).length   // 0
```

---

## Deploy

Il push su `main` pubblica su GitHub Pages, e il workflow lancia `npm test`
prima del build: **con i test rossi il deploy non parte**.

Pubblicare non cambia quello che vedono i magazzinieri: i dati stanno su
Firestore e cambiano solo quando qualcuno preme "Importa dati" dentro l'app.
