import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import axios from 'axios';

const AddSensorForm = ({ show, onClose, position, RZ }) => {
  const [macAddress, setMacAddress] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/update-tyre-data`, {
        position,
        macAddress,
        RZ
      });

      if (response.data.success) {
        alert('Senzor byl úspěšně přidán.');
        onClose(); // Zavření dialogu po úspěšném přidání
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      setError('Chyba při přidávání senzoru.');
    }
  };

  return (
    <Dialog open={show} onClose={onClose}>
      <DialogTitle>Přidat senzor</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Přidejte senzor na pozici {position} pro vozidlo {RZ}.
        </DialogContentText>
        <TextField
          fullWidth
          label="MAC adresa senzoru"
          value={macAddress}
          onChange={(e) => setMacAddress(e.target.value)}
          required
        />
        {error && <Typography color="error">{error}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Zrušit
        </Button>
        <Button onClick={handleSubmit} color="primary" autoFocus>
          Přidat
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddSensorForm;
