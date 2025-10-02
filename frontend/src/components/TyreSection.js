// TyreSection.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Grid,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Menu,
  MenuItem,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  FormControlLabel, 
  Checkbox,
  Toolbar,
  useTheme,
} from '@mui/material';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { format } from 'date-fns';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import CloseIcon from '@mui/icons-material/Close';
import axios from 'axios';
import TyreButton from './TyreButton';
import GPSMapComponent from './GPSMapComponent'; // Import GPSMapComponent
import SensorDetailModal from './SensorDetailModal';
import TpmsModal from './TpmsModal';
import AddSensorForm from './AddSensorForm';
import DeleteSensorForm from './DeleteSensorForm';
import HNImage from '../assets/HN.png';
import HRImage from '../assets/HR.png';
import NNImage from '../assets/NN.png';
import NRImage from '../assets/NR.png';
import AddTyreModal from './AddTyreModal';
import TyreMeasurement from './TyreMeasurement';
import MeasurementDataTable from './MeasurementDataTable';
import VehicleInfo from './VehicleInfo'; 

const vehicleTypeMap = {
  T: { sections: ['P', 'Z', 'R'], description: 'Tahač' },
  V: { sections: ['T', 'R'], description: 'Vlek' },
  N: { sections: ['T', 'R'], description: 'Návěs' },
  P: { sections: ['T', 'R'], description: 'Přívěs' },
  Z: { sections: ['P', 'Z', 'T', 'R'], description: 'Základní typ' },
  O: { sections: ['P', 'Z', 'R'], description: 'Osobní vozidlo' },
  D: { sections: ['P', 'Z', 'R'], description: 'Dodávka' },
};

const getAxleImageSrc = (axleType, driveType) => {
  if (driveType === 'H' && axleType === 'N') return HNImage;
  if (driveType === 'H' && axleType === 'R') return HRImage;
  if (driveType === 'N' && axleType === 'N') return NNImage;
  if (driveType === 'N' && axleType === 'R') return NRImage;
  return null;
};

const TyreSection = ({
  templateId,
  title = '',
  RZ,
  refreshKey,
  tires,
  toggleTire,
  activeFunctions = {},
  locationId,
  templateDetails,
  sensorsData,
  refreshInterval = 2000,
  enableLeftClick,
  enableRightClick,
  vehicleId,
}) => {
  const theme = useTheme();
  const [axles, setAxles] = useState([]);
  const [vehicleType, setVehicleType] = useState('');
  const [reserveCount, setReserveCount] = useState(0);
  const [sensorsDataMap, setSensorsDataMap] = useState({});
  const [showTpmsModal, setShowTpmsModal] = useState(false);
  const [selectedTyreLabel, setSelectedTyreLabel] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [activeTab, setActiveTab] = useState('informace');
  const [isSensorDetailModalOpen, setIsSensorDetailModalOpen] = useState(false);
  const [isTyreSectionExpanded, setIsTyreSectionExpanded] = useState(false);
  const [selectedSensorData, setSelectedSensorData] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteSensorInfo, setDeleteSensorInfo] = useState({});
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addSensorInfo, setAddSensorInfo] = useState({});
  const [sensorDataDialogOpen, setSensorDataDialogOpen] = useState(false);
  const [showAddTyreModal, setShowAddTyreModal] = useState(false);
  const [selectedTyreData, setSelectedTyreData] = useState({});
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [showMeasurement, setShowMeasurement] = useState(false);
  const [isAddingMeasurement, setIsAddingMeasurement] = useState(false);
  const [lastMeasurementData, setLastMeasurementData] = useState(null);
  const [isTyreMeasurementDialogOpen, setIsTyreMeasurementDialogOpen] = useState(false);
  const [tyreMeasurements, setTyreMeasurements] = useState({});
  const [tyreDisplayNames, setTyreDisplayNames] = useState({});

  // Nové stavy pro data vozidla, zákazníka a parkování
  const [vehicleData, setVehicleData] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [parkingData, setParkingData] = useState(null);

  // Nový stav pro aktuální pozici vozidla
  const [currentPosition, setCurrentPosition] = useState(null);

  useEffect(() => {
    if (templateDetails && sensorsData) {
      const axlesData = templateDetails;
      const sensorsMap = sensorsData.reduce((map, sensor) => {
        map[sensor.position] = sensor;
        return map;
      }, {});
      setAxles(axlesData);
      setVehicleType(axlesData[0]?.Type || '');
      setReserveCount(axlesData[0]?.reserveCount || 0);
      setSensorsDataMap(sensorsMap);
    }
  }, [templateDetails, sensorsData, refreshKey]);

  // useEffect pro načtení dat vozidla, zákazníka a parkování
  useEffect(() => {
    const fetchVehicleData = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/vehicle_data/${vehicleId}`);
        setVehicleData(response.data.vehicle);
        setCustomerData(response.data.customer);
        setParkingData(response.data.parking);
      } catch (error) {
        console.error('Chyba při načítání dat vozidla:', error);
      }
    };

    if (vehicleId) {
      fetchVehicleData();
    }
  }, [vehicleId]);  

  useEffect(() => {
    if (navigator.bluetooth) {
      console.log('Web Bluetooth API je podporováno v tomto prohlížeči');
    } else {
      console.log('Web Bluetooth API není podporováno v tomto prohlížeči');
    }

    if (templateDetails && sensorsData) {
      const axlesData = templateDetails;
      const sensorsMap = sensorsData.reduce((map, sensor) => {
        map[sensor.position] = sensor;
        return map;
      }, {});
      setAxles(axlesData);
      setVehicleType(axlesData[0]?.Type || '');
      setReserveCount(axlesData[0]?.reserveCount || 0);
      setSensorsDataMap(sensorsMap);
    }
  }, [templateDetails, sensorsData, refreshKey]);

  // State variables for distance calculation
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [distance, setDistance] = useState(null);
  const [loadingDistance, setLoadingDistance] = useState(false);
  const [errorDistance, setErrorDistance] = useState(null);
  const [routeGeometries, setRouteGeometries] = useState([]); // Přidáno pro uložení geometrií trasy

  const handleInformationClick = () => {
    setActiveTab('informace');
  };

  // Název pneu dle PartNo

  const fetchDisplayName = async (tyreID) => {
    if (!tyreID || tyreDisplayNames[tyreID]) return; // Pokud je tyreID null nebo již máme displayName, nepokračuj

    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/getProductByPartNo`, {
        params: { PartNo: tyreID },
      });
      const { displayName } = response.data;
      setTyreDisplayNames((prev) => ({ ...prev, [tyreID]: displayName }));
    } catch (error) {
      console.error(`Error fetching displayName for PartNo ${tyreID}:`, error);
      // Můžete zde nastavit nějaký fallback nebo jednoduše nechat displayName undefined
    }
  };

  // Funkce pro výpočet denních nájezdů s ošetřením chyb
  const handleCalculateDailyDistances = async () => {
    try {
      setLoadingDistance(true);
      // Získání posledního data, pro které je vypočítán denní nájezd
      const lastDateResponse = await axios.get(`${process.env.REACT_APP_API_URL}/get-last-daily-distance-date/${RZ}`);
      let lastDate = lastDateResponse.data.lastDate;

      // Pokud není žádné poslední datum, získáme nejstarší datum z GPS dat
      if (!lastDate) {
        const earliestDateResponse = await axios.get(`${process.env.REACT_APP_API_URL}/get-earliest-gps-date/${RZ}`);
        lastDate = earliestDateResponse.data.earliestDate;
        if (!lastDate) {
          alert('Pro toto vozidlo nejsou dostupná GPS data.');
          setLoadingDistance(false);
          return;
        }
      }

      // Převod posledního data na Date objekt a přidání jednoho dne
      let currentDate = new Date(lastDate);
      currentDate.setDate(currentDate.getDate() + 1);

      // Získání včerejšího data
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      while (currentDate <= yesterday) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const startTime = new Date(currentDate);
        startTime.setHours(0, 0, 0, 0);
        const endTime = new Date(currentDate);
        endTime.setDate(endTime.getDate() + 1);
        endTime.setHours(0, 0, 0, 0);

        let totalDistance = 0;

        try {
          // Získání GPS dat pro aktuální den
          const gpsDataResponse = await axios.get(`${process.env.REACT_APP_API_URL}/gps-data-by-timestamp`, {
            params: {
              startTime: startTime.getTime(),
              endTime: endTime.getTime(),
              rz: RZ,
            },
          });

          const gpsData = gpsDataResponse.data;

          if (gpsData.length < 2) {
            // Nedostatečná data pro výpočet vzdálenosti
            console.warn(`Nedostatečná GPS data pro datum ${dateStr}, vzdálenost nastavena na 0 km.`);
          } else {
            // Výpočet vzdálenosti pomocí Mapboxu
            const coordinates = gpsData.map(data => ({ longitude: data.longitude, latitude: data.latitude }));
            const timestamps = gpsData.map(data => Math.floor(data.timestamp / 1000)); // Mapbox očekává timestampy v sekundách

            const maxCoordinatesPerChunk = 100;
            const coordinateChunks = chunkArray(coordinates, maxCoordinatesPerChunk);
            const timestampChunks = chunkArray(timestamps, maxCoordinatesPerChunk);

            for (let i = 0; i < coordinateChunks.length; i++) {
              const chunk = coordinateChunks[i];
              const times = timestampChunks[i];
              const coords = chunk.map(coord => `${coord.longitude},${coord.latitude}`).join(';');

              try {
                const mapboxResponse = await axios.get(`https://api.mapbox.com/matching/v5/mapbox/driving/${coords}`, {
                  params: {
                    access_token: process.env.REACT_APP_MAPBOX_ACCESS_TOKEN,
                    timestamps: times.join(';'),
                    geometries: 'geojson',
                    overview: 'full',
                  },
                });

                const matchings = mapboxResponse.data.matchings;

                const chunkDistance = matchings.reduce((sum, match) => sum + match.distance, 0);

                totalDistance += chunkDistance;
              } catch (mapboxError) {
                console.error(`Chyba při volání Mapbox API pro datum ${dateStr}:`, mapboxError);
                // Pokračujeme s další částí
                continue;
              }
            }

            console.log(`Vypočtená vzdálenost pro datum ${dateStr}: ${(totalDistance / 1000).toFixed(4)} km`);
          }
        } catch (dayError) {
          console.error(`Chyba při zpracování data ${dateStr}:`, dayError);
          // Nastavíme totalDistance na 0
          totalDistance = 0;
        }

        // Uložení denního nájezdu do databáze (i pokud je vzdálenost 0 km)
        try {
          await axios.post(`${process.env.REACT_APP_API_URL}/save-daily-distance`, {
            rz: RZ,
            date: dateStr,
            distance: (totalDistance / 1000).toFixed(4), // Převod na kilometry s přesností na 4 desetinná místa
          });

          console.log(`Uložena vzdálenost pro datum ${dateStr}: ${(totalDistance / 1000).toFixed(4)} km`);
        } catch (saveError) {
          console.error(`Chyba při ukládání vzdálenosti pro datum ${dateStr}:`, saveError);
          // Pokud se nepodaří uložit, můžete se rozhodnout, jak postupovat
        }

        // Posun na další den
        currentDate.setDate(currentDate.getDate() + 1);
      }

      alert('Denní nájezdy byly vypočítány a uloženy.');
    } catch (error) {
      console.error('Chyba při výpočtu denních nájezdů:', error);
      alert('Chyba při výpočtu denních nájezdů.');
    } finally {
      setLoadingDistance(false);
    }
  };


  const fetchLastMeasurement = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/tyre-measurements/last/${vehicleId}`);
      setLastMeasurementData(response.data);
    } catch (error) {
      console.error('Error fetching last measurement:', error);
    }
  };
  
  // useEffect that calls fetchLastMeasurement
  useEffect(() => {
    if (activeTab === 'measurement' && vehicleId) {
      fetchLastMeasurement();
    }
  }, [activeTab, vehicleId]);

  useEffect(() => {
    let interval;

    const fetchSensorsData = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/sensorsRZ/${RZ}`);
        const sensorsRTData = response.data;
        setSensorsDataMap(sensorsRTData.reduce((map, sensor) => {
          map[sensor.position] = sensor;
          return map;
        }, {}));
      } catch (error) {
        console.error('Error fetching sensorsRT data:', error);
      }
    };

    if (!showAddTyreModal) {
      fetchSensorsData(); // Načti data okamžitě při spuštění

      interval = setInterval(fetchSensorsData, 3000); // Načítej data každé 3 sekundy
    }

    return () => {
      if (interval) {
        clearInterval(interval); // Vyčisti interval při odpojení nebo při otevření modalu
      }
    };
  }, [RZ, showAddTyreModal]);


  const generateReserveLabels = (reserveCount) => {
    const labels = [];
    for (let i = 1; i <= reserveCount; i++) {
      labels.push(`R${i}`);
    }
    return labels;
  };

  const requestBluetoothDevice = async () => {
    try {
      const module = await import('./externalScript');
      module.runExternalScript(setConnectedDevice, setDeviceInfo);
    } catch (error) {
      console.error('Error importing external script:', error);
    }
  };

  const generateTyreLabels = (axle, axleIndex) => {
    let labels = [];
    let tyresBeforeThisAxle = 0;

    for (let i = 0; i < axleIndex; i++) {
      tyresBeforeThisAxle += (axles[i].mountType === '2' ? 4 : 2);
    }

    const baseIndex = 1 + tyresBeforeThisAxle;
    const isSingleMount = axle.mountType === '1';

    if (axle.section === 'P') {
      const indexForP = axleIndex + 1;
      labels.push(`LP${indexForP}`, `PP${indexForP}`);
    } else if (axle.section === 'Z') {
      let prefix = 'Z';
      if (isSingleMount) {
        labels.push(`L${prefix}${baseIndex}`, `P${prefix}${baseIndex}`);
      } else {
        labels.push(`L${prefix}${baseIndex}`, `L${prefix}${baseIndex + 1}`);
        labels.push(`P${prefix}${baseIndex + 1}`, `P${prefix}${baseIndex}`);
      }
    } else if (axle.section === 'T') {
      const indexForT = axleIndex + 1;
      labels.push(`L${indexForT}`, `P${indexForT}`);
    }

    const labelsWithSensors = labels.map(label => {
      const sensorData = sensorsDataMap[label];
      return { label, sensorData };
    });

    return labelsWithSensors;
  };

  const sectionsToDisplay = vehicleTypeMap[vehicleType]?.sections || [];

  const handleContextMenu = (event, tyreLabel) => {
    if (!enableRightClick) return;

    event.preventDefault();
    setSelectedTyreLabel(tyreLabel);
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
    });
  };

  const handleClose = () => {
    setContextMenu(null);
  };

  const handleTyreMeasurementSaved = (tyreLabel, data) => {
    setTyreMeasurements((prevMeasurements) => ({
      ...prevMeasurements,
      [tyreLabel]: data,
    }));
  };

  const handleMenuClick = (option) => {
    if (option === 'pair') {
      setShowTpmsModal(true);
    } else if (option === 'delete-sensor') {
      setDeleteDialogOpen(true);
      const sensorData = sensorsDataMap[selectedTyreLabel];
      setDeleteSensorInfo({
        position: selectedTyreLabel,
        macAddress: sensorData?.macAddress || '',
        RZ
      });
    } else if (option === 'add-sensor') {
      setAddDialogOpen(true);
      setAddSensorInfo({
        position: selectedTyreLabel,
        RZ
      });
    } else if (option === 'add-tyre') {
      setShowAddTyreModal(true);
      const sensorData = sensorsDataMap[selectedTyreLabel];
      setSelectedTyreData(sensorData);
    } else if (option === 'measure') {
      setIsTyreMeasurementDialogOpen(true);
      handleClose();
    }
    else {
      console.log(`Selected option: ${option}`);
    }
    handleClose();
  };

  const handleLabelClick = (sensorData) => {
    setSelectedSensorData(sensorData);
    setIsSensorDetailModalOpen(true);
  };

  const handleExpandClick = () => {
    setIsTyreSectionExpanded(true);
    fetchTyreDisplayNames(); // Zavoláme funkci na načtení dat při rozbalení sekce
  };
  
  // Funkce pro načtení PartNo při rozbalení sekce
  const fetchTyreDisplayNames = () => {
    const uniqueTyreIDs = new Set();

    Object.values(sensorsDataMap).forEach((sensor) => {
      if (sensor.tyreID) {
        uniqueTyreIDs.add(sensor.tyreID);
      }
    });

    console.log('Unique tyreIDs:', uniqueTyreIDs); // Pro debugování

    uniqueTyreIDs.forEach((tyreID) => {
      fetchDisplayName(tyreID);
    });
  };

  const renderSensorDataTable = (sensorsData) => (
    <Box mt={2} component={Paper} sx={{ paddingLeft: 0, paddingRight: 0 }}>
      <Typography variant="h6" gutterBottom>Sensors Data</Typography>
      <TableContainer component={Paper} sx={{ paddingLeft: 0, paddingRight: 0 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Pozice</TableCell>
              <TableCell>Zařízení</TableCell>
              <TableCell>Timestamp</TableCell>
              <TableCell>Kód čipu</TableCell>
              <TableCell>Tlak</TableCell>
              <TableCell>Tlak 20°C</TableCell>
              <TableCell>Teplota</TableCell>
              <TableCell>Baterie %</TableCell>
              <TableCell>Únik</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sensorsData.map(sensor => (
              <TableRow key={sensor.id}>
                <TableCell>{sensor.position}</TableCell>
                <TableCell>{sensor.locationId}</TableCell>
                <TableCell>{sensor.formatted_timestamp}</TableCell>
                <TableCell>{sensor.macAddress}</TableCell>
                <TableCell>{sensor.pressure.toFixed(2)} bar</TableCell>
                <TableCell>{sensor.adjusted_pressure_20C.toFixed(2)} bar</TableCell>
                <TableCell>{sensor.temperature.toFixed(2)} °C</TableCell>
                <TableCell>{sensor.batteryPercentage}%</TableCell>
                <TableCell>{sensor.leaking === 0 ? 'Ne' : 'Ano'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderMenuItems = () => {
    const { tpms = false, measurement = false } = activeFunctions; // Nastavení výchozích hodnot
    if (activeTab === 'measurement') {
      return (
        <>
          <MenuItem onClick={() => handleMenuClick('measure')}>Měřit</MenuItem>
        </>
      );
    }
    if (!tpms && !measurement) {
      return (
        <MenuItem disabled>
          Žádná funkce není aktivní
        </MenuItem>
      );
    }

    if (tpms && !measurement) {
      return (
        <>
          <MenuItem onClick={() => handleMenuClick('pair')}>Párování TPMS</MenuItem>
          <MenuItem onClick={() => handleMenuClick('add-sensor')}>Přidat Senzor</MenuItem>
          <MenuItem onClick={() => handleMenuClick('delete-sensor')}>Vymazat senzor</MenuItem>
        </>
      );
    }

    if (!tpms && measurement) {
      return (
        <>
          <MenuItem onClick={() => handleMenuClick('add-tyre')}>Přidat pneu</MenuItem>
          <MenuItem onClick={() => handleMenuClick('remove-tyre')}>Odebrat pneu</MenuItem>
          <MenuItem onClick={() => handleMenuClick('change-tyre-position')}>Změna pozice pneu</MenuItem>
        </>
      );
    }

    if (tpms && measurement) {
      return (
        <>
          <MenuItem onClick={() => handleMenuClick('pair')}>Párování TPMS</MenuItem>
          <MenuItem onClick={() => handleMenuClick('add-sensor')}>Přidat Senzor</MenuItem>
          <MenuItem onClick={() => handleMenuClick('delete-sensor')}>Vymazat senzor</MenuItem>
          <MenuItem divider />
          <MenuItem onClick={() => handleMenuClick('add-tyre')}>Přidat pneu</MenuItem>
          <MenuItem onClick={() => handleMenuClick('remove-tyre')}>Odebrat pneu</MenuItem>
          <MenuItem onClick={() => handleMenuClick('change-tyre-position')}>Změna pozice pneu</MenuItem>
        </>
      );
    }
  };

  const getTyreSizeString = (labels) => {
    const tyreSizes = labels.map(({ sensorData }) => {
      if (!sensorData) return '';
      const { tyreSize, tyreProfil, tyreRim } = sensorData;
      if (!tyreSize || !tyreRim) return '';
      return tyreProfil ? `${tyreSize}/${tyreProfil} ${tyreRim}` : `${tyreSize} ${tyreRim}`;
    }).filter(Boolean);

    if (tyreSizes.length === 0) return "Nebyl zadán rozměr pneumatik na nápravě";
    if (new Set(tyreSizes).size === 1) return tyreSizes[0];
    return "Chybně zapsané údaje o rozměru pneumatiky!";
  };

  const getIdealPressureString = (labels) => {
    const idealPressures = labels.map(({ sensorData }) => sensorData?.idealPressure).filter(Boolean);
    if (idealPressures.length === 0) return "Nebyl zadán předepsaný tlak pneu na nápravě";
    if (new Set(idealPressures).size === 1) return `${idealPressures[0]} bar`;
    return "Chybně zapsané údaje o předepsaném tlaku!";
  };

  const renderWarnings = (labels) => {
    const warnings = labels.map(({ label, sensorData }) => {
      if (!sensorData) return null;
      const { adjusted_pressure_20C, idealPressure, current_temperature } = sensorData;

      const pressureDiff = ((adjusted_pressure_20C - idealPressure) / idealPressure) * 100;
      let color = null;
      let text = '';

      if (pressureDiff < -10 || pressureDiff > 10) {
        color = 'red';
        text = `${label}: Urgence! Uprav na předepsaný tlak ${idealPressure} bar při 20°C dohuštěním na ${adjusted_pressure_20C.toFixed(2)} bar při ${current_temperature.toFixed(2)}°C`;
      } else if ((pressureDiff >= -10 && pressureDiff < -5) || (pressureDiff <= 10 && pressureDiff > 5)) {
        color = 'orange';
        text = `${label}: Varování! Tlak by měl být upraven na ${idealPressure} bar při 20°C`;
      }

      return color && text ? { color, text } : null;
    }).filter(Boolean);

    return warnings.length > 0 ? (
      <Box mt={2}>
        {warnings.map((warning, index) => (
          <Typography key={index} sx={{ color: warning.color }}>{warning.text}</Typography>
        ))}
      </Box>
    ) : null;
  };

  const renderAxleBox = (axle, axleIndex, labels) => (
    <Box className="naprava axle-box" key={axleIndex} sx={{ mb: 5, border: '1px solid #ddd', borderRadius: 2, padding: 2, position: 'relative', maxWidth: '100%' }}>
      <Typography variant="caption" sx={{
        position: 'absolute',
        top: '-10px',
        left: '10px',
        bgcolor: 'background.paper',
        px: 1,
      }}>
        Náprava č. {axle.axlePosition}, {getTyreSizeString(labels)}, {getIdealPressureString(labels)}
      </Typography>
      <Grid container spacing={2} className="grid-container-1">
        <Grid item xs={isTyreSectionExpanded ? 4 : 12} className="grid-item-1 info-section">
          {isTyreSectionExpanded ? (
            <>
              {/* Dynamické zobrazení rozměrů a tlaku */}
              {labels.map(({ label, sensorData }) => (
                sensorData?.tyreID ? (
                  <Box key={label} mb={1}>
                    <Typography variant="subtitle1">
                      {sensorData.position}: {tyreDisplayNames[sensorData.tyreID] || 'Načítání...'}
                    </Typography>
                  </Box>
                ) : null
              ))}
              {/* Předepsaný tlak pneumatik */}
              <Typography variant="subtitle1">Předepsaný tlak pneu na nápravě:</Typography>
              <Typography variant="subtitle2">{getIdealPressureString(labels)}</Typography>
              {renderWarnings(labels)}
            </>
          ) : (
            <Typography className="rozmer-a-tlak-mobil" variant="subtitle1">
              Rozměr pneu {getTyreSizeString(labels)} a doporučený tlak {getIdealPressureString(labels)}
            </Typography>
          )}
        </Grid>
        <Grid item xs={isTyreSectionExpanded ? 8 : 12} className="grid-item-2 button-section">
          <Grid container spacing={2} alignItems="center" sx={{ mt: 2 }} className="grid-container-2">
            <Grid item xs={5} container justifyContent="flex-end" className="grid-item-3">
              {labels.filter(({ label }) => label.startsWith('L')).map(({ label, sensorData }, tyreIndex) => (
                <TyreButton
                  key={`left-${tyreIndex}`}
                  label={label}
                  sensorData={sensorData}
                  isActive={tires[label]}
                  toggleTire={enableLeftClick ? toggleTire : undefined}
                  onContextMenu={enableRightClick ? (e) => handleContextMenu(e, label) : undefined}
                  onLabelClick={() => handleLabelClick(sensorData)}
                />
              ))}
            </Grid>
            <Grid item xs={2} container justifyContent="center" className="grid-item-4">
              <img className="axles" src={getAxleImageSrc(axle.axleType, axle.driveType)} alt={`${axle.axleType}${axle.driveType} Axle`} style={{ maxWidth: '100%', height: 'auto' }} />
            </Grid>
            <Grid item xs={5} container justifyContent="flex-start" className="grid-item-5">
              {labels.filter(({ label }) => label.startsWith('P')).map(({ label, sensorData }, tyreIndex) => (
                <TyreButton
                  key={`right-${tyreIndex}`}
                  label={label}
                  sensorData={sensorData}
                  isActive={tires[label]}
                  toggleTire={enableLeftClick ? toggleTire : undefined}
                  onContextMenu={enableRightClick ? (e) => handleContextMenu(e, label) : undefined}
                  onLabelClick={() => handleLabelClick(sensorData)}
                />
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );


  const chunkArray = (array, chunkSize) => {
    const result = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      result.push(array.slice(i, i + chunkSize));
    }
    return result;
  };

  const fetchDistanceData = async () => {
    setLoadingDistance(true);
    setErrorDistance(null);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/gps-data-by-timestamp`, {
        params: {
          startTime: startTime.getTime(),
          endTime: endTime.getTime(),
          rz: RZ,
        },
      });
      const gpsData = response.data;

      const coordinates = gpsData.map(data => ({ longitude: data.longitude, latitude: data.latitude }));
      const timestamps = gpsData.map(data => data.timestamp);

      const maxCoordinatesPerChunk = 100; // Ensure that no chunk exceeds 100 coordinates
      const coordinateChunks = chunkArray(coordinates, maxCoordinatesPerChunk);
      const timestampChunks = chunkArray(timestamps, maxCoordinatesPerChunk);

      const routeGeometriesTemp = [];

      const requests = coordinateChunks.map((chunk, index) => {
        const coords = chunk.map(coord => `${coord.longitude},${coord.latitude}`).join(';');
        const times = timestampChunks[index].join(';');

        return axios.get(`https://api.mapbox.com/matching/v5/mapbox/driving/${coords}`, {
          params: {
            access_token: process.env.REACT_APP_MAPBOX_ACCESS_TOKEN,
            timestamps: times,
            geometries: 'geojson',
            overview: 'full',
          },
        });
      });

      const responses = await Promise.all(requests);
      const totalDistance = responses.reduce((acc, response) => {
        const routeDistance = response.data.matchings.reduce((sum, match) => sum + match.distance, 0);
        response.data.matchings.forEach(match => {
          routeGeometriesTemp.push(match.geometry);
        });
        return acc + routeDistance;
      }, 0);

      setDistance(totalDistance);
      setRouteGeometries(routeGeometriesTemp); // Uložíme geometrii trasy
    } catch (error) {
      console.error('Error fetching distance data:', error.message);
      setErrorDistance(error.message);
    } finally {
      setLoadingDistance(false);
    }
  };

  // Nový useEffect pro načtení aktuální pozice vozidla
  useEffect(() => {
    const fetchCurrentPosition = async () => {
      if (!RZ) return;
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/gps-data-by-rz/${RZ}`);
        const data = response.data;
        if (data && data.length > 0) {
          const { latitude, longitude, timestamp } = data[0];
          setCurrentPosition({ latitude, longitude, timestamp });
        } else {
          setCurrentPosition(null);
        }
      } catch (error) {
        console.error('Error fetching current vehicle position:', error);
        setCurrentPosition(null);
      }
    };

    fetchCurrentPosition();

    // Optionálně, můžete nastavit interval pro pravidelné aktualizace aktuální pozice
    const intervalId = setInterval(fetchCurrentPosition, 5000); // Aktualizace každých 5 sekund

    return () => clearInterval(intervalId); // Vyčistí interval při odpojení komponenty
  }, [RZ, refreshKey]);

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #ddd',
        boxShadow: 'none',
        borderRadius: 2,
        maxWidth: '100%',
        margin: '0 auto',
        paddingLeft: 0,
        paddingRight: 0,
      }}
    >
      <CardHeader
        title={
          <Box display="flex" flexDirection="column" alignItems="center">
            <Typography variant="h6" component="div" align="center">
              {RZ || 'Pneumatiky'}
            </Typography>
            <Box
              display="flex"
              flexDirection={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'center', md: 'flex-start' }}
              justifyContent="center"
              mt={1} // Marže nahoře, aby tlačítka nebyla příliš blízko RZ
            >
              <Button
                onClick={handleInformationClick}
                variant={activeTab === 'informace' ? 'contained' : 'outlined'}
                sx={{ marginRight: 1 }}
              >
                Informace
              </Button>
              <Button
                onClick={() => setActiveTab('tpms')}
                variant={activeTab === 'tpms' ? 'contained' : 'outlined'}
                sx={{ marginBottom: { xs: 1, md: 0 }, marginRight: { md: 1 } }}
              >
                TPMS
              </Button>
              {activeFunctions.gps && (
                <Button
                  onClick={() => setActiveTab('gps')}
                  variant={activeTab === 'gps' ? 'contained' : 'outlined'}
                  sx={{ marginBottom: { xs: 1, md: 0 }, marginRight: { md: 1 } }}
                >
                  GPS
                </Button>
              )}
              <Button
                onClick={() => {
                  setActiveTab('measurement');
                  setShowMeasurement(true);
                }}
                variant={activeTab === 'measurement' ? 'contained' : 'outlined'}
                sx={{ marginBottom: { xs: 1, md: 0 }, marginRight: { md: 1 } }}
              >
                Měření
              </Button>
              <Button
                onClick={handleExpandClick}
                variant="contained"
                sx={{ marginBottom: { xs: 1, md: 0 }, marginLeft: { md: 1 } }}
              >
                Zvětšit
              </Button>
            </Box>
          </Box>
        }
        sx={{
          backgroundColor: theme.palette.background.default,
          borderBottom: '1px solid #ddd',
          padding: '10px 16px',
        }}
      />
      <CardContent
        sx={{ flexGrow: 1, overflowY: 'auto', paddingLeft: 0, paddingRight: 0, maxWidth: '100%' }}
      >
        {/* Zobrazení komponenty VehicleInfo při aktivní záložce 'informace' */}
        {activeTab === 'informace' && (
          <VehicleInfo
            vehicleData={vehicleData}
            customerData={customerData}
            parkingData={parkingData}
          />
        )}
  
        {/* Zobrazení komponenty TyreMeasurement při aktivní záložce 'measurement' */}
        {activeTab === 'measurement' && (
          <TyreMeasurement
            RZ={RZ}
          />
        )}
  
        {/* Zobrazení GPS sekce pokud je aktivní záložka 'gps' */}
        {activeTab === 'gps' && RZ && activeFunctions.gps && (
          <Box mt={2}>
            <GPSMapComponent
              RZ={RZ}
              startTime={startTime}
              endTime={endTime}
              routeGeometries={routeGeometries}
              currentPosition={currentPosition} // Předáváme aktuální pozici do komponenty
            />
            <Box mt={4} display="flex" flexDirection="column" alignItems="center" gap={2}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DateTimePicker
                  label="Počáteční čas"
                  value={startTime}
                  onChange={(newValue) => setStartTime(newValue)}
                  renderInput={(params) => <TextField {...params} />}
                />
                <DateTimePicker
                  label="Konečný čas"
                  value={endTime}
                  onChange={(newValue) => setEndTime(newValue)}
                  renderInput={(params) => <TextField {...params} />}
                />
              </LocalizationProvider>
              <Button variant="contained" onClick={fetchDistanceData} disabled={loadingDistance}>
                {loadingDistance ? 'Výpočet...' : 'Vypočítej vzdálenost'}
              </Button>
              {distance !== null && (
                <Box mt={2}>Ujetá vzdálenost: {(distance / 1000).toFixed(2)} km</Box>
              )}
              {errorDistance && (
                <Box mt={2} color="error.main">
                  Chyba: {errorDistance}
                </Box>
              )}
              <Button variant="contained" onClick={handleCalculateDailyDistances}>
                Vypočítat denní nájezdy
              </Button>
            </Box>
          </Box>
        )}

        {/* Zobrazení ostatních sekcí (např. TyreButton) pokud není aktivní záložka 'informace', 'measurement' nebo 'gps' */}
        {activeTab !== 'informace' && activeTab !== 'measurement' && activeTab !== 'gps' && (
          <Box mt={2}>
            {sectionsToDisplay.map((section, sectionIndex) =>
              axles
                .filter((axle) => axle.section === section)
                .map((axle, axleIndex) => {
                  const labels = generateTyreLabels(axle, axleIndex);
                  return renderAxleBox(axle, axleIndex, labels);
                })
            )}
            <Box mt={2} display="flex" justifyContent="space-between">
              {generateReserveLabels(reserveCount).map((label, index) => (
                <TyreButton
                  key={`reserve-${index}`}
                  label={label}
                  toggleTire={enableLeftClick ? toggleTire : undefined}
                  isActive={tires[label]}
                  onContextMenu={
                    enableRightClick ? (e) => handleContextMenu(e, label) : undefined
                  }
                />
              ))}
            </Box>
            {activeFunctions.tpms && activeTab === 'tpms' && (
              <Box mt={2} display="flex" justifyContent="center">
                <Button variant="contained" onClick={() => setSensorDataDialogOpen(true)}>
                  Data ze senzorů
                </Button>
              </Box>
            )}
          </Box>
        )}
      </CardContent>
  
      {/* Zde zůstává ostatní kód (dialogy, modaly atd.) nezměněn */}
      <SensorDetailModal
        open={isSensorDetailModalOpen}
        onClose={() => setIsSensorDetailModalOpen(false)}
        sensorData={selectedSensorData}
      />
      <TpmsModal
        show={showTpmsModal}
        onClose={() => setShowTpmsModal(false)}
        tyreLabel={selectedTyreLabel}
        selectedVehicleRZ={RZ}
        activeFunction={activeTab}
        locationId={locationId}
      />
      <AddSensorForm
        show={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        position={addSensorInfo.position}
        RZ={addSensorInfo.RZ}
      />
      <DeleteSensorForm
        show={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        position={deleteSensorInfo.position}
        macAddress={deleteSensorInfo.macAddress}
        RZ={deleteSensorInfo.RZ}
      />
      <Menu
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
        open={contextMenu !== null}
        onClose={handleClose}
      >
        {renderMenuItems()}
      </Menu>
      <Dialog
        open={sensorDataDialogOpen}
        onClose={() => setSensorDataDialogOpen(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>Data ze senzorů</DialogTitle>
        <DialogContent>{renderSensorDataTable(Object.values(sensorsDataMap))}</DialogContent>
        <DialogActions>
          <Button onClick={() => setSensorDataDialogOpen(false)} color="primary">
            Zavřít
          </Button>
        </DialogActions>
      </Dialog>
  
      <Dialog
        open={isTyreSectionExpanded}
        onClose={() => setIsTyreSectionExpanded(false)}
        maxWidth="xl"
        fullScreen
      >
        <DialogTitle>
          {title || 'Pneumatiky'}
          <IconButton
            aria-label="close"
            onClick={() => setIsTyreSectionExpanded(false)}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ paddingLeft: 0, paddingRight: 0 }}>
          <CardContent
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              paddingLeft: 0,
              paddingRight: 0,
              maxWidth: '100%',
            }}
          >
            {activeTab === 'informace' && (
              <VehicleInfo
                vehicleData={vehicleData}
                customerData={customerData}
                parkingData={parkingData}
              />
            )}
  
            {activeTab === 'measurement' && (
              <TyreMeasurement
                RZ={RZ}
              />
            )}
  
            {/* Zobrazení GPS sekce pokud je aktivní záložka 'gps' */}
            {activeTab === 'gps' && RZ && activeFunctions.gps && (
              <Box mt={2}>
                <GPSMapComponent
                  RZ={RZ}
                  startTime={startTime}
                  endTime={endTime}
                  routeGeometries={routeGeometries}
                  currentPosition={currentPosition} // Předáváme aktuální pozici do komponenty
                />
                <Box mt={4} display="flex" flexDirection="column" alignItems="center" gap={2}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DateTimePicker
                      label="Počáteční čas"
                      value={startTime}
                      onChange={(newValue) => setStartTime(newValue)}
                      renderInput={(params) => <TextField {...params} />}
                    />
                    <DateTimePicker
                      label="Konečný čas"
                      value={endTime}
                      onChange={(newValue) => setEndTime(newValue)}
                      renderInput={(params) => <TextField {...params} />}
                    />
                  </LocalizationProvider>
                  <Button variant="contained" onClick={fetchDistanceData} disabled={loadingDistance}>
                    {loadingDistance ? 'Výpočet...' : 'Vypočítej vzdálenost'}
                  </Button>
                  {distance !== null && (
                    <Box mt={2}>Ujetá vzdálenost: {(distance / 1000).toFixed(2)} km</Box>
                  )}
                  {errorDistance && (
                    <Box mt={2} color="error.main">
                      Chyba: {errorDistance}
                    </Box>
                  )}
                  <Button variant="contained" onClick={handleCalculateDailyDistances}>
                    Vypočítat denní nájezdy
                  </Button>
                </Box>
              </Box>
            )}
  
            {activeTab !== 'informace' && activeTab !== 'measurement' && activeTab !== 'gps' && (
              <Box mt={2}>
                {sectionsToDisplay.map((section, sectionIndex) =>
                  axles
                    .filter((axle) => axle.section === section)
                    .map((axle, axleIndex) => {
                      const labels = generateTyreLabels(axle, axleIndex);
                      return renderAxleBox(axle, axleIndex, labels);
                    })
                )}
                <Box mt={2} display="flex" justifyContent="space-between">
                  {generateReserveLabels(reserveCount).map((label, index) => (
                    <TyreButton
                      key={`reserve-${index}`}
                      label={label}
                      toggleTire={enableLeftClick ? toggleTire : undefined}
                      isActive={tires[label]}
                      onContextMenu={
                        enableRightClick ? (e) => handleContextMenu(e, label) : undefined
                      }
                    />
                  ))}
                </Box>
                {activeFunctions.tpms && activeTab === 'tpms' && (
                  <Box mt={2} display="flex" justifyContent="center">
                    <Button variant="contained" onClick={() => setSensorDataDialogOpen(true)}>
                      Data ze senzorů
                    </Button>
                  </Box>
                )}
              </Box>
            )}
  
            {/* Zobrazení GPS sekce v rozšířeném dialogu */}
            {activeTab === 'gps' && RZ && activeFunctions.gps && (
              <Box mt={2}>
                <GPSMapComponent
                  RZ={RZ}
                  startTime={startTime}
                  endTime={endTime}
                  routeGeometries={routeGeometries}
                  currentPosition={currentPosition} // Předáváme aktuální pozici do komponenty
                />
                <Box mt={4} display="flex" flexDirection="column" alignItems="center" gap={2}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DateTimePicker
                      label="Počáteční čas"
                      value={startTime}
                      onChange={(newValue) => setStartTime(newValue)}
                      renderInput={(params) => <TextField {...params} />}
                    />
                    <DateTimePicker
                      label="Konečný čas"
                      value={endTime}
                      onChange={(newValue) => setEndTime(newValue)}
                      renderInput={(params) => <TextField {...params} />}
                    />
                  </LocalizationProvider>
                  <Button variant="contained" onClick={fetchDistanceData} disabled={loadingDistance}>
                    {loadingDistance ? 'Výpočet...' : 'Vypočítej vzdálenost'}
                  </Button>
                  {distance !== null && (
                    <Box mt={2}>Ujetá vzdálenost: {(distance / 1000).toFixed(2)} km</Box>
                  )}
                  {errorDistance && (
                    <Box mt={2} color="error.main">
                      Chyba: {errorDistance}
                    </Box>
                  )}
                  <Button variant="contained" onClick={handleCalculateDailyDistances}>
                    Vypočítat denní nájezdy
                  </Button>
                </Box>
              </Box>
            )}
          </CardContent>
          {connectedDevice && (
            <Typography variant="h6">Připojeno k: {connectedDevice.name}</Typography>
          )}
        </DialogContent>
      </Dialog>
  
      <AddTyreModal
        open={showAddTyreModal}
        onClose={() => setShowAddTyreModal(false)}
        locationId={locationId}
        tyreLabel={selectedTyreLabel}
        tyreData={selectedTyreData}
      />
    </Card>
  );
   
}

export default TyreSection;
