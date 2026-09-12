import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
 * Conteggio a magazzino, pensato per il telefono.
 *
 * Un articolo alla volta, il tasto grande batte un collo intero, gli sfusi si
 * battono o si digitano. Il conteggio e' alla cieca: non si mostra quanto
 * dovrebbe esserci, perche' vedere il numero atteso fa confermare invece di
 * contare. Si salvano colli e sfusi separati, cosi' un conteggio dubbio si
 * ricontrolla.
 *
 * La sede non ha un valore di partenza: sceglierla e' il primo gesto
 * obbligatorio, altrimenti si conta un magazzino dentro la rilevazione
 * dell'altro e nessuno se ne accorge.
 */
export default function Conta() {
  const s = useScorte();
  const { profilo, logout } = useAccesso();
  const admin = profilo?.ruolo === 'admin';

  /** Per il magazziniere "esci" vuol dire uscire davvero: altre pagine non ne ha. */
  const Uscita = () =>
    admin ? (
      <Link className="conta-uscita" to="/rilevazione">
        torna all&rsquo;app
      </Link>
    ) : (
      <button className="conta-uscita" onClick={() => void logout()}>
        esci
      </button>
    );

  const [sede, setSede] = useState<Sede | null>(null);
  const [raggruppa, setRaggruppa] = useState<Raggruppamento>('tipologia');
  const [gruppo, setGruppo] = useState<string | null>(null);
  const [bozza, setBozza] = useState<DettaglioConteggio>(VUOTO);
  const [lampeggia, setLampeggia] = useState(0);
  const [mostraLivello, setMostraLivello] = useState(false);
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

  /** i gruppi disponibili, con quanti articoli restano da contare in ciascuno */
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

  /** i codici del gruppo scelto, nell'ordine in cui proporli */
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

  const codiceCorrente = coda.daContare[0] ?? null;
  const articolo = codiceCorrente ? s.articoli[codiceCorrente] : null;
  const perCollo = articolo ? pezziPerCollo(articolo) : 0;
  const etichetta = articolo ? etichettaCollo(articolo) : null;

  // cambiando articolo si riparte da zero
  useEffect(() => {
    setBozza({ colli: 0, sfusi: 0, pezziPerCollo: perCollo });
    setMostraLivello(false);
  }, [codiceCorrente, perCollo]);

  /* ---- primo gesto obbligatorio: in che magazzino siamo ---- */

  if (!sede) {
    return (
      <div className="conta">
        <header className="conta-testata">
          <span>Conteggio giacenze</span>
          <Uscita />
        </header>

        <div className="conta-scelta">
          <h1>In che magazzino sei?</h1>
          <p className="conta-nota-scelta">Scegli la sede prima di cominciare: il conteggio finisce lì.</p>

          <ul className="conta-gruppi">
            {SEDI.map((quale) => {
              const aperta = s.rilevazioneAperta(quale);
              const contati = aperta ? Object.keys(aperta.righe).length : 0;
              return (
                <li key={quale}>
                  <button
                    className="scelta-sede-grossa"
                    onClick={() => {
                      setSede(quale);
                      setGruppo(null);
                      // il resto dell'app segue la sede scelta qui
                      s.cambiaSede(quale);
                    }}
                  >
                    <span className="nome">{NOMI_SEDI[quale]}</span>
                    <span className="quanti">
                      {aperta
                        ? `conteggio aperto · ${formattaIntero(contati)} di ${formattaIntero(s.sorvegliati.length)} fatti`
                        : 'nessun conteggio aperto'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  /* ---- serve una rilevazione aperta per quella sede ---- */

  if (!rilevazione) {
    return (
      <div className="conta">
        <header className="conta-testata">
          <span>{NOMI_SEDI[sede]}</span>
          <button className="conta-uscita" onClick={() => setSede(null)}>
            cambia sede
          </button>
        </header>
        <div className="conta-vuoto">
          <h1>{NOMI_SEDI[sede]}</h1>
          <p>Non c&rsquo;è nessun conteggio aperto per questa sede.</p>
          <button className="tasto-grosso" onClick={() => s.apriRilevazione(sede)}>
            Comincia il conteggio
          </button>
        </div>
      </div>
    );
  }

  /* ---- da quale gruppo partiamo ---- */

  if (gruppo === null) {
    return (
      <div className="conta">
        <header className="conta-testata">
          <span>{NOMI_SEDI[sede]}</span>
          <button className="conta-uscita" onClick={() => setSede(null)}>
            cambia sede
          </button>
        </header>

        <div className="conta-scelta">
          <h1>Da dove cominci?</h1>

          <div className="conta-interruttore">
            <button className={raggruppa === 'tipologia' ? 'attivo' : ''} onClick={() => setRaggruppa('tipologia')}>
              Per materiale
            </button>
            <button className={raggruppa === 'fornitore' ? 'attivo' : ''} onClick={() => setRaggruppa('fornitore')}>
              Per fornitore
            </button>
          </div>

          <ul className="conta-gruppi">
            {gruppi.map((g) => (
              <li key={g.nome}>
                <button onClick={() => setGruppo(g.nome)} disabled={g.mancanti === 0}>
                  <span className="nome">{g.nome}</span>
                  <span className={`quanti ${g.mancanti === 0 ? 'finito' : ''}`}>
                    {g.mancanti === 0 ? 'fatto' : `${g.mancanti} da contare`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  /* ---- gruppo finito ---- */

  if (!codiceCorrente || !articolo) {
    return (
      <div className="conta">
        <header className="conta-testata">
          <span>{NOMI_SEDI[sede]}</span>
          <button className="conta-uscita" onClick={() => setSede(null)}>
            cambia sede
          </button>
        </header>
        <div className="conta-vuoto">
          <div className="conta-fatto">✓</div>
          <h1>{gruppo}: finito</h1>
          <p>
            {formattaIntero(coda.totale)} articoli contati. In tutta la sede ne restano{' '}
            {formattaIntero(s.sorvegliati.length - Object.keys(rilevazione.righe).length)}.
          </p>
          <button className="tasto-grosso" onClick={() => setGruppo(null)}>
            Scegli un altro gruppo
          </button>
        </div>
      </div>
    );
  }

  /* ---- il conteggio ---- */

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
    campoSfusi.current?.blur();
  }

  return (
    <div className="conta">
      <header className="conta-testata">
        <span>
          {NOMI_SEDI[sede]} · {gruppo}
        </span>
        <button className="conta-uscita" onClick={() => setGruppo(null)}>
          cambia
        </button>
      </header>

      <div className="conta-avanzamento">
        <div className="barra">
          <div className="pieno" style={{ width: `${(fatti / Math.max(1, coda.totale)) * 100}%` }} />
        </div>
        <span>
          {formattaIntero(fatti)} di {formattaIntero(coda.totale)} · ne restano{' '}
          <strong>{formattaIntero(coda.daContare.length)}</strong>
        </span>
      </div>

      <main className="conta-articolo">
        <h1>{articolo.descrizione}</h1>
        <p className="conta-codice">
          {articolo.codice} · {articolo.um}
          {articolo.lotto_nota && <> · {articolo.lotto_nota}</>}
        </p>

        <div className="conta-totale" key={lampeggia}>
          {formattaIntero(totale)}
        </div>
        <p className="conta-composizione">{totale === 0 ? 'niente contato' : descriviConteggio(bozza, articolo)}</p>

        {etichetta ? (
          <div className="conta-colli">
            <button className="tasto-collo" onClick={() => batti(1)}>
              <span className="piu">+</span> {etichetta}
            </button>
            <button className="tasto-meno" onClick={() => batti(-1)} disabled={bozza.colli === 0}>
              −
            </button>
          </div>
        ) : (
          <p className="conta-nota">Questo articolo non ha colli: conta i pezzi.</p>
        )}

        <div className="conta-sfusi">
          <span className="etichetta-sfusi">{etichetta ? 'più sfusi' : 'pezzi'}</span>
          <div className="conta-passo">
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

        {mostraLivello && (
          <p className="conta-livello">
            Si riordina quando scendi a{' '}
            <strong>{formattaIntero(s.parametri(sede, codiceCorrente)?.puntoRiordino ?? 0)}</strong>.
          </p>
        )}
      </main>

      <footer className="conta-comandi">
        <div className="conta-secondari">
          <button onClick={() => conferma({ colli: 0, sfusi: 0, pezziPerCollo: perCollo })}>Non ce n&rsquo;è</button>
          <button
            onClick={() => {
              s.segnaSaltato(rilevazione.id, codiceCorrente, true);
              setBozza(VUOTO);
            }}
          >
            Lo salto
          </button>
          <button onClick={() => setMostraLivello((v) => !v)}>{mostraLivello ? 'nascondi' : 'soglia'}</button>
        </div>
        <button className="tasto-avanti" onClick={() => conferma(bozza)} disabled={totale === 0}>
          Conferma {formattaIntero(totale)} e avanti
        </button>
      </footer>
    </div>
  );
}
