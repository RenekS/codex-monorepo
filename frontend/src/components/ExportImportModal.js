// src/components/ExportImportModal.js

import React, { useState, useEffect } from 'react';
import {
  Button,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Box,
  Typography,
} from '@mui/material';
import * as XLSX from 'xlsx';
import SearchSelectModal from './SearchSelectModal';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 800,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
};

const ExportImportModal = ({
  handleClose,
  onSubmit,
  productLineId,
  categoryId,
  onSheetSelect,
  fetchPLORTemplates,
  handleSelectPLORTemplate,
}) => {
  const [versionName, setVersionName] = useState('');
  const [file, setFile] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [supplier, setSupplier] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState('');
  const [showSearchSelectModal, setShowSearchSelectModal] = useState(false);

  // Přidány všechny relevantní sloupce (včetně "Index" sloupce, který se pak rozdělí na "Index nosnosti" a "Index rychlosti")
  const relevantKeys = [
    'Č. položky',
    'Cena',
    'Název',
    'Rozměr',
    'Náprava',
    'Provoz',
    'M+S',
    '3PMSF',
    'Dezén',
    'Šířka',
    'Profil',
    'Ráfek',
    'EAN',
    'Obrázek',
    // Zde mohou zůstat nebo nemusí - pokud v původním XLSX skutečně existují samostatné sloupce:
    'Index nosnosti',
    'Index rychlosti',
    // DŮLEŽITÉ: přidáme také "Index", abychom jej mohli následně rozdělit.
    'Index',
    'Štítek',
    'PR',
    'Valivý odpor',
    'Přilnavost',
    'Hluk (db)',
    'TT/TL',
    'Hmotnost',
    'Hloubka dezénu',
    'Zesílení'
  ];

  const resetForm = () => {
    setVersionName('');
    setFile(null);
    setSheets([]);
    setSelectedSheet('');
    setSupplier('');
    setManufacturer('');
    setCategory('');
    setType('');
  };

  // Vygeneruje verzi typu "20250120_SheetName_V1" na základě existujícího
  const generateVersionName = async (sheetName) => {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const dateString = `${year}${month}${day}`;
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/get-existing-versions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: dateString, sheetName }),
        }
      );
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      let maxVersionNumber = 0;
      data.versions.forEach((version) => {
        const match = version.filterName.match(/_V(\d+)$/);
        if (match) {
          const versionNumber = parseInt(match[1], 10);
          if (versionNumber > maxVersionNumber) {
            maxVersionNumber = versionNumber;
          }
        }
      });
      const newVersionNumber = maxVersionNumber + 1;
      const generatedName = `${dateString}_${sheetName}_V${newVersionNumber}`;
      setVersionName(generatedName);
    } catch (error) {
      console.error('Chyba při generování názvu verze:', error);
      const generatedName = `${dateString}_${sheetName}_V1`;
      setVersionName(generatedName);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFile(file);
    if (file) {
      const fileNameWithoutExtension = file.name.replace(/\.xlsx$/, '');
      setSupplier(fileNameWithoutExtension);
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const arrayBuffer = ev.target.result;
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheetNames = workbook.SheetNames;
          if (sheetNames.length > 0) {
            const defaultSheet = sheetNames[0];
            setSheets(sheetNames);
            setSelectedSheet(defaultSheet);
            if (onSheetSelect) {
              onSheetSelect(defaultSheet);
            }
            generateVersionName(defaultSheet);
          }
        } catch (error) {
          console.error('Error parsing the file:', error);
        }
      };
      reader.onerror = (error) => {
        console.error('Error reading the file:', error);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  useEffect(() => {
    if (selectedSheet) {
      fetchCatalogDetails(selectedSheet);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSheet]);

  const fetchCatalogDetails = async (sheetName) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/get-details-from-sheet?sheetName=${sheetName}`
      );
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setManufacturer(data.manufacturer);
      setCategory(data.category);
      setType(data.type);
    } catch (error) {
      console.error('Error fetching catalog details: ', error);
    }
  };

  const handleSubmit = () => {
    if (file && selectedSheet) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheet = workbook.Sheets[selectedSheet];
          let data = XLSX.utils.sheet_to_json(sheet, { defval: null });

          // 1) Vyčištění dat – jen relevantní klíče
          const cleanedData = data.map((row) => {
            const cleanedRow = {};
            relevantKeys.forEach((key) => {
              if (row[key] !== undefined && row[key] !== null) {
                cleanedRow[key] = row[key];
              }
            });

            // 2) Rozdělení hodnoty ze sloupce "Index" na "Index nosnosti" a "Index rychlosti"
            if (
              cleanedRow['Index'] &&
              typeof cleanedRow['Index'] === 'string'
            ) {
              // Např. "124/122M" -> "124/122" / "M"
              const indexString = cleanedRow['Index'].trim();
              const match = indexString.match(/^(.+?)([A-Za-z])$/);
              if (match) {
                const [, loadPart, speedPart] = match;
                cleanedRow['Index nosnosti'] = loadPart.trim();
                cleanedRow['Index rychlosti'] = speedPart.trim();
              }
              // Původní sloupec "Index" můžeme odstranit, aby se dále neukládal
              delete cleanedRow['Index'];
            }

            return cleanedRow;
          });

          // 3) Odstranění prázdných řádků podle relevantních klíčů
          const filteredData = cleanedData.filter((row) =>
            relevantKeys.some((key) => {
              const value = row[key];
              return value !== null && value !== undefined && value.toString().trim() !== '';
            })
          );

          // 4) Vytvoření nového workbooku s vyčištěnými daty
          const newWorkbook = XLSX.utils.book_new();
          const newSheetData = XLSX.utils.json_to_sheet(filteredData);
          XLSX.utils.book_append_sheet(newWorkbook, newSheetData, selectedSheet);

          // 5) Uložení výsledku do souboru (přes Blob)
          const wbout = XLSX.write(newWorkbook, { bookType: 'xlsx', type: 'array' });
          const blob = new Blob([wbout], { type: 'application/octet-stream' });
          const formData = new FormData();
          formData.append('file', blob, 'cleaned_data.xlsx');
          formData.append('versionName', versionName);
          formData.append('selectedSheet', selectedSheet);
          formData.append('supplier', supplier);
          formData.append('manufacturer', manufacturer);
          formData.append('category', category);
          formData.append('productLineId', productLineId);
          formData.append('type', type);

          onSubmit(formData);
          handleClose();
          resetForm();
        } catch (error) {
          console.error('Error creating cleaned XLSX file:', error);
        }
      };
      reader.onerror = (error) => {
        console.error('Error reading the file:', error);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleLoadSavedCatalog = () => {
    setShowSearchSelectModal(true);
  };

  const handleSelectSavedCatalog = async (template) => {
    try {
      // Načtení dříve uloženého ceníku (např. z DB).
      await handleSelectPLORTemplate(template);
      setShowSearchSelectModal(false);
      handleClose();
      resetForm();
    } catch (error) {
      console.error('Chyba při načítání produktů:', error);
      alert('Chyba při načítání produktů.');
    }
  };

  return (
    <Box sx={modalStyle}>
      <Typography variant="h6">Import Data</Typography>
      <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Button variant="contained" component="label">
          Nahrát soubor
          <input type="file" hidden onChange={handleFileChange} accept=".xlsx, .xls" />
        </Button>
        <Button variant="outlined" onClick={handleLoadSavedCatalog}>
          Nahrát uložený ceník
        </Button>
      </Box>

      {sheets.length > 0 && (
        <FormControl fullWidth margin="normal">
          <InputLabel>Select Sheet</InputLabel>
          <Select
            value={selectedSheet}
            onChange={(e) => {
              const selected = e.target.value;
              setSelectedSheet(selected);
              onSheetSelect(selected);
              generateVersionName(selected);
            }}
          >
            {sheets.map((sheet) => (
              <MenuItem key={sheet} value={sheet}>
                {sheet}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {versionName && (
        <FormControl fullWidth margin="normal">
          <TextField
            label="Version Name"
            value={versionName}
            variant="outlined"
            InputProps={{ readOnly: true }}
          />
        </FormControl>
      )}

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          onClick={() => {
            handleClose();
            resetForm();
          }}
        >
          Close
        </Button>
        {file && (
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit}
          >
            Submit
          </Button>
        )}
      </Box>

      {/* Modal pro výběr uloženého ceníku (SearchSelectModal) */}
      <SearchSelectModal
        show={showSearchSelectModal}
        handleClose={() => setShowSearchSelectModal(false)}
        fetchItems={fetchPLORTemplates}
        onSelect={handleSelectSavedCatalog}
      />
    </Box>
  );
};

export default ExportImportModal;
