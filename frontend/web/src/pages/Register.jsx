import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api';
import { useAuth } from '../context/useAuth';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    if (password !== confirmPassword) {
      setError('Le password non corrispondono');
      setLoading(false);
      return;
    }
    
    try {
      const response = await authAPI.register({ email, password });
      const { token } = response.data;
      
      login(token);
      navigate('/wallet');
    } catch (err) {
      setError(err.response?.data?.error || 'Registrazione fallita');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <aside className="auth-story">
          <div className="brand-lockup">
            <img className="brand-logo" src="/bitzza-logo-original.png" alt="" />
            <span>BITZZA</span>
          </div>
          <div className="auth-story-copy">
            <span className="story-kicker">VALORE, IN MOVIMENTO</span>
            <h1>Un modo più semplice di tenere tutto insieme.</h1>
            <p>Un wallet demo pensato per connettere persone, pizzerie e filiere locali.</p>
          </div>
          <div className="auth-story-footer">
            <span className="story-orbit" aria-hidden="true">✳</span>
            <span>Una demo digitale, radicata nel territorio.</span>
          </div>
        </aside>

        <section className="auth-card" aria-labelledby="register-title">
          <div className="auth-heading">
            <span className="auth-eyebrow">IL TUO SPAZIO BITZZA</span>
            <h2 id="register-title">Inizia da qui.</h2>
            <p>Crea un account per esplorare il wallet demo.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="register-email">Email</label>
              <input
                type="email"
                id="register-email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-field">
              <label htmlFor="register-password">Password</label>
              <div className="password-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="register-password"
                  autoComplete="new-password"
                  required
                  minLength="8"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  aria-describedby="register-password-hint"
                />
                <button
                  type="button"
                  className="password-visibility"
                  aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? 'Nascondi' : 'Mostra'}
                </button>
              </div>
              <span id="register-password-hint" className="field-hint">Usa almeno 8 caratteri.</span>
            </div>

            <div className="form-field">
              <label htmlFor="confirm-password">Conferma password</label>
              <div className="password-input-wrap">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirm-password"
                  autoComplete="new-password"
                  required
                  minLength="8"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                  aria-invalid={confirmPassword.length > 0 && password !== confirmPassword}
                />
                <button
                  type="button"
                  className="password-visibility"
                  aria-label={showConfirmPassword ? 'Nascondi conferma password' : 'Mostra conferma password'}
                  aria-pressed={showConfirmPassword}
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                >
                  {showConfirmPassword ? 'Nascondi' : 'Mostra'}
                </button>
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <span className="field-hint field-hint-error" role="status">Le password non corrispondono.</span>
              )}
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button type="submit" disabled={loading} className="primary-button">
              {loading ? 'Creazione…' : 'Crea account'}
              <span aria-hidden="true">↗</span>
            </button>
          </form>

          <div className="auth-footer">
            <span>Hai già un account?</span>
            <Link to="/login" className="text-link">Accedi</Link>
          </div>
          <p className="auth-demo-note">BITZZA Wallet · Ambiente demo</p>
        </section>
      </section>
    </main>
  );
};

export default Register;
