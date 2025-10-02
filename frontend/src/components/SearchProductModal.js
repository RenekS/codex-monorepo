// SearchProductModal.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Modal,
  TextField,
  Button,
  IconButton,
  Tooltip,
  Typography,
  Grid,
  CircularProgress,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { TableSortLabel } from '@mui/material';

function SearchProductModal({ isOpen, onClose, onSelectItems, productGroup }) {
  const [availableData, setAvailableData] = useState([]);
  const [selectedData, setSelectedData] = useState([]);
  const [filterValues, setFilterValues] = useState({
    ItemId: '',
    ItsItemName3: '',
    PurchLineDisc: productGroup || '',
    ItemName: '',
  });
  const [loading, setLoading] = useState(false); // Stav pro načítání dat

  useEffect(() => {
    if (isOpen) {
      fetchDataFromBackend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    setFilterValues(prev => ({ ...prev, PurchLineDisc: productGroup || '' }));
  }, [productGroup]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilterValues(prev => ({ ...prev, [name]: value }));
  };

  // Funkce pro načtení dat z backendu pomocí /items endpointu s aktuálními filtry
  const fetchDataFromBackend = async () => {
    try {
      setLoading(true);
      // Filtrujeme pouze ne-prázdné hodnoty
      const params = Object.fromEntries(
        Object.entries({
          ItemId: filterValues.ItemId,
          ItsItemName3: filterValues.ItsItemName3,
          PurchLineDisc: filterValues.PurchLineDisc,
          ItemName: filterValues.ItemName,
        }).filter(([_, v]) => v) // Přidáme pouze klíče s hodnotou
      );
      const queryString = new URLSearchParams(params).toString();
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/items?${queryString}`);
      setAvailableData(response.data);
    } catch (error) {
      console.error('Error loading data from backend:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrace dostupných dat na základě aktuálních filtrů
  const filteredAvailableData = availableData.filter(item => {
    return Object.keys(filterValues).every(key => {
      const value = filterValues[key];
      if (!value) return true;
      return item[key]?.toString().toLowerCase().includes(value.toLowerCase());
    });
  });

  // Funkce pro přidání položky do vybraných dat
  const handleAddItem = (item) => {
    // Zkontrolovat, zda položka již není vybrána
    if (!selectedData.find(selected => selected.ItemId === item.ItemId)) {
      setSelectedData(prev => [...prev, item]);
    }
  };

  // Funkce pro odstranění položky z vybraných dat
  const handleRemoveItem = (ItemId) => {
    setSelectedData(prev => prev.filter(item => item.ItemId !== ItemId));
  };

  // Funkce pro přidání všech vybraných položek z dostupných dat
  const handleAddAll = () => {
    const newItems = filteredAvailableData.filter(item =>
      !selectedData.find(selected => selected.ItemId === item.ItemId)
    );
    setSelectedData(prev => [...prev, ...newItems]);
  };

  // Funkce pro odstranění všech vybraných položek
  const handleRemoveAll = () => {
    setSelectedData([]);
  };

  // Funkce pro potvrzení výběru a odeslání dat do Netto.js
  const handleConfirmSelection = () => {
    onSelectItems(selectedData);
    setSelectedData([]);
    onClose();
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%', // Zachováme ideální šířku
        height: '90%', // Přizpůsobíme výšku modalu
        bgcolor: 'background.paper',
        boxShadow: 24,
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden', // Zabraňte přetékání obsahu
      }}>
        <Typography variant="h6" gutterBottom color="textPrimary">
          Vyhledávání produktu
        </Typography>
        <Box mb={2} display="flex" flexWrap="wrap" gap={2} alignItems="center">
          <TextField
            label="Položka"
            variant="outlined"
            size="small"
            name="ItemId"
            value={filterValues.ItemId}
            onChange={handleFilterChange}
            style={{ minWidth: 150 }}
            InputLabelProps={{ style: { color: 'black' } }} // Změna barvy popisků na černou
          />
          <TextField
            label="Výrobce"
            variant="outlined"
            size="small"
            name="ItsItemName3"
            value={filterValues.ItsItemName3}
            onChange={handleFilterChange}
            style={{ minWidth: 150 }}
            InputLabelProps={{ style: { color: 'black' } }}
          />
          <TextField
            label="Sk. řád. ceny"
            variant="outlined"
            size="small"
            name="PurchLineDisc"
            value={filterValues.PurchLineDisc}
            onChange={handleFilterChange}
            style={{ minWidth: 150 }}
            InputLabelProps={{ style: { color: 'black' } }}
          />
          <TextField
            label="Název"
            variant="outlined"
            size="small"
            name="ItemName"
            value={filterValues.ItemName}
            onChange={handleFilterChange}
            style={{ minWidth: 200 }}
            InputLabelProps={{ style: { color: 'black' } }}
          />
          {/* Přidání ikony pro načtení dat z backendu */}
          <Tooltip title="Načíst z databáze">
            <IconButton color="primary" onClick={fetchDataFromBackend} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Grid container spacing={2} sx={{ flexGrow: 1, overflow: 'hidden' }}>
          {/* První tabulka - Dostupné položky */}
          <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom color="textPrimary">
              Dostupné položky
            </Typography>
            <Paper sx={{ flexGrow: 1, overflow: 'hidden' }}>
              <TableContainer sx={{ maxHeight: 'calc(100% - 50px)' }}>
                <Table stickyHeader aria-label="available items table" size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Položka</TableCell>
                      <TableCell>Výrobce</TableCell>
                      <TableCell>Sk. řád. ceny</TableCell>
                      <TableCell>Název</TableCell>
                      <TableCell align="center">Akce</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredAvailableData.map((item) => (
                      <TableRow key={item.ItemId} hover>
                        <TableCell>{item.ItemId}</TableCell>
                        <TableCell>{item.ItsItemName3}</TableCell>
                        <TableCell>{item.PurchLineDisc}</TableCell>
                        <TableCell>{item.ItemName}</TableCell>
                        <TableCell align="center">
                          <Tooltip title="Přidat">
                            <IconButton
                              color="primary"
                              onClick={() => handleAddItem(item)}
                              disabled={selectedData.find(selected => selected.ItemId === item.ItemId)}
                              size="small"
                            >
                              <AddIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredAvailableData.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          Žádné položky nenalezeny.
                        </TableCell>
                      </TableRow>
                    )}
                    {loading && (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <CircularProgress size={24} />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {/* Tlačítka pro přidání všech položek */}
              <Box mt={1} display="flex" justifyContent="flex-end" gap={1}>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={handleAddAll}
                  disabled={filteredAvailableData.length === 0}
                  startIcon={<AddIcon />}
                  size="small"
                >
                  Přidat vše
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Druhá tabulka - Vybrané položky */}
          <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom color="textPrimary">
              Vybrané položky
            </Typography>
            <Paper sx={{ flexGrow: 1, overflow: 'hidden' }}>
              <TableContainer sx={{ maxHeight: 'calc(100% - 50px)' }}>
                <Table stickyHeader aria-label="selected items table" size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Položka</TableCell>
                      <TableCell>Výrobce</TableCell>
                      <TableCell>Sk. řád. ceny</TableCell>
                      <TableCell>Název</TableCell>
                      <TableCell align="center">Akce</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedData.map((item) => (
                      <TableRow key={item.ItemId} hover>
                        <TableCell>{item.ItemId}</TableCell>
                        <TableCell>{item.ItsItemName3}</TableCell>
                        <TableCell>{item.PurchLineDisc}</TableCell>
                        <TableCell>{item.ItemName}</TableCell>
                        <TableCell align="center">
                          <Tooltip title="Odstranit">
                            <IconButton
                              color="secondary"
                              onClick={() => handleRemoveItem(item.ItemId)}
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                    {selectedData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          Žádné vybrané položky.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {/* Tlačítka pro odstranění všech položek */}
              <Box mt={1} display="flex" justifyContent="flex-end" gap={1}>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleRemoveAll}
                  disabled={selectedData.length === 0}
                  startIcon={<DeleteIcon />}
                  size="small"
                >
                  Odstranit vše
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Tlačítka pro potvrzení nebo zrušení výběru */}
        <Box mt={2} display="flex" justifyContent="flex-end" gap={2}>
          <Button variant="outlined" onClick={onClose} size="small">Zavřít</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConfirmSelection}
            disabled={selectedData.length === 0}
            size="small"
          >
            Přidat vybrané
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

export default SearchProductModal;
