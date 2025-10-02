// Soubor: ./components/AxleButton.js
import React from 'react';

const AxleButton = ({ axleLabel, onClick, onContextMenu }) => (
  <div className="axle-button-container" onContextMenu={(e) => onContextMenu(e, axleLabel)}>
    <button
      className="axle-button"
      onClick={() => onClick(axleLabel)}
    >
      <div className="button-content">
        <div className="axle-label">{axleLabel}</div>
      </div>
    </button>
  </div>
);

export default AxleButton;
