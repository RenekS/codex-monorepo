import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Box,
  Typography
} from '@mui/material';
import AddVehicleModal from './AddVehicleModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faSignal } from '@fortawesome/free-solid-svg-icons';

const getWarningLevel = (sensors) => {
  let highestLevel = 'green';

  sensors.forEach(sensor => {
    const pressures = Object.values(sensor.pressures || {});
    const currentPressure = sensor.pressure;
    const significantDeviation = pressures.some(pressure => Math.abs(pressure - currentPressure) / currentPressure > 0.02);
    const idealPressure = sensor.idealPressure;
    const adjustedPressure20C = sensor.adjusted_pressure_20C;

    const pressureDifference = ((adjustedPressure20C - idealPressure) / idealPressure) * 100;

    if (pressureDifference < -10 || pressureDifference > 10) {
      highestLevel = 'red';
    } else if ((pressureDifference >= -10 && pressureDifference < -5) || (pressureDifference <= 10 && pressureDifference > 5)) {
      if (highestLevel !== 'red') {
        highestLevel = 'orange';
      }
    } else {
      if (highestLevel !== 'red' && highestLevel !== 'orange') {
        highestLevel = 'green';
      }
    }

    if (significantDeviation) {
      highestLevel = 'red';
    }
  });

  return highestLevel;
};

const hasRecentData = (sensors) => {
  const currentTime = new Date().getTime();
  return sensors.some(sensor => ((currentTime - sensor.timestamp) / 60000) < 10);
};

function VehicleList({
  onSelectVehicle,
  refreshKey,
  searchQueryRZ,
  searchQueryCompany,
  serviceVehicle,
  onlyActiveVehicles,
  onUpdateSensorsData
}) {
  const [vehicles, setVehicles] = useState([]);
  const [sensorsData, setSensorsData] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);

  const fetchData = async () => {
    try {
      const params = {
        RZ: searchQueryRZ,
        companyId: searchQueryCompany,
        serviceVehicle,
        onlyActiveVehicles
      };
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/search-vehicle-from-list`, { params });
      setVehicles(response.data);

      const RZs = response.data.map(vehicle => vehicle.RZ).join(',');

      const sensorsResponse = await axios.get(`${process.env.REACT_APP_API_URL}/sensorsRZs`, {
        params: { RZs }
      });
      setSensorsData(sensorsResponse.data);
      onUpdateSensorsData(sensorsResponse.data); // předáme data senzorů komponentě VehicleViewer
    } catch (error) {
      console.error('Error loading vehicles or sensors:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  const handleSelectVehicle = (vehicle) => {
    setSelectedVehicleId(vehicle.idCar);
    onSelectVehicle(vehicle);
  };

  const getWarningIcon = (level) => {
    const color = level === 'red' ? 'red' : level === 'orange' ? 'orange' : 'green';
    return <FontAwesomeIcon icon={faCircle} color={color} />;
  };

  const getRecentDataIcon = (hasRecent) => {
    return hasRecent ? <FontAwesomeIcon icon={faSignal} color="blue" /> : null;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <Typography variant="h4">Seznam vozidel</Typography>
        <Button variant="contained" color="primary" onClick={() => setShowAddVehicleModal(true)}>
          Přidat vozidlo
        </Button>
      </Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Varování</TableCell>
              <TableCell>RZ</TableCell>
              <TableCell>Typ vozidla</TableCell>
              <TableCell>ID Společnosti</TableCell>
              <TableCell>Aktivní zařízení</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {vehicles.map(vehicle => {
              // Filtrování senzorů podle RZ vozidla
              const vehicleSensors = sensorsData.filter(sensor => sensor.RZ === vehicle.RZ);
              const warningLevel = getWarningLevel(vehicleSensors);
              const recentData = hasRecentData(vehicleSensors);

              // Vypočítáme aktuální čas a vyfiltrujeme pouze senzory s daty z posledních 10 minut
              const currentTime = new Date().getTime();
              const recentSensors = vehicleSensors.filter(sensor => ((currentTime - sensor.timestamp) / 60000) < 10);

              // Získání jedinečných hodnot deviceName z recentSensors (vynecháme null nebo prázdné hodnoty)
              const uniqueDeviceNames = Array.from(
                new Set(recentSensors.map(sensor => sensor.deviceName).filter(name => name))
              );
              const devicesList = uniqueDeviceNames.join(', ');

              return (
                <TableRow
                  key={vehicle.idCar}
                  selected={vehicle.idCar === selectedVehicleId}
                  onClick={() => handleSelectVehicle(vehicle)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    {getWarningIcon(warningLevel)}
                    {getRecentDataIcon(recentData)}
                  </TableCell>
                  <TableCell>{vehicle.RZ}</TableCell>
                  <TableCell>{vehicle.vehicleType}</TableCell>
                  <TableCell>{vehicle.companyId}</TableCell>
                  <TableCell>{devicesList}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <AddVehicleModal
        show={showAddVehicleModal}
        onHide={() => setShowAddVehicleModal(false)}
        onVehicleAdded={() => {
          setShowAddVehicleModal(false);
          fetchData();
        }}
      />
    </Box>
  );
}

export default VehicleList;
