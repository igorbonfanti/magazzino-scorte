import { useState } from 'react';
import { messaggioErroreAuth, useAccesso } from '../lib/auth';
import { seed } from '../seed';

/** Schermata di accesso: email e password, come le altre app del magazzino. */
export default function Accesso() {
  const { login } = useAccesso();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState('');
  const [inCorso, setInCorso] = useState(false);

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    setErrore('');
    setInCorso(true);
    try {
      await login(email, password);
    } catch (err) {
      setErrore(messaggioErroreAuth(err));
      setInCorso(false);
    }
  }

  return (
    <div className="accesso">
      <form className="accesso-riquadro" onSubmit={invia}>
        <h1>Scorte</h1>
        <p className="sottotitolo">Il Magazzino Edile — consumi {seed.meta.periodo_consumi}</p>

        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {errore && <p className="accesso-errore">{errore}</p>}

        <button className="tasto-grosso" type="submit" disabled={inCorso}>
          {inCorso ? 'Attendi…' : 'Entra'}
        </button>

        <p className="accesso-nota">
          Le credenziali le crea l&rsquo;amministratore. Se non riesci a entrare, chiedi a Igor.
        </p>
      </form>
    </div>
  );
}
