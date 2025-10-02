import React, { useEffect, useState } from 'react';
import { Box, Typography, Modal, Divider } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleArrowUp, faCircleArrowDown, faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import { Thermostat, BatteryFull, Speed } from '@mui/icons-material';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import axios from 'axios';

const SensorDetailModal = ({ open, onClose, sensorData }) => {
  const [currentSensorData, setCurrentSensorData] = useState(sensorData);

  useEffect(() => {
    let interval;

    const fetchSensorData = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/sensor-data/${sensorData.macAddress}`);
        setCurrentSensorData(response.data);
      } catch (error) {
        console.error('Error fetching sensor data:', error);
      }
    };

    if (open) {
      fetchSensorData(); // Initial fetch
      interval = setInterval(fetchSensorData, 200); // Fetch every 0.2 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [open, sensorData]);

  if (!currentSensorData) {
    return null;
  }

  const title = `${currentSensorData.position} - ${currentSensorData.short_macAddress.toUpperCase()}`;

  const idealPressure = currentSensorData.idealPressure;
  const adjustedPressure20C = currentSensorData.adjusted_pressure_20C;
  const currentTemperature = currentSensorData.temperature + 273.15;
  const referenceTemperature = 293.15; // 20°C in Kelvin
  const optimalPressureAtCurrentTemp = (idealPressure * currentTemperature) / referenceTemperature;

  const pressureDifference = ((adjustedPressure20C - idealPressure) / idealPressure) * 100;
  let pressureStatusIcon = <FontAwesomeIcon icon={faCircleCheck} color="green" size="2x" />;
  let pressureStatusText = 'Tlak je ideální';
  let adjustedPressureColor = 'green';

  if (pressureDifference < -10) {
    pressureStatusIcon = <FontAwesomeIcon icon={faCircleArrowUp} color="red" size="2x" />;
    pressureStatusText = 'Nutnost: Dohustit pneumatiku';
    adjustedPressureColor = 'red';
  } else if (pressureDifference >= -10 && pressureDifference < -5) {
    pressureStatusIcon = <FontAwesomeIcon icon={faCircleArrowUp} color="orange" size="2x" />;
    pressureStatusText = 'Doporučení: Dohustit pneumatiku';
    adjustedPressureColor = 'orange';
  } else if (pressureDifference > 10) {
    pressureStatusIcon = <FontAwesomeIcon icon={faCircleArrowDown} color="red" size="2x" />;
    pressureStatusText = 'Nutnost: Upustit pneumatiku';
    adjustedPressureColor = 'red';
  } else if (pressureDifference <= 10 && pressureDifference > 5) {
    pressureStatusIcon = <FontAwesomeIcon icon={faCircleArrowDown} color="orange" size="2x" />;
    pressureStatusText = 'Doporučení: Upustit pneumatiku';
    adjustedPressureColor = 'orange';
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="sensor-detail-modal-title"
      aria-describedby="sensor-detail-modal-description"
    >
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 600,
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: 24,
        p: 4,
        textAlign: 'center',
      }}>
        <Typography id="sensor-detail-modal-title" variant="h5" component="h2" gutterBottom>
          <strong>{title}</strong>
        </Typography>
        <Divider />
        <Box mt={2}>
          <Box sx={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            p: 4,
            bgcolor: 'background.default',
            borderRadius: 1,
            boxShadow: 1,
            border: '1px solid',
            borderColor: 'text.secondary',
            height: 400, // Zvýšení výšky pro lepší zobrazení
            width: '100%', // Přidání šířky
            backgroundImage: `url(${process.env.PUBLIC_URL + '/rez_pneu.png'})`,
            backgroundSize: 'contain', // Zajištění, aby obrázek nepřesahoval oblast
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}>
            <Box sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              display: 'flex',
              alignItems: 'center',
            }}>
              <SignalCellularAltIcon sx={{ mr: 1 }} />
              <Typography variant="body1"><strong>{currentSensorData.signalStrength || 'N/A'} dBm</strong></Typography>
            </Box>
            <Box sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              alignItems: 'center',
            }}>
              <BatteryFull sx={{ mr: 1 }} />
              <Typography variant="body1"><strong>{currentSensorData.batteryPercentage} %</strong></Typography>
            </Box>
            <Box sx={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              display: 'flex',
              alignItems: 'center',
            }}>
              <Thermostat sx={{ mr: 1 }} />
              <Typography variant="body1"><strong>{currentSensorData.temperature.toFixed(2)} °C</strong></Typography>
            </Box>
            <Box sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              display: 'flex',
              alignItems: 'center',
            }}>
              <Speed sx={{ mr: 1 }} />
              <Typography variant="body1"><strong>{optimalPressureAtCurrentTemp.toFixed(2)} bar</strong></Typography>
            </Box>
            <Box
              sx={{
                mt: 4, // Margin top to create space above the pressure value
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <Typography variant="h1" color={adjustedPressureColor} sx={{ fontWeight: 'bold', fontSize: '3rem', lineHeight: 1 }}>
                {currentSensorData.pressure.toFixed(2)}
                <Typography
                  variant="h5"
                  component="sup"
                  color={adjustedPressureColor}
                  sx={{ fontWeight: 'bold', ml: 0.5 }}
                >
                  bar
                </Typography>
              </Typography>
            </Box>
            <Box sx={{
              position: 'absolute',
              top: 8,
              left: '25%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid',
              borderColor: 'text.secondary',
              borderRadius: 1,
              padding: 1,
              backgroundColor: 'background.paper',
            }}>
              <Typography variant="caption" sx={{ bgcolor: 'background.paper', px: 1, position: 'absolute', top: '-12px' }}>Vnější</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'green' }}>9.0</Typography>
            </Box>
            <Box sx={{
              position: 'absolute',
              top: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid',
              borderColor: 'text.secondary',
              borderRadius: 1,
              padding: 1,
              backgroundColor: 'background.paper',
            }}>
              <Typography variant="caption" sx={{ bgcolor: 'background.paper', px: 1, position: 'absolute', top: '-12px' }}>Prostřední</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'green' }}>9.0</Typography>
            </Box>
            <Box sx={{
              position: 'absolute',
              top: 8,
              left: '75%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid',
              borderColor: 'text.secondary',
              borderRadius: 1,
              padding: 1,
              backgroundColor: 'background.paper',
            }}>
              <Typography variant="caption" sx={{ bgcolor: 'background.paper', px: 1, position: 'absolute', top: '-12px' }}>Vnitřní</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'green' }}>9.0</Typography>
            </Box>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
          }}>
            {pressureStatusIcon}
            <Typography variant="body1" sx={{ ml: 1 }}>
              {pressureStatusText}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};

export default SensorDetailModal;
