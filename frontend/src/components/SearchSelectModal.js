import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

const SearchSelectModal = ({ show, handleClose, fetchItems, onSelect }) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (show) {
      fetchItems()
        .then(fetchedItems => {
          if (Array.isArray(fetchedItems)) {
            setItems(fetchedItems);
          } else {
            console.warn('fetchItems did not return an array:', fetchedItems);
            setItems([]);
          }
        })
        .catch(error => {
          console.error("Error fetching items:", error);
          setItems([]);
        });
    }
  }, [show, fetchItems]);

  return (
    <Dialog open={show} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>Vyhledávání a výběr</DialogTitle>
      <DialogContent>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Název Filtru</TableCell>
                <TableCell>Vytvořeno</TableCell>
                <TableCell>Vytvořil</TableCell>
                <TableCell>Template URL</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length > 0 ? (
                items.map((item) => (
                  <TableRow key={item.filterId} onClick={() => onSelect(item)} hover>
                    <TableCell>{item.filterName}</TableCell>
                    <TableCell>{new Date(item.createdAt).toLocaleDateString("cs-CZ")}</TableCell>
                    <TableCell>{item.userId}</TableCell>
                    <TableCell>
                      {item.filterURL ? (
                        <a href={item.filterURL} target="_blank" rel="noopener noreferrer">View Template</a>
                      ) : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4}>Žádná data k dispozici</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="secondary">Zavřít</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SearchSelectModal;
