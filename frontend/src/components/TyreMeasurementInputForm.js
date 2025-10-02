// TyreMeasurementInputForm.js
import React, { useState } from 'react';
import { Box, Button, TextField, Typography, FormControlLabel, Checkbox } from '@mui/material';

const TyreMeasurementInputForm = ({ tyreLabel, vehicleId, onClose, onSave }) => {
  const [measurementData, setMeasurementData] = useState({
    outer_tread_depth: '',
    center_tread_depth: '',
    inner_tread_depth: '',
    tyre_rotated: false,
    measured_pressure: '',
    tpms_pressure: '',
  });

  const handleChange = (field, value) => {
    setMeasurementData((prevData) => ({
      ...prevData,
      [field]: value,
    }));
  };

  const handleSubmit = () => {
    onSave(tyreLabel, measurementData);
    onClose();
  };

  return (
    <Box>
      <Typography variant="h6">Měření pro pneumatiku {tyreLabel}</Typography>
      <TextField
        label="Hloubka vnější drážky (mm)"
        type="number"
        inputProps={{ step: 0.1 }}
        value={measurementData.outer_tread_depth}
        onChange={(e) => handleChange('outer_tread_depth', e.target.value)}
        fullWidth
        margin="normal"
      />
      <TextField
        label="Hloubka střední drážky (mm)"
        type="number"
        inputProps={{ step: 0.1 }}
        value={measurementData.center_tread_depth}
        onChange={(e) => handleChange('center_tread_depth', e.target.value)}
        fullWidth
        margin="normal"
      />
      <TextField
        label="Hloubka vnitřní drážky (mm)"
        type="number"
        inputProps={{ step: 0.1 }}
        value={measurementData.inner_tread_depth}
        onChange={(e) => handleChange('inner_tread_depth', e.target.value)}
        fullWidth
        margin="normal"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={measurementData.tyre_rotated}
            onChange={(e) => handleChange('tyre_rotated', e.target.checked)}
          />
        }
        label="Pneumatika otočena na disku"
      />
      <TextField
        label="Naměřený tlak (bar)"
        type="number"
        inputProps={{ step: 0.01 }}
        value={measurementData.measured_pressure}
        onChange={(e) => handleChange('measured_pressure', e.target.value)}
        fullWidth
        margin="normal"
      />
      <TextField
        label="Tlak z TPMS senzoru (bar)"
        type="number"
        inputProps={{ step: 0.01 }}
        value={measurementData.tpms_pressure}
        onChange={(e) => handleChange('tpms_pressure', e.target.value)}
        fullWidth
        margin="normal"
      />
      <Box mt={2} display="flex" justifyContent="space-between">
        <Button variant="contained" color="primary" onClick={handleSubmit}>
          Uložit
        </Button>
        <Button variant="outlined" onClick={onClose}>
          Zrušit
        </Button>
      </Box>
    </Box>
  );
};

export default TyreMeasurementInputForm;
