// Register.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // API volání pro registraci
    const response = await fetch(process.env.REACT_APP_API_URL + '/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      navigate('/login');
    } else {
      const data = await response.json();
      setError(data.message || 'Registrace se nezdařila');
    }
  };

  return (
    <div className="register-box">
      <div className="register-logo">
        <b>Registrace</b>
      </div>
      <div className="card">
        <div className="card-body register-card-body">
          <p className="login-box-msg">Registrace nového účtu</p>

          {error && <div className="alert alert-danger" role="alert">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="input-group mb-3">
              <input type="text" className="form-control" placeholder="Uživatelské jméno" value={username} onChange={(e) => setUsername(e.target.value)} required />
              <div className="input-group-append">
                <div className="input-group-text">
                  <span className="fas fa-user"></span>
                </div>
              </div>
            </div>
            <div className="input-group mb-3">
              <input type="password" className="form-control" placeholder="Heslo" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <div className="input-group-append">
                <div className="input-group-text">
                  <span className="fas fa-lock"></span>
                </div>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-block">Registrovat</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Register;
