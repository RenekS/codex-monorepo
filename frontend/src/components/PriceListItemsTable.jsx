import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography
} from '@mui/material';

const PriceListItemsTable = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <Typography variant="body1" align="center" sx={{ mt: 2 }}>
        Žádná data k zobrazení.
      </Typography>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table aria-label="Price List Items Table">
        <TableHead>
          <TableRow>
            <TableCell align="center"><strong>EAN</strong></TableCell>
            <TableCell align="left"><strong>Název</strong></TableCell>
            <TableCell align="center"><strong>Cena</strong></TableCell>
            <TableCell align="center"><strong>Akční Cena</strong></TableCell>
            <TableCell align="center"><strong>Vyrobce</strong></TableCell>
            <TableCell align="center"><strong>Sířka</strong></TableCell>
            <TableCell align="center"><strong>Profil</strong></TableCell>
            {/* Přidej další sloupce podle potřeby */}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell align="center">{item.EAN}</TableCell>
              <TableCell align="left">{item.Nazev}</TableCell>
              <TableCell align="center">{item.Cena}</TableCell>
              <TableCell align="center">{item.AkcniCena ?? '-'}</TableCell>
              <TableCell align="center">{item.Vyrobce}</TableCell>
              <TableCell align="center">{item.Sirka}</TableCell>
              <TableCell align="center">{item.Profil}</TableCell>
              {/* Přidej další buňky dle potřeby */}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default PriceListItemsTable;
