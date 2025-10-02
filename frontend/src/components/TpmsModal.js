import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { IconButton, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button, Alert } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { styled } from '@mui/system';
import '../css/TpmsModal.css';

// Stylování tabulky pro centrování ikon
const CenteredTableCell = styled('td')({
  textAlign: 'center',
  verticalAlign: 'middle',
});

const TpmsModal = ({ show, onClose, tyreLabel, selectedVehicleRZ, activeFunction, locationId }) => {
  const [data, setData] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState('');
  const [dialogMessage, setDialogMessage] = useState('');
  const [dialogCallback, setDialogCallback] = useState(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // Funkce pro získání dat čidel
  const fetchTpmsData = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/sensors`, {
        params: { locationId }
      });
      const sortedData = response.data.sort((a, b) => {
        if (a.RZ === selectedVehicleRZ && b.RZ !== selectedVehicleRZ) return -1;
        if (a.RZ !== selectedVehicleRZ && b.RZ === selectedVehicleRZ) return 1;
        if (a.RZ === b.RZ) {
          if (a.position < b.position) return -1;
          if (a.position > b.position) return 1;
        }
        if (a.RZ < b.RZ) return -1;
        if (a.RZ > b.RZ) return 1;
        return 0;
      });
      setData(sortedData);
    } catch (error) {
      console.error('Error fetching sensors data:', error);
    }
  };

  useEffect(() => {
    if (show && activeFunction === 'tpms') {
      fetchTpmsData();
    }
  }, [show, activeFunction, locationId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (show && event.target.className === 'tpms-modal-overlay') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [show, onClose]);

  if (!show) {
    return null;
  }

  // Funkce pro aktualizaci údajů o pneumatice
  const updateTyreData = async (item, newTyreLabel) => {
    const url = `${process.env.REACT_APP_API_URL}/update-tyre-data`;
    const dataToUpdate = {
      position: newTyreLabel,
      macAddress: item.macAddress,
      RZ: selectedVehicleRZ
    };

    try {
      const response = await axios.post(url, dataToUpdate);

      if (response.data.success) {
        console.log('Update successful:', response.data.message);
        setAlertMessage('Senzor byl úspěšně spárován.');
        setAlertOpen(true);
        fetchTpmsData(); // Refresh data after pairing
        onClose();
      } else {
        console.error('Update failed:', response.data.message);
      }
    } catch (error) {
      console.error('Error updating tyre data:', error);
    }
  };

  // Funkce pro odstranění čidla
  const removeSensor = async (item) => {
    const url = `${process.env.REACT_APP_API_URL}/remove-sensor`;
    const dataToRemove = {
      position: item.position,
      macAddress: item.macAddress,
      RZ: item.RZ
    };

    try {
      const response = await axios.post(url, dataToRemove);

      if (response.data.success) {
        console.log('Removal successful:', response.data.message);
        setAlertMessage('Senzor byl úspěšně odstraněn.');
        setAlertOpen(true);
        fetchTpmsData(); // Refresh data after removal
        onClose();
      } else {
        console.error('Removal failed:', response.data.message);
      }
    } catch (error) {
      console.error('Error removing sensor:', error);
    }
  };

  const handlePairClick = (item, rowColor) => {
    if (rowColor.backgroundColor === 'green') {
      // Ikona je nefunkční, žádná akce
    } else if (rowColor.backgroundColor === 'orange') {
      setDialogMessage(`Toto čidlo je spárováno s pozicí ${item.position}, chcete aktualizovat na pozici ${tyreLabel}?`);
      setDialogType('pair');
      setDialogCallback(() => () => updateTyreData(item, tyreLabel));
      setDialogOpen(true);
    } else if (rowColor.backgroundColor === 'red') {
      setDialogMessage(`Toto čidlo je přiřazeno k jinému vozidlu, chcete jej přiřadit k vozidlu ${selectedVehicleRZ} a pozici ${tyreLabel}?`);
      setDialogType('pair');
      setDialogCallback(() => () => updateTyreData(item, tyreLabel));
      setDialogOpen(true);
    } else if (rowColor.backgroundColor === 'blue') {
      setDialogMessage(`Chcete přiřadit toto čidlo k vozidlu ${selectedVehicleRZ} a pozici ${tyreLabel}?`);
      setDialogType('pair');
      setDialogCallback(() => () => updateTyreData(item, tyreLabel));
      setDialogOpen(true);
    }
  };

  const handleRemoveClick = (item) => {
    setDialogMessage(`Opravdu chcete odstranit čidlo na pozici ${item.position} s MAC adresou ${item.macAddress}?`);
    setDialogType('remove');
    setDialogCallback(() => () => removeSensor(item));
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setDialogCallback(null);
  };

  const handleDialogConfirm = () => {
    if (dialogCallback) {
      dialogCallback();
    }
    handleDialogClose();
  };

  const getRowColor = (item) => {
    if (item.RZ === selectedVehicleRZ && item.position === tyreLabel) {
      return { backgroundColor: 'green', color: 'white' };
    } else if (item.RZ === selectedVehicleRZ) {
      return { backgroundColor: 'orange', color: 'black' };
    } else if (!item.RZ && !item.position) {
      return { backgroundColor: 'blue', color: 'white' };
    } else {
      return { backgroundColor: 'red', color: 'white' };
    }
  };

  return (
    <div className="tpms-modal-overlay">
      <div className="tpms-modal" style={{ maxWidth: '800px', width: '100%' }}> {/* Přidání šířky modalu */}
        <div className="tpms-modal-header">
          <h4 className="tpms-modal-title">{activeFunction === 'tpms' ? `Párování TPMS pro ${tyreLabel}` : `Funkce měření pro ${tyreLabel}`}</h4>
        </div>
        <div className="tpms-modal-body">
          <table className="tpms-modal-table">
            <thead>
              <tr>
                {activeFunction === 'tpms' ? (
                  <>
                    <th>Čidlo</th>
                    <th>Tlak</th>
                    <th>SPZ</th>
                    <th>Pozice</th>
                    <th>Párovat</th>
                    <th>Odstranit</th>
                  </>
                ) : (
                  <>
                    <th>Měření</th>
                    <th>Hodnota</th>
                    <th>Jednotka</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => {
                const rowColor = getRowColor(item);
                return (
                  <tr key={index} style={rowColor}>
                    {activeFunction === 'tpms' ? (
                      <>
                        <td>{item.short_macAddress}</td>
                        <td>{item.current_pressure}</td>
                        <td>{item.RZ}</td>
                        <td>{item.position}</td>
                        <CenteredTableCell>
                          <IconButton onClick={() => handlePairClick(item, rowColor)} style={{ color: rowColor.color }}>
                            {rowColor.backgroundColor !== 'green' && '🔗'}
                          </IconButton>
                        </CenteredTableCell>
                        <CenteredTableCell>
                          <IconButton onClick={() => handleRemoveClick(item)} style={{ color: rowColor.backgroundColor === 'red' ? 'white' : 'red' }}>
                            <DeleteIcon />
                          </IconButton>
                        </CenteredTableCell>
                      </>
                    ) : (
                      <>
                        <td>{item.measurementType}</td>
                        <td>{item.measurementValue}</td>
                        <td>{item.measurementUnit}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="tpms-modal-footer">
          <Button onClick={onClose} variant="outlined" color="secondary">Zavřít</Button>
        </div>
      </div>
      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Potvrzení</DialogTitle>
        <DialogContent>
          <DialogContentText>{dialogMessage}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} color="primary">
            Zrušit
          </Button>
          <Button onClick={handleDialogConfirm} color="primary" autoFocus>
            Potvrdit
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={alertOpen} onClose={() => setAlertOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Informace</DialogTitle>
        <DialogContent>
          <DialogContentText>{alertMessage}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlertOpen(false)} color="primary" autoFocus>
            Zavřít
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default TpmsModal;
