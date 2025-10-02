// Header.js
import React, { useState } from 'react';
import './Header.css';

const Header = ({ searchTerm, setSearchTerm, fetchSearchResults, vehicleType, companyName }) => {
  const [searchResults, setSearchResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
const handleSuggestionSelect = (vehicle) => {
    // Implementujte logiku pro výběr vozidla z našeptávače
    // Například aktualizace stávajících stavů
    setSearchTerm(vehicle.RZ);
    setShowSuggestions(false);
  };

  return (
    <header className="d-flex justify-content-between p-3 mb-2 bg-light header">
      <div className="header-section header-logo">
        {/* Místo pro Logo */}
      </div>

      <div className="header-section header-middle">
        <h1>Montážní list</h1>
        <div className="input-group">
          <label htmlFor="tachometerState">Stav tacho:</label>
          <input type="number" id="tachometerState" name="tachometerState" />
        </div>
        <div className="input-group">
          <label htmlFor="vehicleType">Typ vozidla:</label>
          <input type="text" id="vehicleType" name="vehicleType" value={vehicleType} readOnly />
        </div>
      </div>

      <div className="header-section header-right">
        <div className="input-group">
          <label htmlFor="companyName">Společnost:</label>
          <input type="text" id="companyName" name="companyName" value={companyName} readOnly />
        </div>
        <div className="input-group">
          <label htmlFor="licensePlate">RZ:</label>
          <input
            type="text"
            id="licensePlate"
            name="licensePlate"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyUp={() => fetchSearchResults()}
          />
          {showSuggestions && (
            <ul className="search-results">
              {searchResults.map((vehicle, index) => (
                <li key={index} onClick={() => handleSuggestionSelect(vehicle)}>
                  {vehicle.RZ}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
