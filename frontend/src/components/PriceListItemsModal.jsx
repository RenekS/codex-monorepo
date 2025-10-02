import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import axios from 'axios';

const PriceListItemsModal = ({ open, onClose, priceListId }) => {
  const [priceListData, setPriceListData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRows, setSelectedRows] = useState([]);

  useEffect(() => {
    if (open && priceListId) {
      setLoading(true);
      axios
        .get(`${process.env.REACT_APP_API_URL}/price-list-items`, {
          params: { filterId: priceListId }
        })
        .then((response) => {
          setPriceListData(response.data);
          setSelectedRows(response.data.map((_, idx) => idx));
          setLoading(false);
        })
        .catch((err) => {
          console.error('Chyba při načítání položek ceníku:', err);
          setError('Chyba při načítání položek ceníku.');
          setLoading(false);
        });
    }
  }, [open, priceListId]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRows(priceListData.map((_, idx) => idx));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (index) => {
    setSelectedRows((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleUpsert = () => {
    const selectedData = selectedRows.map((idx) => priceListData[idx]);
    axios.post(`${process.env.REACT_APP_API_URL}/upsert-to-products`, { data: selectedData })
      .then(() => {
        alert('Data byla úspěšně importována do hlavní tabulky.');
        onClose();
      })
      .catch((err) => {
        console.error('Chyba při upsertu:', err);
        setError('Chyba při importu položek do hlavní tabulky.');
      });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
      <DialogTitle>
        Položky ceníku – {priceListId ? `Ceník ${priceListId}` : 'Neznámý ceník'}
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <CircularProgress />
        ) : error ? (
          <Typography variant="body1" color="error">
            {error}
          </Typography>
        ) : priceListData.length > 0 ? (
          <TableContainer component={Paper}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={selectedRows.length === priceListData.length}
                  onChange={handleSelectAll}
                  indeterminate={selectedRows.length > 0 && selectedRows.length < priceListData.length}
                />
              }
              label="Vybrat vše"
            />
            <Table aria-label="Price List Items">
              <TableHead>
                <TableRow>
                  <TableCell></TableCell>
                  <TableCell><strong>C_Polozky</strong></TableCell>
                  <TableCell><strong>EAN</strong></TableCell>
                  <TableCell><strong>Název</strong></TableCell>
                  <TableCell><strong>Cena</strong></TableCell>
                  <TableCell><strong>Výrobce</strong></TableCell>
                  <TableCell><strong>Náprava</strong></TableCell>
                  <TableCell><strong>Provoz</strong></TableCell>
                  <TableCell><strong>Trida_vyrobce</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {priceListData.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Checkbox
                        checked={selectedRows.includes(index)}
                        onChange={() => handleSelectRow(index)}
                      />
                    </TableCell>
                    <TableCell>{item.C_Polozky}</TableCell>
                    <TableCell>{item.EAN}</TableCell>
                    <TableCell>{item.Nazev}</TableCell>
                    <TableCell>{item.Cena}</TableCell>
                    <TableCell>{item.Vyrobce}</TableCell>
                    <TableCell>{item.Naprava}</TableCell>
                    <TableCell>{item.Provoz}</TableCell>
                    <TableCell>{item.Trida_vyrobce}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="body1">Žádné položky k zobrazení.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined" color="secondary">Zavřít</Button>
        <Button onClick={handleUpsert} variant="contained" color="primary">Upsert do hlavní tabulky</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PriceListItemsModal;
