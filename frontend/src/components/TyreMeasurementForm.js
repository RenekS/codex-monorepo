// TyreMeasurementForm.js
import React, { useState, useEffect } from 'react';
import { Box, Button, TextField, Typography, Paper, Checkbox, FormControlLabel, IconButton } from '@mui/material';
import axios from 'axios';

const TyreMeasurementForm = ({ vehicleId, RZ, onClose, onSave }) => {
  const [odometerReading, setOdometerReading] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [measurements, setMeasurements] = useState([]);
  const [tyrePositions, setTyrePositions] = useState([]);

  useEffect(() => {
    const fetchTyrePositions = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/vehicle-tyre-positions/${vehicleId}`);
        setTyrePositions(response.data);
        setMeasurements(response.data.map(() => ({})));
      } catch (error) {
        console.error('Chyba při získávání pozic pneumatik:', error);
      }
    };

    if (vehicleId) {
      fetchTyrePositions();
    }
  }, [vehicleId]);

  const handleMeasurementChange = (index, field, value) => {
    const updatedMeasurements = [...measurements];
    updatedMeasurements[index] = {
      ...updatedMeasurements[index],
      [field]: value,
    };
    setMeasurements(updatedMeasurements);
  };

  const handleSubmit = async () => {
    try {
      if (!odometerReading || !technicianId || !locationId) {
        alert('Prosím vyplňte všechna povinná pole.');
        return;
      }

      const data = {
        vehicle_id: vehicleId,
        technician_id: technicianId,
        measurement_date: new Date(),
        location_id: locationId,
        odometer_reading: odometerReading,
        measurements: measurements.map((m, index) => ({
          tyre_position: tyrePositions[index].position,
          tyre_id: tyrePositions[index].tyre_id,
          outer_tread_depth: m.outer_tread_depth,
          center_tread_depth: m.center_tread_depth,
          inner_tread_depth: m.inner_tread_depth,
          tyre_rotated: m.tyre_rotated || false,
          measured_pressure: m.measured_pressure,
          tpms_pressure: m.tpms_pressure,
        })),
      };

      await axios.post(`${process.env.REACT_APP_API_URL}/tyre-measurements`, data);
      alert('Měření bylo úspěšně uloženo.');
      onSave();
    } catch (error) {
      console.error('Chyba při ukládání měření:', error);
      alert('Chyba při ukládání měření.');
    }
  };

  return (
    <Paper sx={{ padding: 2 }}>
      <Typography variant="h6">Nové měření pro vozidlo {RZ}</Typography>
      <Box mt={2}>
        <TextField
          label="Stav tachometru"
          value={odometerReading}
          onChange={(e) => setOdometerReading(e.target.value)}
          fullWidth
          margin="normal"
        />
        <TextField
          label="ID technika"
          value={technicianId}
          onChange={(e) => setTechnicianId(e.target.value)}
          fullWidth
          margin="normal"
        />
        <TextField
          label="ID místa měření"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          fullWidth
          margin="normal"
        />
      </Box>
      <Box mt={2}>
        {tyrePositions.map((tyre, index) => (
          <Box key={index} mt={2} sx={{ border: '1px solid #ddd', padding: 2, borderRadius: 2 }}>
            <Typography variant="subtitle1">Pozice: {tyre.position}</Typography>
            <TextField
              label="Hloubka vnější drážky (mm)"
              type="number"
              inputProps={{ step: 0.1 }}
              onChange={(e) => handleMeasurementChange(index, 'outer_tread_depth', e.target.value)}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Hloubka střední drážky (mm)"
              type="number"
              inputProps={{ step: 0.1 }}
              onChange={(e) => handleMeasurementChange(index, 'center_tread_depth', e.target.value)}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Hloubka vnitřní drážky (mm)"
              type="number"
              inputProps={{ step: 0.1 }}
              onChange={(e) => handleMeasurementChange(index, 'inner_tread_depth', e.target.value)}
              fullWidth
              margin="normal"
            />
            <FormControlLabel
              control={
                <Checkbox
                  onChange={(e) => handleMeasurementChange(index, 'tyre_rotated', e.target.checked)}
                />
              }
              label="Pneumatika otočena na disku"
            />
            <TextField
              label="Naměřený tlak (bar)"
              type="number"
              inputProps={{ step: 0.01 }}
              onChange={(e) => handleMeasurementChange(index, 'measured_pressure', e.target.value)}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Tlak z TPMS senzoru (bar)"
              type="number"
              inputProps={{ step: 0.01 }}
              onChange={(e) => handleMeasurementChange(index, 'tpms_pressure', e.target.value)}
              fullWidth
              margin="normal"
            />
          </Box>
        ))}
      </Box>
      <Box mt={2} display="flex" justifyContent="space-between">
        <Button variant="contained" color="primary" onClick={handleSubmit}>
          Uložit měření
        </Button>
        <Button variant="outlined" onClick={onClose}>
          Zrušit
        </Button>
      </Box>
    </Paper>
  );
};

export default TyreMeasurementForm;
