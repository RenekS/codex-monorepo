// ExportXLSModal.js
import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Modal,
  FormControlLabel,
  Checkbox,
  FormGroup,
  CircularProgress,
  Snackbar,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import PropTypes from 'prop-types';

const ExportXLSModal = ({
  open,
  onClose,
  data,
  axData,
  eshopData,
  raynetData,
  selectedView,
  visibleColumns,
  version
}) => {
  // Stavové proměnné pro výběr dat a sloupců
  const [includeAX, setIncludeAX] = useState(false);
  const [includeEshop, setIncludeEshop] = useState(false);
  const [includeRaynet, setIncludeRaynet] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState(visibleColumns);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Handler pro změnu výběru dat k exportu
  const handleDataSelectionChange = (event) => {
    const { name, checked } = event.target;
    if (name === 'AX') setIncludeAX(checked);
    if (name === 'Eshop') setIncludeEshop(checked);
    if (name === 'Raynet') setIncludeRaynet(checked);
  };

  // Handler pro změnu výběru sloupců
  const handleColumnSelectionChange = (event) => {
    const { name, checked } = event.target;
    if (checked) {
      setSelectedColumns((prev) => [...prev, name]);
    } else {
      setSelectedColumns((prev) => prev.filter((col) => col !== name));
    }
  };

  // Zavření snackbaru
  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Funkce pro export dat do Excel souboru
  const handleExport = () => {
    setLoading(true);

    try {
      const exportData = [];

      // Přidání hlavních dat
      if (data && data.length > 0) {
        const mainData = data.map((row) => {
          const obj = {};
          selectedColumns.forEach((col) => {
            obj[col] = row[col] || '';
          });
          return obj;
        });
        exportData.push(...mainData);
      }

      // Přidání AX dat
      if (includeAX && axData && Object.keys(axData).length > 0) {
        const axExport = Object.values(axData).map((row) => {
          const obj = {};
          selectedColumns.forEach((col) => {
            obj[col] = row[col] || '';
          });
          return obj;
        });
        exportData.push(...axExport);
      }

      // Přidání Eshop dat
      if (includeEshop && eshopData && Object.keys(eshopData).length > 0) {
        const eshopExport = Object.values(eshopData).map((row) => {
          const obj = {};
          selectedColumns.forEach((col) => {
            obj[col] = row[col] || '';
          });
          return obj;
        });
        exportData.push(...eshopExport);
      }

      // Přidání Raynet dat
      if (includeRaynet && raynetData && Object.keys(raynetData).length > 0) {
        const raynetExport = Object.values(raynetData).map((row) => {
          const obj = {};
          selectedColumns.forEach((col) => {
            obj[col] = row[col] || '';
          });
          return obj;
        });
        exportData.push(...raynetExport);
      }

      // Vytvoření pracovního listu a pracovního sešitu
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');

      // Generování Excel souboru jako binární data
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

      // Uložení souboru pomocí file-saver
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      saveAs(blob, `Export_${selectedView}_${version}.xlsx`);

      setSnackbar({ open: true, message: 'Export byl úspěšně dokončen!', severity: 'success' });
      setLoading(false);
      onClose();
    } catch (error) {
      console.error('Chyba při exportu dat:', error);
      setSnackbar({ open: true, message: 'Chyba při exportu dat.', severity: 'error' });
      setLoading(false);
    }
  };

  // Funkce pro získání všech možných sloupců
  const getAllColumns = () => {
    const allDataColumns = data.length > 0 ? Object.keys(data[0]) : [];
    const axColumns = includeAX && axData && Object.keys(axData).length > 0
      ? Object.keys(axData[Object.keys(axData)[0]]).filter((col) => !allDataColumns.includes(col))
      : [];
    const eshopColumns = includeEshop && eshopData && Object.keys(eshopData).length > 0
      ? Object.keys(eshopData[Object.keys(eshopData)[0]]).filter((col) => !allDataColumns.includes(col))
      : [];
    const raynetColumns = includeRaynet && raynetData && Object.keys(raynetData).length > 0
      ? Object.keys(raynetData[Object.keys(raynetData)[0]]).filter((col) => !allDataColumns.includes(col))
      : [];

    const additionalColumns = [...axColumns, ...eshopColumns, ...raynetColumns];
    return [...new Set([...allDataColumns, ...additionalColumns])];
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
            width: { xs: '90%', sm: 500 },
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            borderRadius: '8px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}
        >
          <Typography variant="h6" gutterBottom>
            Exportovat Data do XLS
          </Typography>

          {/* Výběr dat k exportu */}
          <Typography variant="subtitle1">Vyberte data k exportu:</Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeAX}
                  onChange={handleDataSelectionChange}
                  name="AX"
                />
              }
              label="AX Data"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeEshop}
                  onChange={handleDataSelectionChange}
                  name="Eshop"
                />
              }
              label="Eshop Data"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeRaynet}
                  onChange={handleDataSelectionChange}
                  name="Raynet"
                />
              }
              label="Raynet Data"
            />
          </FormGroup>

          {/* Výběr sloupců k exportu */}
          <Typography variant="subtitle1" sx={{ mt: 2 }}>Vyberte sloupce k exportu:</Typography>
          <FormGroup>
            {getAllColumns().map((col) => (
              <FormControlLabel
                key={col}
                control={
                  <Checkbox
                    checked={selectedColumns.includes(col)}
                    onChange={handleColumnSelectionChange}
                    name={col}
                  />
                }
                label={col}
              />
            ))}
          </FormGroup>

          {/* Tlačítko pro export */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
            <Button onClick={onClose} sx={{ mr: 2 }} disabled={loading}>
              Zrušit
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleExport}
              disabled={loading || selectedColumns.length === 0 || data.length === 0}
              startIcon={loading ? <CircularProgress size={20} /> : <DownloadIcon />}
            >
              Exportovat
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
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

// Definice typů props pro komponentu
ExportXLSModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  data: PropTypes.array.isRequired,
  axData: PropTypes.object.isRequired,
  eshopData: PropTypes.object.isRequired,
  raynetData: PropTypes.object.isRequired,
  selectedView: PropTypes.string.isRequired,
  visibleColumns: PropTypes.array.isRequired,
  version: PropTypes.string.isRequired
};

export default ExportXLSModal;
