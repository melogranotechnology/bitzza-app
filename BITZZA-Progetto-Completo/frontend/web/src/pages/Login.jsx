import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api';
import { useAuth } from '../context/useAuth';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await authAPI.login({ email, password });
      const { token } = response.data;
      
      login(token);
      navigate('/wallet');
    } catch (err) {
      const message = err.response?.data?.error;
      setError(message === 'Invalid credentials'
        ? 'Email o password non corretti.'
        : message || 'Impossibile accedere. Riprova.');
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

        <section className="auth-card" aria-labelledby="login-title">
          <div className="auth-heading">
            <span className="auth-eyebrow">AREA PERSONALE</span>
            <h2 id="login-title">Bentornato.</h2>
            <p>Accedi per continuare nel tuo wallet BITZZA.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="login-email">Email</label>
              <input
                type="email"
                id="login-email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-field">
              <label htmlFor="login-password">Password</label>
              <div className="password-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  autoComplete="current-password"
                  required
                  minLength="8"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
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
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button type="submit" disabled={loading} className="primary-button">
              {loading ? 'Accesso…' : 'Accedi al wallet'}
              <span aria-hidden="true">↗</span>
            </button>
          </form>

          <div className="auth-footer">
            <span>Non hai un account?</span>
            <Link to="/register" className="text-link">Crealo adesso</Link>
          </div>
          <p className="auth-demo-note">BITZZA Wallet · Ambiente demo</p>
        </section>
      </section>
    </main>
  );
};

export default Login;
