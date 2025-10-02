import React, { useState, useEffect } from 'react';
import TyreButton from './TyreButton'; // Komponenta pro zobrazení tlačítka pneumatiky
import AxleButton from './AxleButton'; // Komponenta pro zobrazení tlačítka nápravy

const TyreControls = () => {
  const [axles, setAxles] = useState([]);

  useEffect(() => {
    // Funkce pro načtení detailů šablony vozidla č. 1
    const fetchVehicleTemplate = async () => {
      try {
        // Upravíme URL pro načtení detailů šablony vozidla č. 1
        const url = `${process.env.REACT_APP_API_URL}/templates/1`;
        console.log('Fetching vehicle template data for template ID: 1');
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        setAxles(data); // Předpokládáme, že data jsou přímo pole náprav
      } catch (error) {
        console.error('Error fetching vehicle template data:', error);
      }
    };

    fetchVehicleTemplate();
  }, []);

  // Vytvoření tlačítek pro pneumatiky a nápravy na základě dat
  const renderAxlesAndTyres = () => {
    return axles.map((axle, index) => (
      <div key={index} className="axle-section">
        <AxleButton label={`N${axle.axlePosition} ${axle.axleType}${axle.driveType}`} />
        {Array.from({ length: axle.mountType === '1' ? 1 : 2 }).map((_, idx) => (
          <React.Fragment key={idx}>
            <TyreButton label={`L${axle.section}${axle.axlePosition}${idx + 1}`} />
            <TyreButton label={`P${axle.section}${axle.axlePosition}${idx + 1}`} />
          </React.Fragment>
        ))}
      </div>
    ));
  };

  return (
    <div className="vehicle-controls">
      {axles.length > 0 ? renderAxlesAndTyres() : <p>Loading axles and tyres...</p>}
    </div>
  );
};

export default TyreControls;
