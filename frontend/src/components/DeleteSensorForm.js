import React, { useState } from 'react';
import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button, Typography } from '@mui/material';
import axios from 'axios';

const DeleteSensorForm = ({ show, onClose, position, macAddress, RZ }) => {
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setError(null);

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/remove-sensor`, {
        position,
        macAddress,
        RZ
      });

      if (response.data.success) {
        alert('Senzor byl úspěšně odstraněn.');
        onClose(); // Zavření dialogu po úspěšném odstranění
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      setError('Chyba při odstraňování senzoru.');
    }
  };

  return (
    <Dialog open={show} onClose={onClose}>
      <DialogTitle>Vymazat senzor</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Opravdu chcete vymazat senzor s MAC adresou {macAddress} na pozici {position} vozidla {RZ}?
        </DialogContentText>
        {error && <Typography color="error">{error}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Zrušit
        </Button>
        <Button onClick={handleSubmit} color="primary" autoFocus>
          Vymazat
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteSensorForm;
