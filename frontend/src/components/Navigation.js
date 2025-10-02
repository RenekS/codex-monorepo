// Navigation.js
import React from 'react';
import { Link } from 'react-router-dom';

const Navigation = () => {
  return (
    <div>
      <nav>
        <ul>
          <li>
            <Link to="/">Domů</Link>
          </li>
          <li>
            <Link to="/dashboard">Rozcestník</Link>
          </li>
          {/* Přidejte další odkazy pro navigaci zde */}
        </ul>
      </nav>
    </div>
  );
};

export default Navigation;
