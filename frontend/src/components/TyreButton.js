import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleArrowUp, faCircleArrowDown, faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import { Box, Typography } from '@mui/material';

const TyreButton = ({ label, sensorData, onContextMenu, onLabelClick }) => {
  const [isFreshData, setIsFreshData] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [boxColor, setBoxColor] = useState('white');

  useEffect(() => {
    if (sensorData) {
      const currentTime = new Date().getTime();
      const dataAgeMinutes = (currentTime - sensorData.timestamp) / 60000;
      setHasData(true);
      setIsFreshData(dataAgeMinutes < 10);
      setBoxColor(dataAgeMinutes < 10 ? 'green' : 'white');
    } else {
      setHasData(false);
      setBoxColor('white');
    }
  }, [sensorData]);

  // Kontrola odchylky tlaku
  let pressureStatusIcon = null;
  let targetPressureMessage = '';
  if (sensorData) {
    const pressures = Object.values(sensorData.pressures || {});
    const currentPressure = sensorData.pressure;
    const significantDeviation = pressures.some(pressure => Math.abs(pressure - currentPressure) / currentPressure > 0.02);
    const idealPressure = sensorData.idealPressure;
    const adjustedPressure20C = sensorData.adjusted_pressure_20C;

    // Přepočet optimálního tlaku při aktuální teplotě
    const referenceTemperature = 293.15; // 20°C v Kelvinech
    const currentTemperature = sensorData.temperature + 273.15; // Aktuální teplota v Kelvinech
    const optimalPressureAtCurrentTemp = (idealPressure * currentTemperature) / referenceTemperature;

    const pressureDifference = ((adjustedPressure20C - idealPressure) / idealPressure) * 100;
    if (pressureDifference < -10) {
      pressureStatusIcon = <FontAwesomeIcon icon={faCircleArrowUp} color="red" size="2x" />;
      targetPressureMessage = `${optimalPressureAtCurrentTemp.toFixed(1)}`;
    } else if (pressureDifference >= -10 && pressureDifference < -5) {
      pressureStatusIcon = <FontAwesomeIcon icon={faCircleArrowUp} color="orange" size="2x" />;
      targetPressureMessage = `${optimalPressureAtCurrentTemp.toFixed(1)}`;
    } else if (pressureDifference > 10) {
      pressureStatusIcon = <FontAwesomeIcon icon={faCircleArrowDown} color="red" size="2x" />;
      targetPressureMessage = `${optimalPressureAtCurrentTemp.toFixed(1)}`;
    } else if (pressureDifference <= 10 && pressureDifference > 5) {
      pressureStatusIcon = <FontAwesomeIcon icon={faCircleArrowDown} color="orange" size="2x" />;
      targetPressureMessage = `${optimalPressureAtCurrentTemp.toFixed(1)}`;
    } else {
      pressureStatusIcon = <FontAwesomeIcon icon={faCircleCheck} color="green" size="2x" />;
      targetPressureMessage = `${optimalPressureAtCurrentTemp.toFixed(1)}`;
    }

    if (significantDeviation) {
      targetPressureMessage = `${optimalPressureAtCurrentTemp.toFixed(1)}`;
    }
  }

  const handleClick = (event) => {
    if (hasData) {
      if (event.target.className.includes('sensor-detail')) {
        onLabelClick(sensorData);
      } else {
        onContextMenu(event, label);
      }
    } else {
      onContextMenu(event, label);
    }
  };

  const handleRightClick = (event) => {
    event.preventDefault();
    onContextMenu(event, label);
  };

  return (
    <Box
      id={`tyre-button-${label}`}
      className="tyre-button-container"
      onContextMenu={handleRightClick}
      sx={{
        padding: '2px 2px',
        width: '70px', // Zmenšení šířky
        textAlign: 'center',
        boxSizing: 'border-box',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
      onClick={handleClick}
    >
      <Box sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        p: 1,
        bgcolor: boxColor,
        borderRadius: 1,
        boxShadow: 1,
        border: '1px solid',
        borderColor: 'text.secondary',
        width: '100%',
        paddingLeft: '2px',
        paddingRight: '2px'
      }}>
        <Typography className="tyre-label" variant="caption" sx={{
          position: 'absolute',
          top: '-10px',
          left: '10px',
          bgcolor: 'background.paper',
          px: 1,
        }}>
          {label}
        </Typography>
        {hasData ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', width: '100%', mt: 2 }}>
            <Box className="sensor-detail aktualni" sx={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              p: 1,
              bgcolor: 'background.default',
              borderRadius: 1,
              boxShadow: 1,
              border: '1px solid',
              borderColor: 'text.secondary',
              width: '100%',
              marginBottom: '5px',
              paddingLeft: '2px',
              paddingRight: '2px'
            }}>
              <Typography className="tyre-label aktualni" variant="caption" sx={{
                position: 'absolute',
                top: '-10px',
                left: '10px',
                bgcolor: 'background.paper',
                px: 1,
              }}>
                20°C
              </Typography>
              <Typography variant="body2">{sensorData?.adjusted_pressure_20C.toFixed(1)}</Typography>
              <Typography variant="caption" sx={{ marginTop: '-4px' }}>bar</Typography>
            </Box>
            <Box className="sensor-detail prepocitany" sx={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              p: 1,
              bgcolor: 'background.default',
              borderRadius: 1,
              boxShadow: 1,
              border: '1px solid',
              borderColor: 'text.secondary',
              width: '100%',
              marginBottom: '5px',
              paddingLeft: '2px',
              paddingRight: '2px'
            }}>
              <Typography className="tyre-label prepocitany" variant="caption" sx={{
                position: 'absolute',
                top: '-10px',
                left: '10px',
                bgcolor: 'background.paper',
                px: 1,
              }}>
                {Math.round(sensorData?.temperature)}°C
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {sensorData?.pressure.toFixed(1)}
              </Typography>
              {pressureStatusIcon && (
                <Box className="pressure-status-icon" sx={{ marginBottom: '5px' }}>
                  {pressureStatusIcon}
                </Box>
              )}
              {targetPressureMessage && (
                <Box className="target-pressure" sx={{ marginBottom: '5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <Typography variant="body2">{targetPressureMessage}</Typography>
                  <Typography className="bar" variant="caption">bar</Typography>
                </Box>
              )}
            </Box>
          </Box>
        ) : (
          <Typography className="tyre-label" variant="caption" sx={{ marginTop: '10px' }}>
            {label}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default TyreButton;
