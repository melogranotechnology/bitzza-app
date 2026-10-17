import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Wallet from './pages/Wallet';
import './App.css';

const Swap = lazy(() => import('./pages/Swap'));

function RequireAuth({ children }) {
  return localStorage.getItem('token')
    ? children
    : <Navigate to="/login" replace />;
}

function HomeRedirect() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setReady(true), 1000);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!ready) {
    return (
      <main className="brand-splash" aria-label="BITZZA si sta aprendo">
        <div className="splash-content">
          <img src="/bitzza-logo-original.png" alt="Logo originale BITZZA" />
          <span className="splash-wordmark">BITZZA</span>
          <span className="splash-caption">Valore locale, in movimento</span>
          <span className="splash-progress" role="status">Apertura wallet…</span>
        </div>
      </main>
    );
  }

  return <Navigate to={localStorage.getItem('token') ? '/wallet' : '/login'} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/wallet"
          element={
            <RequireAuth>
              <Wallet />
            </RequireAuth>
          }
        />
        <Route
          path="/swap"
          element={<Suspense fallback={<p>Caricamento…</p>}><Swap /></Suspense>}
        />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
