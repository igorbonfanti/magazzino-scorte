import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccesso } from '../lib/auth';
import {
  costruisciCoda,
  descriviConteggio,
  etichettaCollo,
  pezziPerCollo,
  totaleContato,
} from '../lib/conteggio';
import { ordineTipologia } from '../lib/tipologie';
import { formattaIntero } from '../money';
import { NOMI_SEDI, SEDI } from '../seed';
import { useScorte } from '../store';
import type { DettaglioConteggio, Sede } from '../types';

type Raggruppamento = 'tipologia' | 'fornitore';

const VUOTO: DettaglioConteggio = { colli: 0, sfusi: 0, pezziPerCollo: 0 };

/**
 * Conteggio a magazzino, per il telefono.
 *
 * Regole di questa schermata, imparate provandola con chi la usa:
 * ogni comando e' un tasto grande con scritto cosa fa, mai un link ne' una
 * scritta piccola; niente e' facoltativo o a discrezione di chi conta; e
 * quello che si e' gia' contato si puo' sempre correggere, perche' sapere di
 * poter tornare indietro e' quello che evita di fermarsi a meta' giro.
 *
 * Il conteggio resta alla cieca: non si mostra quanto dovrebbe esserci,
 * perche' vedere il numero atteso fa confermare invece di contare.
 */
export default function Conta() {
  const s = useScorte();
  const { profilo, logout } = useAccesso();
  const admin = profilo?.ruolo === 'admin';

  const [sede, setSede] = useState<Sede | null>(null);
  const [raggruppa, setRaggruppa] = useState<Raggruppamento>('tipologia');
  const [gruppo, setGruppo] = useState<string | null>(null);
  const [correzione, setCorrezione] = useState<string | null>(null);
  const [elencoCorrezioni, setElencoCorrezioni] = useState(false);
  const [ultimoContato, setUltimoContato] = useState<string | null>(null);
  const [bozza, setBozza] = useState<DettaglioConteggio>(VUOTO);
  const [lampeggia, setLampeggia] = useState(0);
  const campoSfusi = useRef<HTMLInputElement | null>(null);

  const rilevazione = sede ? s.rilevazioneAperta(sede) : undefined;

  // tiene acceso lo schermo mentre si conta, dove il browser lo permette
  useEffect(() => {
    let rilascia: (() => void) | undefined;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => void }> } };
    nav.wakeLock
      ?.request('screen')
      .then((blocco) => {
        rilascia = () => blocco.release();
      })
      .catch(() => {
        /* non supportato o negato: pazienza */
      });
    return () => rilascia?.();
  }, []);

  const gruppi = useMemo(() => {
    if (!sede) return [];
    const contati = new Set(Object.keys(rilevazione?.righe ?? {}));
    const mappa = new Map<string, { totale: number; mancanti: number }>();
    for (const codice of s.sorvegliati) {
      const a = s.articoli[codice];
      if (!a || !s.statistica(sede, codice)) continue;
      const chiave = raggruppa === 'tipologia' ? a.tipologia : a.fornitore;
      const voce = mappa.get(chiave) ?? { totale: 0, mancanti: 0 };
      voce.totale++;
      if (!contati.has(codice)) voce.mancanti++;
      mappa.set(chiave, voce);
    }
    return [...mappa.entries()]
      .sort((a, b) =>
        raggruppa === 'tipologia' ? ordineTipologia(a[0]) - ordineTipologia(b[0]) : a[0].localeCompare(b[0], 'it'),
      )
      .map(([nome, voce]) => ({ nome, ...voce }));
  }, [s, sede, raggruppa, rilevazione]);

  const coda = useMemo(() => {
    if (!sede) return { daContare: [], contati: 0, totale: 0 };
    const contati = new Set(Object.keys(rilevazione?.righe ?? {}));
    const saltati = new Set(rilevazione?.saltati ?? []);
    const codici = s.sorvegliati.filter((codice) => {
      const a = s.articoli[codice];
      if (!a || !s.statistica(sede, codice)) return false;
      if (gruppo === null) return true;
      return (raggruppa === 'tipologia' ? a.tipologia : a.fornitore) === gruppo;
    });
    return costruisciCoda(codici, contati, saltati);
  }, [s, sede, gruppo, raggruppa, rilevazione]);

  /** gli articoli gia' contati, i piu' recenti per primi: sono quelli da correggere */
  const contati = useMemo(() => {
    if (!rilevazione) return [];
    return s.sorvegliati
      .filter((codice) => rilevazione.righe[codice] !== undefined && s.articoli[codice])
      .map((codice) => ({
        codice,
        descrizione: s.articoli[codice].descrizione,
        quantita: rilevazione.righe[codice],
      }));
  }, [rilevazione, s]);

  const codiceCorrente = correzione ?? coda.daContare[0] ?? null;
  const articolo = codiceCorrente ? s.articoli[codiceCorrente] : null;
  const perCollo = articolo ? pezziPerCollo(articolo) : 0;
  const etichetta = articolo ? etichettaCollo(articolo) : null;

  /**
   * Cambiando articolo si riparte da zero, tranne quando si sta correggendo:
   * li' si ricomincia da quello che era stato contato, altrimenti bisogna
   * ricontare tutto da capo per cambiare un sacco.
   */
  useEffect(() => {
    if (correzione && rilevazione) {
      const precedente = rilevazione.dettaglio?.[correzione];
      if (precedente) {
        setBozza({ ...precedente, pezziPerCollo: precedente.pezziPerCollo || perCollo });
        return;
      }
      setBozza({ colli: 0, sfusi: rilevazione.righe[correzione] ?? 0, pezziPerCollo: perCollo });
      return;
    }
    setBozza({ colli: 0, sfusi: 0, pezziPerCollo: perCollo });
    // rilevazione volutamente fuori dalle dipendenze: serve solo il valore di partenza
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codiceCorrente, perCollo, correzione]);

  function esci() {
    if (admin) window.location.hash = '#/rilevazione';
    else void logout();
  }

  /* ---- 1. in che magazzino siamo ---- */

  if (!sede) {
    return (
      <div className="conta">
        <div className="conta-scelta">
          <h1>In che magazzino sei?</h1>
          <p className="conta-spiega">Prima scegli dove stai contando.</p>

          {SEDI.map((quale) => {
            const aperta = s.rilevazioneAperta(quale);
            const fatti = aperta ? Object.keys(aperta.righe).length : 0;
            return (
              <button
                key={quale}
                className="tasto-elenco grande"
                onClick={() => {
                  setSede(quale);
                  setGruppo(null);
                  s.cambiaSede(quale);
                }}
              >
                <span className="nome">{NOMI_SEDI[quale]}</span>
                <span className="quanti">
                  {aperta
                    ? `${formattaIntero(fatti)} di ${formattaIntero(s.sorvegliati.length)} già contati`
                    : 'nessun conteggio aperto'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="conta-comandi">
          <button className="tasto-largo chiaro" onClick={esci}>
            {admin ? 'TORNA ALL’APP' : 'ESCI'}
          </button>
        </div>
      </div>
    );
  }

  /* ---- 2. aprire il conteggio ---- */

  if (!rilevazione) {
    return (
      <div className="conta">
        <div className="conta-vuoto">
          <h1>{NOMI_SEDI[sede]}</h1>
          <p className="conta-spiega">Qui non c&rsquo;è ancora un conteggio aperto.</p>
          <button className="tasto-largo verde" onClick={() => s.apriRilevazione(sede)}>
            COMINCIA IL CONTEGGIO
          </button>
        </div>
        <div className="conta-comandi">
          <button className="tasto-largo chiaro" onClick={() => setSede(null)}>
            CAMBIA MAGAZZINO
          </button>
        </div>
      </div>
    );
  }

  /* ---- 3. correggere un articolo gia' contato ---- */

  if (elencoCorrezioni) {
    return (
      <div className="conta">
        <div className="conta-scelta">
          <h1>Quale vuoi correggere?</h1>
          <p className="conta-spiega">
            {contati.length === 0
              ? 'Non hai ancora contato niente.'
              : 'Tocca l’articolo: riparte dal numero che avevi messo.'}
          </p>

          {contati.map((c) => (
            <button
              key={c.codice}
              className="tasto-elenco"
              onClick={() => {
                setCorrezione(c.codice);
                setElencoCorrezioni(false);
              }}
            >
              <span className="nome">{c.descrizione}</span>
              <span className="quanti forte">{formattaIntero(c.quantita)}</span>
            </button>
          ))}
        </div>

        <div className="conta-comandi">
          <button className="tasto-largo chiaro" onClick={() => setElencoCorrezioni(false)}>
            TORNA A CONTARE
          </button>
        </div>
      </div>
    );
  }

  /* ---- 4. da quale reparto partiamo ---- */

  if (gruppo === null) {
    return (
      <div className="conta">
        <div className="conta-scelta">
          <h1>Da dove cominci?</h1>

          <div className="conta-interruttore">
            <button className={raggruppa === 'tipologia' ? 'attivo' : ''} onClick={() => setRaggruppa('tipologia')}>
              PER MATERIALE
            </button>
            <button className={raggruppa === 'fornitore' ? 'attivo' : ''} onClick={() => setRaggruppa('fornitore')}>
              PER FORNITORE
            </button>
          </div>

          {gruppi.map((g) => (
            <button
              key={g.nome}
              className="tasto-elenco"
              onClick={() => setGruppo(g.nome)}
              disabled={g.mancanti === 0}
            >
              <span className="nome">{g.nome}</span>
              <span className={`quanti ${g.mancanti === 0 ? 'finito' : ''}`}>
                {g.mancanti === 0 ? 'tutto contato' : `ne restano ${g.mancanti}`}
              </span>
            </button>
          ))}
        </div>

        <div className="conta-comandi">
          {contati.length > 0 && (
            <button className="tasto-largo chiaro" onClick={() => setElencoCorrezioni(true)}>
              CORREGGI UN ARTICOLO
            </button>
          )}
          <button className="tasto-largo chiaro" onClick={() => setSede(null)}>
            CAMBIA MAGAZZINO
          </button>
        </div>
      </div>
    );
  }

  /* ---- 5. reparto finito ---- */

  if (!codiceCorrente || !articolo) {
    const mancanti = s.sorvegliati.length - Object.keys(rilevazione.righe).length;
    return (
      <div className="conta">
        <div className="conta-vuoto">
          <div className="conta-fatto">✓</div>
          <h1>{gruppo}</h1>
          <p className="conta-spiega">
            Contato tutto. In questo magazzino ne restano {formattaIntero(mancanti)} da contare.
          </p>
        </div>
        <div className="conta-comandi">
          <button className="tasto-largo verde" onClick={() => setGruppo(null)}>
            SCEGLI UN ALTRO REPARTO
          </button>
          {contati.length > 0 && (
            <button className="tasto-largo chiaro" onClick={() => setElencoCorrezioni(true)}>
              CORREGGI UN ARTICOLO
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ---- 6. il conteggio ---- */

  const totale = totaleContato(bozza);
  const fatti = coda.totale - coda.daContare.length;

  function batti(quantiColli: number) {
    setBozza((b) => ({ ...b, colli: Math.max(0, b.colli + quantiColli), pezziPerCollo: perCollo }));
    setLampeggia((n) => n + 1);
  }

  function battiSfusi(quanti: number) {
    setBozza((b) => ({ ...b, sfusi: Math.max(0, b.sfusi + quanti), pezziPerCollo: perCollo }));
    setLampeggia((n) => n + 1);
  }

  function conferma(valore: DettaglioConteggio) {
    s.scriviConteggio(rilevazione!.id, codiceCorrente!, valore);
    setUltimoContato(codiceCorrente);
    setCorrezione(null);
    campoSfusi.current?.blur();
  }

  return (
    <div className="conta">
      {correzione && (
        <div className="conta-correzione">
          STAI CORREGGENDO — prima avevi contato {formattaIntero(rilevazione.righe[correzione] ?? 0)}
        </div>
      )}

      {!correzione && (
        <div className="conta-avanzamento">
          <div className="barra">
            <div className="pieno" style={{ width: `${(fatti / Math.max(1, coda.totale)) * 100}%` }} />
          </div>
          <span>
            {gruppo} · ne restano <strong>{formattaIntero(coda.daContare.length)}</strong>
          </span>
        </div>
      )}

      <main className="conta-articolo">
        <h1>{articolo.descrizione}</h1>
        <p className="conta-codice">
          {articolo.codice} · {articolo.um}
        </p>

        <div className="conta-totale" key={lampeggia}>
          {formattaIntero(totale)}
        </div>
        <p className="conta-composizione">
          {totale === 0 ? 'non hai ancora contato niente' : descriviConteggio(bozza, articolo)}
        </p>

        {etichetta && (
          <div className="conta-riga-tasti">
            <button className="tasto-collo" onClick={() => batti(1)}>
              <span className="piu">+</span> {etichetta.toUpperCase()}
            </button>
            <button className="tasto-passo" onClick={() => batti(-1)} disabled={bozza.colli === 0}>
              −
            </button>
          </div>
        )}

        <div className="conta-sfusi">
          <span className="etichetta-sfusi">{etichetta ? 'PEZZI SFUSI' : 'PEZZI'}</span>
          <div className="conta-riga-tasti">
            <button className="tasto-passo" onClick={() => battiSfusi(-1)} disabled={bozza.sfusi === 0}>
              −
            </button>
            <input
              ref={campoSfusi}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={bozza.sfusi === 0 ? '' : bozza.sfusi}
              placeholder="0"
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const v = Number(e.target.value);
                setBozza((b) => ({
                  ...b,
                  sfusi: Number.isFinite(v) && v > 0 ? Math.trunc(v) : 0,
                  pezziPerCollo: perCollo,
                }));
              }}
            />
            <button className="tasto-passo piu" onClick={() => battiSfusi(1)}>
              +
            </button>
          </div>
        </div>
      </main>

      <div className="conta-comandi">
        <button className="tasto-largo verde" onClick={() => conferma(bozza)} disabled={totale === 0}>
          {correzione ? `CORREGGI IN ${formattaIntero(totale)}` : `CONFERMA ${formattaIntero(totale)}`}
        </button>

        {correzione ? (
          <button className="tasto-largo chiaro" onClick={() => setCorrezione(null)}>
            LASCIA COM’ERA
          </button>
        ) : (
          <>
            <div className="conta-due">
              <button
                className="tasto-largo chiaro"
                onClick={() => conferma({ colli: 0, sfusi: 0, pezziPerCollo: perCollo })}
              >
                NON C’È NIENTE
              </button>
              <button
                className="tasto-largo chiaro"
                onClick={() => {
                  s.segnaSaltato(rilevazione.id, codiceCorrente, true);
                  setBozza(VUOTO);
                }}
              >
                SALTA QUESTO
              </button>
            </div>
            <div className="conta-due">
              <button
                className="tasto-largo chiaro"
                disabled={!ultimoContato}
                onClick={() => setCorrezione(ultimoContato)}
              >
                CORREGGI L’ULTIMO
              </button>
              <button className="tasto-largo chiaro" onClick={() => setGruppo(null)}>
                ALTRO REPARTO
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
