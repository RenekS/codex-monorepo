import React, { useState, useEffect } from 'react';
import { Box, Button, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography } from '@mui/material';
import axios from 'axios';

const CatalogManagement = () => {
  const [catalogs, setCatalogs] = useState([]);
  const [newCatalog, setNewCatalog] = useState({ name: '', description: '', database_name: '' });

  // Získání seznamu číselníků
  useEffect(() => {
    const fetchCatalogs = async () => {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/catalogs`);
      setCatalogs(response.data);
    };
    fetchCatalogs();
  }, []);

  // Přidání nového číselníku
  const handleAddCatalog = async () => {
    if (!newCatalog.name || !newCatalog.description || !newCatalog.database_name) {
      alert('Vyplňte název, popis a název databáze');
      return;
    }

    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/catalogs`, newCatalog);
      setNewCatalog({ name: '', description: '', database_name: '' }); // Reset formuláře
      // Obnovit seznam číselníků
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/catalogs`);
      setCatalogs(response.data);
    } catch (err) {
      console.error('Chyba při přidávání číselníku', err);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Správa číselníků
      </Typography>

      {/* Formulář pro přidání nového číselníku */}
      <Box mb={3}>
        <Typography variant="h6">Přidat nový číselník</Typography>
        <TextField
          label="Název číselníku"
          value={newCatalog.name}
          onChange={(e) => setNewCatalog({ ...newCatalog, name: e.target.value })}
          fullWidth
          margin="normal"
        />
        <TextField
          label="Popis číselníku"
          value={newCatalog.description}
          onChange={(e) => setNewCatalog({ ...newCatalog, description: e.target.value })}
          fullWidth
          margin="normal"
        />
        <TextField
          label="Název databáze"
          value={newCatalog.database_name}
          onChange={(e) => setNewCatalog({ ...newCatalog, database_name: e.target.value })}
          fullWidth
          margin="normal"
        />
        <Button variant="contained" color="primary" onClick={handleAddCatalog}>
          Přidat číselník
        </Button>
      </Box>

      {/* Tabulka číselníků */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Název</TableCell>
              <TableCell>Popis</TableCell>
              <TableCell>Struktura</TableCell>
              <TableCell>Databáze</TableCell>
              <TableCell>Akce</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {catalogs.length > 0 ? (
              catalogs.map((catalog) => (
                <TableRow key={catalog.id}>
                  <TableCell>{catalog.name}</TableCell>
                  <TableCell>{catalog.description}</TableCell>
                  <TableCell>{Array.isArray(catalog.columns) ? catalog.columns.join(', ') : catalog.columns || 'N/A'}</TableCell>
                  <TableCell>{catalog.database_name}</TableCell> {/* Zobrazení databáze */}
                  <TableCell>
                    <Button variant="outlined" color="primary" href={`/catalogs/${catalog.id}/edit`}>
                      Upravit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5}>Žádné číselníky nebyly nalezeny</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default CatalogManagement;
