// src/components/AutoFillPanel.js

import React, { useState } from 'react';
import { Box, Button, FormGroup, FormControlLabel, Checkbox, Typography } from '@mui/material';

/**
 * Seznam dostupných sloupců, které může uživatel zvolit pro
 * automatické doplnění. Každý objekt obsahuje:
 *   - key: musí odpovídat klíči v objektu row v CatalogImport.js
 *   - label: popisek pro checkbox
 */
const availableColumns = [
  { key: 'Naprava', label: 'Náprava' },
  { key: 'Provoz', label: 'Provoz' },
  { key: 'M_S', label: 'M+S' },
  { key: 'TPM_S', label: '3PMSF' },
  { key: 'Index nosnosti', label: 'Index nosnosti' },
  { key: 'Index rychlosti', label: 'Index rychlosti' },
  { key: 'Štítek', label: 'Štítek' },
  { key: 'PR', label: 'PR' },
  { key: 'Valivy_odpor', label: 'Valivý odpor' },
  { key: 'Prilnavost', label: 'Přilnavost' },
  { key: 'Hluk_db', label: 'Hluk (db)' },
  { key: 'TT_TL', label: 'TT/TL' },
  { key: 'Hmotnost', label: 'Hmotnost' },
  { key: 'Hloubka_dezenu', label: 'Hloubka dezénu' },
  { key: 'Zesileni', label: 'Zesílení' }
];

const AutoFillPanel = ({ onAutoFill }) => {
  const [selectedColumns, setSelectedColumns] = useState([]);

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    if (checked) {
      setSelectedColumns(prev => [...prev, name]);
    } else {
      setSelectedColumns(prev => prev.filter(key => key !== name));
    }
  };

  const handleAutoFillClick = () => {
    // Zavoláme callback s vybranými sloupci
    onAutoFill(selectedColumns);
  };

  return (
    <Box sx={{ p: 2, border: '1px solid #ccc', mb: 2, display: 'inline-block', verticalAlign: 'top' }}>
      <Typography variant="h6">Vyberte sloupce pro automatické doplnění</Typography>
      <FormGroup row>
        {availableColumns.map(col => (
          <FormControlLabel
            key={col.key}
            control={
              <Checkbox
                name={col.key}
                onChange={handleCheckboxChange}
                checked={selectedColumns.includes(col.key)}
              />
            }
            label={col.label}
          />
        ))}
      </FormGroup>
      <Button
        variant="contained"
        onClick={handleAutoFillClick}
        sx={{ mt: 2 }}
      >
        Automaticky doplnit hodnoty
      </Button>
    </Box>
  );
};

export default AutoFillPanel;
