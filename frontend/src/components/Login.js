import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Login({ setIsAuthenticated, setUserRoutes }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const url = process.env.REACT_APP_API_URL + '/login';
    console.log('Posílám na URL:', url);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();

        // validace tvaru odpovědi
        if (!data.token || !Array.isArray(data.routes)) {
          setError('Chybná odpověď serveru.');
          return;
        }

        // fallback pro prázdné routes
        const routes = data.routes.length > 0
          ? data.routes
          : ['/servicesheet', '/klientimap'];

        // uložení do localStorage
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userRoutes', JSON.stringify(routes));

        // aktualizovat stav v App.js
        setIsAuthenticated(true);
        if (setUserRoutes) {
          setUserRoutes(routes);
        }

        // přesměrovat na výchozí stránku
        navigate('/servicesheet', { replace: true });
      }
      else if (response.status === 401) {
        setError('Nesprávné uživatelské jméno nebo heslo');
      }
      else {
        setError('Chyba serveru. Zkuste to prosím později.');
      }
    }
    catch (err) {
      console.error('Chyba při fetch:', err);
      setError('Nepodařilo se spojit se serverem. Podívejte se do konzole.');
    }
  };

  return (
    <div className="login-box">
      <div className="login-logo">
        <b>Vaše</b>Logo
      </div>
      <div className="card">
        <div className="card-body login-card-body">
          <p className="login-box-msg">Přihlaste se pro zahájení relace</p>
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="input-group mb-3">
              <input
                type="text"
                className="form-control"
                placeholder="Uživatelské jméno"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
              />
              <div className="input-group-append">
                <div className="input-group-text">
                  <span className="fas fa-user"></span>
                </div>
              </div>
            </div>

            <div className="input-group mb-3">
              <input
                type="password"
                className="form-control"
                placeholder="Heslo"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <div className="input-group-append">
                <div className="input-group-text">
                  <span className="fas fa-lock"></span>
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block">
              Přihlásit
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
