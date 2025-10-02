// SynonymConflictModal.js
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Modal,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Grid,
  CircularProgress,
  Snackbar,
  Alert,
  FormGroup,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import axios from 'axios';
import PropTypes from 'prop-types';

// Mapa endpoints pro každý sloupec
const endpointsMap = {
  "M+S": {
    synonym: "/ms_synonymum",
    add: "/ms_add"
  },
  "Šířka": {
    synonym: "/sirka_synonymum",
    add: "/sirka_add"
  },
  "Profil": {
    synonym: "/profil_synonymum",
    add: "/profil_add"
  },
  "Dezén": {
    synonym: "/dezen_synonymum",
    add: "/dezen_add"
  },
  "Zesileni": {
    synonym: "/zesileni_synonymum",
    add: "/zesileni_add"
  },
  "Provoz": {
    synonym: "/zpusob_uziti_synonymum",
    add: "/zpusob_uziti_add"
  },
  "3PMSF": {
    synonym: "/tpmsf_synonymum",
    add: "/tpmsf_add"
  },
  "Náprava": {
    synonym: "/pozice_synonymum",
    add: "/pozice_add"
  }
  // Přidejte další sloupce dle potřeby
};

const SynonymConflictModal = ({ open, onClose, conflicts, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Seznam sloupců, které chceme zobrazit (filtrování konfliktů)
  const [selectedColumns, setSelectedColumns] = useState([]);

  // Informace pro "mapování" (synonymum) – pro každý konflikt si držíme, jakou existující hodnotu vybral uživatel
  const [existingValueSelection, setExistingValueSelection] = useState({});

  // Informace pro "přidání nové hodnoty" – pro každý konflikt si držíme novou hodnotu a synonyma
  const [newValueData, setNewValueData] = useState({});

  // Při změně "conflicts" se znovu připraví výchozí filtry
  useEffect(() => {
    if (conflicts.length > 0) {
      const uniqueColumns = [...new Set(conflicts.map(conflict => conflict.columnKey))];
      setSelectedColumns(uniqueColumns); // Vybereme výchozí všechny sloupce
    } else {
      setSelectedColumns([]);
    }
  }, [conflicts]);

  // Změna filtru sloupců
  const handleColumnSelectionChange = (event) => {
    const { name, checked } = event.target;
    if (checked) {
      setSelectedColumns(prev => [...prev, name]);
    } else {
      setSelectedColumns(prev => prev.filter(col => col !== name));
    }
  };

  // Zavření snackbar
  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Aktuální konflikty dle vybraných sloupců
  const filteredConflicts = conflicts.filter(conflict => selectedColumns.includes(conflict.columnKey));

  // ----- HANDLER: Přidat synonymum -----
  const handleAddSynonym = async (conflict, index) => {
    // conflict: { columnKey, originalValue, dataSet, endpoint }
    const columnKey = conflict.columnKey;
    const chosenValue = existingValueSelection[index] || ''; // Vybraná existující hodnota
    const newSynonym = conflict.originalValue.trim();       // Nový synonym = neznámá hodnota

    if (!chosenValue) {
      setSnackbar({
        open: true,
        message: `Konflikt č. ${index + 1}: Nebyla vybrána existující hodnota pro přidání synonyma.`,
        severity: 'error'
      });
      return;
    }

    // Najdeme endpoint
    const endpoints = endpointsMap[columnKey];
    if (!endpoints) {
      setSnackbar({
        open: true,
        message: `Pro sloupec "${columnKey}" není definován endpoint!`,
        severity: 'error'
      });
      return;
    }

    const synonymsEndpoint = endpoints.synonym; // např. "/ms_synonymum"

    try {
      setLoading(true);

      // Předpokládáme, že na serveru k "přidání synonyma" voláme POST
      await axios.post(`${process.env.REACT_APP_API_URL}${synonymsEndpoint}`, {
        existingValue: chosenValue,
        newSynonym
      });

      // Po úspěchu informujeme parent
      onSuccess(conflict.endpoint); 
      setSnackbar({
        open: true,
        message: `Synonymum "${newSynonym}" bylo úspěšně přidáno k "${chosenValue}"!`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Chyba při volání endpoints (přidání synonyma):', error);
      setSnackbar({
        open: true,
        message: `Chyba při přidávání synonyma: ${error.response?.data?.error || error.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // ----- HANDLER: Přidat hodnotu -----
  const handleAddValue = async (conflict, index) => {
    const columnKey = conflict.columnKey;
    // Nová "value" a volitelná "synonyms"
    const newValue = (newValueData[index]?.value || conflict.originalValue || '').trim();
    const synonyms = newValueData[index]?.synonyms || '';

    if (!newValue) {
      setSnackbar({
        open: true,
        message: `Konflikt č. ${index + 1}: Nová hodnota je prázdná!`,
        severity: 'error'
      });
      return;
    }

    // Najdeme endpoint
    const endpoints = endpointsMap[columnKey];
    if (!endpoints) {
      setSnackbar({
        open: true,
        message: `Pro sloupec "${columnKey}" není definován endpoint!`,
        severity: 'error'
      });
      return;
    }

    const addEndpoint = endpoints.add; // např. "/ms_add"

    try {
      setLoading(true);

      // Volání endpointu pro přidání nové hodnoty
      await axios.post(`${process.env.REACT_APP_API_URL}${addEndpoint}`, {
        value: newValue,
        synonyms
      });

      onSuccess(conflict.endpoint);
      setSnackbar({
        open: true,
        message: `Hodnota "${newValue}" byla úspěšně přidána!`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Chyba při volání endpoints (přidání nové hodnoty):', error);
      setSnackbar({
        open: true,
        message: `Chyba při přidávání nové hodnoty: ${error.response?.data?.error || error.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // ----- RENDER JEDNOHO KONFLIKTU -----
  const renderConflict = (conflict, index) => {
    // conflict.dataSet = [{ id, value, synonyms }, ...]
    const existingValues = conflict.dataSet.map(item => item.value);

    return (
      <Box key={index} sx={{ mb: 4, p: 2, border: '1px solid #ccc', borderRadius: '8px' }}>
        <Typography variant="h6" gutterBottom>
          Konflikt {index + 1}
        </Typography>
        <Typography variant="body1">
          <strong>Sloupec:</strong> {conflict.columnKey}
        </Typography>
        <Typography variant="body1" gutterBottom>
          <strong>Neznámá hodnota:</strong> {conflict.originalValue}
        </Typography>

        {/* BLOK PRO "PŘIDAT SYNONYMUM" */}
        <Box sx={{ mt: 2, mb: 2, p: 2, border: '1px dashed #999', borderRadius: '4px' }}>
          <Typography variant="subtitle1" gutterBottom>
            Přidat synonymum k existující hodnotě:
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Existující hodnota</InputLabel>
            <Select
              value={existingValueSelection[index] || ''}
              label="Existující hodnota"
              onChange={(e) => {
                setExistingValueSelection(prev => ({
                  ...prev,
                  [index]: e.target.value
                }));
              }}
            >
              {existingValues.map((val) => (
                <MenuItem key={val} value={val}>{val}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            size="small"
            color="secondary"
            sx={{ mt: 1 }}
            onClick={() => handleAddSynonym(conflict, index)}
            disabled={loading}
          >
            Přidat synonymum
          </Button>
        </Box>

        {/* BLOK PRO "PŘIDAT NOVOU HODNOTU" */}
        <Box sx={{ mt: 2, p: 2, border: '1px dashed #999', borderRadius: '4px' }}>
          <Typography variant="subtitle1" gutterBottom>
            Přidat novou hodnotu:
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Nová hodnota"
                fullWidth
                size="small"
                value={newValueData[index]?.value !== undefined
                  ? newValueData[index].value
                  : conflict.originalValue
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setNewValueData(prev => ({
                    ...prev,
                    [index]: {
                      ...prev[index],
                      value: val
                    }
                  }));
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Synonyma (oddělte čárkou)"
                fullWidth
                size="small"
                value={newValueData[index]?.synonyms || ''}
                onChange={(e) => {
                  const syns = e.target.value;
                  setNewValueData(prev => ({
                    ...prev,
                    [index]: {
                      ...prev[index],
                      synonyms: syns
                    }
                  }));
                }}
              />
            </Grid>
          </Grid>
          <Button
            variant="contained"
            size="small"
            color="primary"
            sx={{ mt: 1 }}
            onClick={() => handleAddValue(conflict, index)}
            disabled={loading}
          >
            Přidat hodnotu
          </Button>
        </Box>
      </Box>
    );

  };

  return (
    <>
      <Modal open={open} onClose={onClose}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90%', sm: 800 },
            maxHeight: '90vh',
            overflowY: 'auto',
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            borderRadius: '8px'
          }}
        >
          <Typography variant="h5" gutterBottom>
            Vyřešení Konfliktů Synonym
          </Typography>

          {/* Sekce pro výběr sloupců k zobrazení konfliktů */}
          {conflicts.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Vyberte sloupce k zobrazení konfliktů:
              </Typography>
              <FormGroup row>
                {[...new Set(conflicts.map(conflict => conflict.columnKey))].map((column) => (
                  <FormControlLabel
                    key={column}
                    control={
                      <Checkbox
                        checked={selectedColumns.includes(column)}
                        onChange={handleColumnSelectionChange}
                        name={column}
                      />
                    }
                    label={column}
                  />
                ))}
              </FormGroup>
            </Box>
          )}

          {/* Zobrazení konfliktů dle vybraných sloupců */}
          {filteredConflicts.length === 0 ? (
            <Typography variant="body1">
              {conflicts.length === 0
                ? 'Nejsou žádné konflikty.'
                : 'Žádné konflikty k vyřešení pro vybrané sloupce.'}
            </Typography>
          ) : (
            filteredConflicts.map((conflict, idx) => renderConflict(conflict, idx))
          )}

          {/* Tlačítka dole - jen zavřít modal */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
            <Button onClick={onClose} disabled={loading}>
              Zavřít
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* Snackbar pro zpětnou vazbu */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message.split('\n').map((str, idx) => (
            <span key={idx}>
              {str}
              <br />
            </span>
          ))}
        </Alert>
      </Snackbar>
    </>
  );
};

// Definice typů props pro komponentu
SynonymConflictModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  conflicts: PropTypes.arrayOf(PropTypes.shape({
    columnKey: PropTypes.string.isRequired,
    originalValue: PropTypes.string.isRequired,
    dataSet: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.number.isRequired,
      value: PropTypes.string.isRequired,
      synonyms: PropTypes.string
    })).isRequired,
    endpoint: PropTypes.string.isRequired
  })).isRequired,
  onSuccess: PropTypes.func.isRequired
};

export default SynonymConflictModal;
