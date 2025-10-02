import React, {useState, useEffect, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../css/App.css';
import '../css/TyreSection.css';
import TpmsModal from '../components/TpmsModal';
import TyreSection from '../components/TyreSection';
import ServiceTasksSection from './ServiceTasksSection';

function useInterval(callback, delay) {
  const savedCallback = useRef();

  // Uložení callbacku
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Nastavení intervalu
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    if (delay !== null) {
      let id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}


function ServiceSheet() {
  const [isTpmsModalOpen, setIsTpmsModalOpen] = useState(false);
  const [tpmsData, setTpmsData] = useState([]);
  const openTpmsModal = () => setIsTpmsModalOpen(true);
  const closeTpmsModal = () => setIsTpmsModalOpen(false);
  const [selectedVehicleRZ, setselectedVehicleRZ] = useState('');
  const [tyreData, setTyreData] = useState(null);
  const [selectedTyre, setSelectedTyre] = useState('');
  const [sheetData, setSheetData] = useState(null);
  const [montazniListCislo, setMontazniListCislo] = useState('');
  const [zacatek, setZacatek] = useState('');
  const [konec, setKonec] = useState('');
  const [tachometerState, setTachometerState] = useState('');
  
  const [templateId, setTemplateId] = useState(null);
 
  useEffect(() => {
    if (templateId === null) {
      setTemplateId(1);
    }
  }, [templateId]);
 // Příklad funkce pro nastavení čísla montážního listu, začátku a konce (můžete přidat logiku pro získání/aktualizaci těchto hodnot)
  const updateMontazniListInfo = () => {
    setMontazniListCislo('12345');
    setZacatek('01.01.2022 08:00');
    setKonec('01.01.2022 12:00');
    // Případně zde zavolejte API nebo jinou logiku pro získání těchto dat
  };
// funkce pro získání dat pro porovnání
const fetchComparisonData = async (selectedVehicleRZ) => {
  const url = `${process.env.REACT_APP_API_URL}/compare-tpms-data?rz=${encodeURIComponent(selectedVehicleRZ)}`;
  console.log('Fetching comparison data for RZ:', selectedVehicleRZ); 
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  return await response.json();
};
//funkce pro porovnání dat v modalu
const openTpmsModalWithComparison = async () => {
  try {
    // Zde získáte data pro porovnání
    const comparisonData = await fetchComparisonData(selectedVehicleRZ);
    // Otevření modálního okna s daty pro porovnání
    openTpmsModal(comparisonData);
  } catch (error) {
    console.error('Error fetching comparison data:', error);
  }
};
// funkce pro uložení dat montážního listu
const saveSheetData = async () => {
  const pneumatikyStav = {
    // zde připravíte data o senzorech a pracích pro jednotlivé pneumatiky
    // např. LP1: { sensorId: "80eaca0e0054", workDone: true, additionalInfo: {...} }, ...
  };

  try {
    const response = await fetch(`${process.env.REACT_APP_API_URL}/save-sheet-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cislo_montazniho_listu: '1', // předpokládáme, že číslo listu je '1'
        stav: 'hotovo', // nebo jiný stav podle aktuálních dat
        zakaznik: '...', // informace o zákazníkovi
        vozidlo: selectedVehicleRZ, // SPZ vybraného vozidla
        provedene_prace: serviceTasks, // informace o provedených pracích
        pneumatiky_stav: pneumatikyStav // data o senzorech a pracích pro pneumatiky
      })
    });
    const result = await response.text();
    console.log(result);
  } catch (error) {
    console.error('Chyba při ukládání montážního listu:', error);
  }
};


//funkce pro zachycení aktivních TPMS dat
const fetchTpmsData = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/available-tpms-sensors`);
      const data = await response.json();
      setTpmsData(data);
    } catch (error) {
      console.error('Chyba při získávání dat TPMS:', error);
    }
  };
// Funkce pro načtení dat o pneumatikách

const fetchTyreData = async () => {
  if (selectedVehicleRZ) {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/vehicle-tyre-data?rz=${encodeURIComponent(selectedVehicleRZ)}`);
      const tyreData = await response.json();

      const updatedTyreData = tyreData.reduce((acc, sensor) => {
        acc[sensor.position] = {
          active: true, // Předpokládáme, že senzor je aktivní, pokud existují data
          actualPressure: sensor.actualPressure,
          actualPressure20: sensor.actualPressure20,
          actualTemp: sensor.actualTemp
        };
        return acc;
      }, {});
      setTyreSensorData(updatedTyreData);
    } catch (error) {
      console.error('Chyba při načítání dat o pneumatikách:', error);
    }
  }
};

useEffect(() => {
  const fetchTyreData = async () => {
    try {
      // Nejprve aktualizujeme data pomocí nového endpointu
      await fetch(`${process.env.REACT_APP_API_URL}/update-parsed-data`);

      // Nyní načteme aktualizovaná data z čidel
      const response = await fetch(`${process.env.REACT_APP_API_URL}/vehicle-tyre-data?rz=${encodeURIComponent(selectedVehicleRZ)}`);
      const tyreData = await response.json();

      const updatedTyreData = tyreData.reduce((acc, sensor) => {
        acc[sensor.position] = {
          active: true, // Předpokládáme, že senzor je aktivní, pokud existují data
          actualPressure: sensor.actualPressure,
          actualPressure20: sensor.actualPressure20,
          actualTemp: sensor.actualTemp
        };
        return acc;
      }, {});
      setTyreSensorData(updatedTyreData);
    } catch (error) {
      console.error('Chyba při načítání dat o pneumatikách:', error);
    }
  };

  let interval;
  if (selectedVehicleRZ) {
    fetchTyreData(); // První načtení dat
    interval = setInterval(fetchTyreData, 10000); // Nastavení intervalu na 10 sekund
  }

  return () => {
    if (interval) {
      clearInterval(interval); // Vyčištění intervalu při změně SPZ nebo odmontování komponenty
    }
  };
}, [selectedVehicleRZ]); // Závislost na SPZ


useEffect(() => {
  // Funkce pro zavření menu při kliknutí mimo kontextové menu
  const handleClickOutside = (event) => {
    const menuElement = document.querySelector('.context-menu');
    if (menuElement && !menuElement.contains(event.target)) {
      hideContextMenu();
    }
  };

  // Přidání event listeneru na celý dokument
  document.addEventListener('click', handleClickOutside);

  // Odebrání event listeneru při demontáži komponenty
  return () => {
    document.removeEventListener('click', handleClickOutside);
  };
}, []);


  // Stav pro úkony servisu
  const [serviceTasks, setServiceTasks] = useState([]);  
  const fetchServiceTasks = async () => {
  try {
    const response = await fetch(`${process.env.REACT_APP_API_URL}/service_tasks`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    const tasksWithCorrectNoteActive = data.map(task => ({
      ...task,
      // Předpokládám, že hodnota 'noteActive' je v databázi uložena jako 1 nebo 0, 
      // a chceme ji převést na boolean (true/false)
      noteActive: task.noteActive === 1 // Toto převede 1 na true, cokoli jiného na false
    }));
    setServiceTasks(tasksWithCorrectNoteActive);
  } catch (error) {
    console.error('Error fetching service tasks:', error);
  }
};

// A nyní tuto funkci zavolejte v useEffect
useEffect(() => {
  fetchServiceTasks();
}, []); // Prázdné pole závislostí znamená, že se tato funkce zavolá pouze jednou po prvním renderování




 const [vehicleData, setVehicleData] = useState(null);
 const [tyreSensorData, setTyreSensorData] = useState({
 LP1: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 PP1: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 LP2: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 PP2: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 LZ1: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 LZ2: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 PZ1: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 PZ2: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 LZ3: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 LZ4: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 PZ3: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 PZ4: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 R1: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 R2: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 P1: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 P2: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 P3: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 P4: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 P5: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 P6: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 L1: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 L2: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 L3: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 L4: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 L5: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 },
 L6: { active: false, actualPressure: 0, actualPressure20: 0, actualTemp: 0 }
});

const toggleNoteActive = (id) => {
  setServiceTasks(tasks =>
    tasks.map(task =>
      task.id === id ? { ...task, noteActive: !task.noteActive } : task
    )
  );
};

const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, tyreLabel: '' });
// Funkce pro skrytí kontextového menu
const hideContextMenu = () => {
  setContextMenu({ visible: false, x: 0, y: 0, tyreLabel: '' });
};

const handleContextMenuAction = (action, tyreLabel) => {
  console.log(`Vykonávání akce ${action} na vozidle ${selectedVehicleRZ} a na pneumatice ${tyreLabel}`);

  if (action === 'parovaniTPMS') {
    setSelectedTyre(tyreLabel);
    fetchTpmsData();
    openTpmsModal();
  } else if (action === 'odebratSenzor') {
    if (window.confirm(`Chcete opravdu odebrat senzor z pneumatiky ${tyreLabel}?`)) {
      removeSensor(tyreLabel);
    }
  }

  hideContextMenu();
};

const removeSensor = async (tyreLabel) => {
  try {
    // Zde vytvořte požadavek na server pro odebrání senzoru
    const response = await fetch(`${process.env.REACT_APP_API_URL}/remove-sensor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ RZ: selectedVehicleRZ, position: tyreLabel }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // Zpracování odpovědi a aktualizace stavu aplikace
    console.log('Senzor byl úspěšně odebrán');
    // Zde můžete přidat další akce, např. aktualizaci stavu aplikace
    fetchTyreData(); // Příklad aktualizace dat o pneumatikách
  } catch (error) {
    console.error('Error removing sensor:', error);
  }
};


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
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [tachographKm, setTachographKm] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [companyName, setCompanyName] = useState('');  
  

  useEffect(() => {
    const fetchVehicleData = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/search-vehicles?term=${encodeURIComponent(searchTerm)}`);
        const data = await response.json();
        setVehicleData(data);
      } catch (error) {
        console.error('Error fetching vehicle data:', error);
      }
    };

    if (searchTerm) {
      fetchVehicleData();
    }
  }, [searchTerm]);

  useEffect(() => {
  if (vehicleData && vehicleData.length > 0) {
    const tyreData = vehicleData[0].tyreSensors.split(',').reduce((acc, sensor) => {
      const [position, actualPressure, actualPressure20, actualTemp] = sensor.split('|');
      acc[position] = { active: false, actualPressure, actualPressure20, actualTemp };
      return acc;
    }, {});
    setTyreSensorData(tyreData);
  }
}, [vehicleData]);


 useEffect(() => {
    console.log('Aktualizovaný stav tachographKm:', tachographKm);
  }, [tachographKm]);

  useEffect(() => {
    console.log('Aktualizovaný stav vehicleType:', vehicleType);
  }, [vehicleType]);

  useEffect(() => {
    console.log('Aktualizovaný stav companyName:', companyName);
  }, [companyName]);  

// Funkce pro zobrazení kontextového menu
const showContextMenu = (event, tyreLabel) => {
  event.preventDefault();
console.log('Kontextové menu zobrazeno pro:', tyreLabel);
  console.log('Pozice myši:', event.clientX, event.clientY);  
setContextMenu({
    visible: true,
    x: event.clientX,
    y: event.clientY,
    tyreLabel
  });
};





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

 // funkce pro načítání výsledků vyhledávání
  const fetchSearchResults = async () => {
    if (searchTerm.length > 1) {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/search-vehicles?term=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      setSearchResults(data);
      setShowSuggestions(true); // Zobrazit našeptávač
    } else {
      setSearchResults([]);
      setShowSuggestions(false); // Skrýt našeptávač
    }
  };



 // Funkce pro aktualizaci poznámky
  const updateNote = (id, newNote) => {
    setServiceTasks(tasks =>
      tasks.map(task =>
        task.id === id ? { ...task, note: newNote } : task
      )
    );
  };
const handleSuggestionSelect = async (vehicle) => {
  console.log('Vybraná SPZ:', vehicle.RZ);
  console.log('Vybraná položka z našeptávače:', vehicle);

  setselectedVehicleRZ(vehicle.RZ || ''); // Nastavení SPZ vybraného vozidla
  setSearchTerm(vehicle.RZ || '');
  setTachographKm(vehicle.tachographKm || '');
  setVehicleType(vehicle.vehicleType || '');
  setCompanyName(vehicle.companyName || '');

  setShowSuggestions(false); // Skrytí našeptávače po výběru vozidla

  // Příprava hodnoty TPMS_data z tyresensors
  const tpmsData = vehicle.tyreSensors; // Předpokládá se, že tyreSensors jsou ve formátu 'LP1|9.10|9.30|11.03,PP1|8.90|9.01|13.34'

  // Volání API pro uložení montážního listu s daty TPMS
  const url = `${process.env.REACT_APP_API_URL}/get-or-create-sheet?rz=${encodeURIComponent(vehicle.RZ)}&tpmsData=${encodeURIComponent(tpmsData)}`;
  console.log('Volání API pro montážní list s URL:', url);

  try {
    const response = await fetch(url);
    const sheetData = await response.json();
    console.log('Montážní list:', sheetData);
  } catch (error) {
    console.error('Chyba při načítání montážního listu:', error);
  }
};


 


return (
  <div className="wrapper">
    {/* Hlavička */}
    <div className="container-fluid">
      <div className="row d-flex">
        {/* Levá sekce hlavičky */}
        <div className="col-md-4 d-flex">
          <div className="p-3 border flex-fill d-flex flex-column">
            {/* Obsah levé sekce hlavičky */}
          </div>
        </div>

        {/* Střední sekce hlavičky */}
        <div className="col-md-4 d-flex">
          <div className="p-3 border flex-fill d-flex flex-column text-center">
            {/* Obsah střední sekce hlavičky */}
          </div>
        </div>

        {/* Pravá sekce hlavičky */}
        <div className="col-md-4 d-flex">
          <div className="p-3 border flex-fill d-flex flex-column">
            {/* Obsah pravé sekce hlavičky */}
          </div>
        </div>
      </div>
    </div>

    {/* Hlavní obsah */}
    <div className="content-wrapper p-3" style={{ marginLeft: '0px' }}>
      <div className="container-fluid">
        <div className="row d-flex flex-wrap">
          {/* Levá část - Úkony servisu */}
          <div className="col-12 col-lg-6 mb-4 d-flex">
            <div className="flex-fill d-flex flex-column">
              <ServiceTasksSection
                serviceTasks={serviceTasks}
                updateTaskCount={updateTaskCount}
                updateNote={updateNote}
                toggleNoteActive={toggleNoteActive}
              />
            </div>
          </div>

          {/* Pravá část - Pneumatiky */}
          <div className="col-12 col-lg-6 d-flex">
            <div className="flex-fill d-flex flex-column">
              <TyreSection
                tyres={tires}
                tyreSensorData={tyreSensorData}
                toggleTire={toggleTire}
                showContextMenu={showContextMenu}
                isTpmsModalOpen={isTpmsModalOpen}
                closeTpmsModal={closeTpmsModal}
                tpmsData={tpmsData}
                selectedTyre={selectedTyre}
                selectedVehicleRZ={selectedVehicleRZ}
                templateId={templateId}
                sheetData={sheetData}
              />
            </div>
          </div>
        </div>

        {/* Modal a kontextové menu... */}
      </div>
    </div>
  </div>
);
}

export default ServiceSheet;