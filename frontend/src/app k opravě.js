import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
  // Stav pro úkony servisu
  const [serviceTasks, setServiceTasks] = useState([
    { id: 1, name: 'Demontáž pneu', type: 'Standardní', note: '', count: 0 },
    { id: 2, name: 'Montáž pneu', type: 'Standardní', note: '', count: 0 },
    { id: 3, name: 'Demontáž pneu z disku', type: 'Standardní', note: '', count: 0 },
    { id: 4, name: 'Montáž pneu na disk', type: 'Standardní', note: '', count: 0 },
    { id: 5, name: 'Vyvážení pneu', type: 'Standardní', note: '', count: 0 },
    { id: 6, name: 'Kompletní služba', type: 'Standardní', note: '', count: 0 },
    { id: 7, name: 'Huštění pneu plynem', type: 'Standardní', note: '', count: 0 },
    { id: 8, name: 'Dohuštění pneu plynem', type: 'Standardní', note: '', count: 0 },
    { id: 9, name: 'Oprava duše záplatou', type: 'Standardní', note: '', count: 0 },
    { id: 10, name: 'Oprava duše ventil plátem', type: 'Standardní', note: '', count: 0 },
    { id: 11, name: 'Oprava pneu hříbkem', type: 'Standardní', note: '', count: 0 },
    { id: 12, name: 'Oprava pneu vložkou', type: 'Standardní', note: '', count: 0 },
    { id: 13, name: 'Prořezání dezénu pneu', type: 'Standardní', note: '', count: 0 },
    // Další úkony...
  ]);

  // Funkce pro aktualizaci počtu úkonů
 const updateTaskCount = (id, newCount) => {
    setServiceTasks(tasks =>
      tasks.map(task =>
        task.id === id ? { ...task, count: Math.max(0, newCount) } : task
      )
    );
  };

const initialTireStates = {
    LP1: false, PP1: false, LP2: false, PP2: false, // Sólo/tahač
    LZ1: false, PZ1: false, LZ2: false, PZ2: false, // ...
    LZ3: false, PZ3: false, LZ4: false, PZ4: false, R1: false, // ...
    L1: false, P1: false, L2: false, P2: false, // Přípojné vozidlo
    L3: false, P3: false, L4: false, P4: false, // ...
    L5: false, P5: false, L6: false, P6: false, R2: false, // ...
  };

  const [tires, setTires] = useState(initialTireStates);

  // Funkce pro změnu stavu pneumatiky
    const toggleTire = tire => {
    setTires(prev => {
      const newTireStates = { ...prev, [tire]: !prev[tire] };
      
      // Aktualizace počtu úkonů
      const updatedTasks = serviceTasks.map(task => {
        if ((tire === 'LP1' || tire === 'LP2' || tire === 'PP1' || tire === 'PP2') && (task.id >= 1 && task.id <= 5)) {
          return { ...task, count: task.count + (newTireStates[tire] ? 1 : -1) };
        } else if ((tire.startsWith('L') || tire.startsWith('P') || tire.startsWith('R') )  && (task.id >= 1 && task.id <= 4)) {
          return { ...task, count: task.count + (newTireStates[tire] ? 1 : -1) };
        }
        return task;
      });

      setServiceTasks(updatedTasks);
      return newTireStates;
    });
  };


 // Funkce pro aktualizaci poznámky
  const updateNote = (id, newNote) => {
    setServiceTasks(tasks =>
      tasks.map(task =>
        task.id === id ? { ...task, note: newNote } : task
      )
    );
  };
// Stavy a funkce pro kontextové menu
  const [contextMenu, setContextMenu] = useState({ visible: false, position: { x: 0, y: 0 }, tire: null });
  const longPressTimer = useRef(null);

  const handleContextMenu = (event, tire) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      position: { x: event.clientX, y: event.clientY },
      tire: tire
    });
  };

  const handleTouchStart = (event, tire) => {
    event.preventDefault();
    longPressTimer.current = setTimeout(() => {
      setContextMenu({
        visible: true,
        position: { x: event.touches[0].clientX, y: event.touches[0].clientY },
        tire: tire
      });
    }, 2000); // Dlouhý stisk 2 sekundy
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
  };

  return (
    <div className="App">
      {/* Hlavička */}
      <header className="d-flex justify-content-between p-3 mb-2 bg-light header">
        {/* Levá část - Logo */}
        <div className="header-section header-logo">
          {/* Místo pro Logo */}
        </div>

        {/* Střední část - Nadpis a výběr vozidla */}
        <div className="header-section header-middle">
          <h1>Montážní list</h1>
          <div className="input-group">
            <label htmlFor="tachometerState">Stav tacho:</label>
            <input type="number" id="tachometerState" name="tachometerState" />
          </div>
          <div className="input-group">
            <label htmlFor="vehicleType">Typ vozidla:</label>
            <select id="vehicleType" name="vehicleType">
              <option value="MOTO">MOTO</option>
              <option value="OS">OS</option>
              <option value="C">C</option>
              <option value="N">N</option>
              <option value="AGRO">AGRO</option>
              <option value="EM">EM</option>
            </select>
          </div>
        </div>

        {/* Pravá část - Informace o vozidle a mechanikovi */}
        <div className="header-section header-right">
          <div className="input-group">
            <label htmlFor="licensePlate">RZ:</label>
            <input type="text" id="licensePlate" name="licensePlate" />
          </div>
          <div className="input-group">
            <label htmlFor="company">Firma:</label>
            <input type="text" id="company" name="company" />
          </div>
          <div className="input-group">
            <label htmlFor="mechanic">Mechanik:</label>
            <input type="text" id="mechanic" name="mechanic" />
          </div>
        </div>
      </header>

      {/* Hlavní obsah */}
 <div className="main-content">
        {/* Levá část - Úkony servisu */}
        <div className="left-section">
          <table className="table">
            <thead>
              <tr>
                <th>Úkon</th>
                <th>Počet</th>
                <th>Typ</th>
                <th>Poznámka</th>
              </tr>
            </thead>
            <tbody>
              {serviceTasks.map(task => (
                <tr key={task.id}>
                  <td>{task.name}</td>
                  <td className="count-control">
                    <button 
                      className="count-btn"
                      onClick={() => updateTaskCount(task.id, task.count - 1)}>-</button>
                    <input
                      type="number"
                      className="task-count-input"
                      value={task.count}
                      onChange={e => updateTaskCount(task.id, parseInt(e.target.value) || 0)}
                    />
                    <button 
                      className="count-btn"
                      onClick={() => updateTaskCount(task.id, task.count + 1)}>+</button>
                  </td>
                  <td>{task.type}</td>
                  <td>
                    <input
                      type="text"
                      value={task.note}
                      onChange={e => updateNote(task.id, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pravá část - Pneumatiky */}
<div className="right-section">
  {/* První dva řádky s dvěma tlačítky */}
 <b> Tahač/sólo  </b>  
<div className="tire-row">
    <div className="tire-column"></div> {/* Prázdný sloupec pro zarovnání */}
    <div className="tire-column">
      <button className={`tire-button ${tires.LP1 ? 'active' : ''}`} onClick={() => toggleTire('LP1')}>LP1</button>
    </div>
    <div className="tire-column">
      <button className={`tire-button ${tires.PP1 ? 'active' : ''}`} onClick={() => toggleTire('PP1')}>PP1</button>
    </div>
    <div className="tire-column"></div> {/* Prázdný sloupec pro zarovnání */}
  </div>
  <div className="tire-row">
    <div className="tire-column"></div> {/* Prázdný sloupec pro zarovnání */}
    <div className="tire-column">
      <button className={`tire-button ${tires.LP2 ? 'active' : ''}`} onClick={() => toggleTire('LP2')}>LP2</button>
    </div>
    <div className="tire-column">
      <button className={`tire-button ${tires.PP2 ? 'active' : ''}`} onClick={() => toggleTire('PP2')}>PP2</button>
    </div>
    <div className="tire-column"></div> {/* Prázdný sloupec pro zarovnání */}
  </div>

  {/* Třetí a čtvrtý řádek se čtyřmi tlačítky */}
  <div className="tire-row">
    <div className="tire-column">
      <button className={`tire-button ${tires.LZ1 ? 'active' : ''}`} onClick={() => toggleTire('LZ1')}>LZ1</button>
    </div>
    <div className="tire-column">
      <button className={`tire-button ${tires.LZ2 ? 'active' : ''}`} onClick={() => toggleTire('LZ2')}>LZ2</button>
    </div>
    <div className="tire-column">
      <button className={`tire-button ${tires.PZ2 ? 'active' : ''}`} onClick={() => toggleTire('PZ2')}>PZ2</button>
    </div>
    <div className="tire-column">
      <button className={`tire-button ${tires.PZ1 ? 'active' : ''}`} onClick={() => toggleTire('PZ1')}>PZ1</button>
    </div>
  </div>
  <div className="tire-row">
    <div className="tire-column">
      <button className={`tire-button ${tires.LZ3 ? 'active' : ''}`} onClick={() => toggleTire('LZ3')}>LZ3</button>
    </div>
    <div className="tire-column">
      <button className={`tire-button ${tires.LZ4 ? 'active' : ''}`} onClick={() => toggleTire('LZ4')}>LZ4</button>
    </div>
    <div className="tire-column">
      <button className={`tire-button ${tires.PZ4 ? 'active' : ''}`} onClick={() => toggleTire('PZ4')}>PZ4</button>
    </div>
    <div className="tire-column">
      <button className={`tire-button ${tires.PZ3 ? 'active' : ''}`} onClick={() => toggleTire('PZ3')}>PZ3</button>
    </div>
 </div>
<div className="tire-row">
          {/* Tlačítko R1 pro tahač/sólo */}
          <div className="tire-column">
            <button className={`tire-button ${tires.R1 ? 'active' : ''}`} onClick={() => toggleTire('R1')}>R1</button>
          </div>
       </div>
{/* Přípojné vozidlo */}

<b> Přípojné vozidlo  </b>

<div className="tire-row">
    <div className="tire-column">
      <button className={`tire-button ${tires.L1 ? 'active' : ''}`} onClick={() => toggleTire('L1')}>L1</button>
    </div>
    <div className="tire-column">
      <button className={`tire-button ${tires.L2 ? 'active' : ''}`} onClick={() => toggleTire('L2')}>L2</button>
    </div>
    <div className="tire-column">
      <button className={`tire-button ${tires.P2 ? 'active' : ''}`} onClick={() => toggleTire('P2')}>P2</button>
    </div>
    <div className="tire-column">
      <button className={`tire-button ${tires.P1 ? 'active' : ''}`} onClick={() => toggleTire('P1')}>P1</button>
    </div>
  </div>
 <div className="tire-row">
    <div className="tire-column">
      <button className={`tire-button ${tires.L3 ? 'active' : ''}`} onClick={() => toggleTire('L3')}>L3</button>
    </div>
    <div className="tire-column">
      <button className={`tire-button ${tires.L4 ? 'active' : ''}`} onClick={() => toggleTire('L4')}>L4</button>
    </div>
    <div className="tire-column">
      <button className={`tire-button ${tires.P4 ? 'active' : ''}`} onClick={() => toggleTire('P4')}>P4</button>
    </div>
    <div className="tire-column">
      <button className={`tire-button ${tires.P3 ? 'active' : ''}`} onClick={() => toggleTire('P3')}>P3</button>
    </div>
  </div>   
<div className="tire-row">
    <div className="tire-column">
      <button className={`tire-button ${tires.L5 ? 'active' : ''}`} onClick={() => toggleTire('L5')}>L5</button>
    </div>
    <div className="tire-column">
      <button className={`tire-button ${tires.L6 ? 'active' : ''}`} onClick={() => toggleTire('L6')}>L6</button>
    </div>
    <div className="tire-column">
      <button className={`tire-button ${tires.P6 ? 'active' : ''}`} onClick={() => toggleTire('P6')}>P6</button>
    </div>
    <div className="tire-column">
      <button className={`tire-button ${tires.P5 ? 'active' : ''}`} onClick={() => toggleTire('P5')}>P5</button>
    </div>
  </div>   
<div className="tire-row">
          {/* Tlačítko R2 pro přívěsné vozidlo */}
          <div className="tire-column">
            <button className={`tire-button ${tires.R2 ? 'active' : ''}`} onClick={() => toggleTire('R2')}>R2</button>
          </div>
       </div>

  
</div></div></div>
  );
}

 {Object.keys(tires).map(tire => (
            <div key={tire} className="tire-button-container">
              <button
                className={`tire-button ${tires[tire] ? 'active' : ''}`}
                onClick={() => toggleTire(tire)}
                onContextMenu={(e) => handleContextMenu(e, tire)}
                onTouchStart={(e) => handleTouchStart(e, tire)}
                onTouchEnd={handleTouchEnd}
              >
                {tire}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Kontextové Menu */}
      {contextMenu.visible && (
        <div
          className="context-menu"
          style={{ top: contextMenu.position.y, left: contextMenu.position.x }}
          onMouseLeave={() => setContextMenu({ visible: false, position: { x: 0, y: 0 }, tire: null })}
        >
          <ul className="context-menu-list">
            <li onClick={() => handleContextMenuAction('TPMS')}>TPMS</li>
            <li onClick={() => handleContextMenuAction('Správa pneu')}>Správa pneu</li>
            <li onClick={() => handleContextMenuAction('Detaily')}>Detaily</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function handleContextMenuAction(action) {
  console.log(`Akce ${action} vybrána`);
  // Zde můžete implementovat logiku pro každou akci
}

export default App;