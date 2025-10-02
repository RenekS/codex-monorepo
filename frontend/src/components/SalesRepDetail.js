// SalesRepDetail.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography
} from '@mui/material';

// Pomocná funkce pro formátování čísel
const formatNumber = (val) => {
  if (typeof val !== 'number') return val || '';
  return Math.round(val).toLocaleString('cs-CZ');
};

const SalesRepDetail = ({ detail, onBack }) => {
  // detail obsahuje:
  //   type: 'center' nebo 'rep'
  //   data: objekt střediska nebo obchodníka
  //   (u typu "rep" navíc center: kód střediska)
  const { type, data, center } = detail;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailData, setDetailData] = useState([]);

  useEffect(() => {
    const currentYear = new Date().getFullYear();
    // Vybereme groupBy podle typu detailu:
    // pokud jde o středisko, použijeme "center", pokud o repa, použijeme "salesrep"
    const groupBy = type === 'center' ? 'center' : 'salesrep';

    axios
      .get(`${process.env.REACT_APP_API_URL}/an/sales-details/by-year`, {
        params: { year: currentYear, groupBy }
      })
      .then((response) => {
        const allData = response.data || [];
        let filteredData = [];
        if (type === 'center') {
          // Předpokládáme, že když se seskupuje podle center,
          // endpoint vrací sloupec "Center"
          filteredData = allData.filter(
            (row) => row.Center === data.stredisko
          );
        } else if (type === 'rep') {
          // Předpokládáme, že když se seskupuje podle obchodního zástupce,
          // endpoint vrací sloupec "SalesRep"
          filteredData = allData.filter(
            (row) => row.SalesRep === data.jmeno
          );
        }
        setDetailData(filteredData);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError('Chyba při načítání detailních dat.');
        setLoading(false);
      });
  }, [detail]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Typography color="error" variant="h6" align="center" sx={{ mt: 3 }}>
        {error}
      </Typography>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Button variant="contained" onClick={onBack} sx={{ mb: 2 }}>
        Zpět
      </Button>
      <Typography variant="h5" sx={{ mb: 2 }}>
        {type === 'center'
          ? `Detail střediska: ${data.stredisko}`
          : `Detail obchodníka: ${data.jmeno}`}{" "}
        (rok: {new Date().getFullYear()})
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {type === 'center' ? (
                <>
                  <TableCell>Středisko</TableCell>
                  <TableCell>Rok</TableCell>
                  <TableCell>Celkové objednávky (kusy)</TableCell>
                  <TableCell>Celkové tržby</TableCell>
                  <TableCell>PNEUMATIKY – prodáno (kusy)</TableCell>
                  <TableCell>PNEUMATIKY – tržby</TableCell>
                  <TableCell>PROTEKTORY – prodáno (kusy)</TableCell>
                  <TableCell>PROTEKTORY – tržby</TableCell>
                </>
              ) : (
                <>
                  <TableCell>Obchodní zástupce</TableCell>
                  <TableCell>Rok</TableCell>
                  <TableCell>Celkové objednávky (kusy)</TableCell>
                  <TableCell>Celkové tržby</TableCell>
                  <TableCell>PNEUMATIKY – prodáno (kusy)</TableCell>
                  <TableCell>PNEUMATIKY – tržby</TableCell>
                  <TableCell>PROTEKTORY – prodáno (kusy)</TableCell>
                  <TableCell>PROTEKTORY – tržby</TableCell>
                </>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {detailData.map((row, index) => (
              <TableRow key={index}>
                {type === 'center' ? (
                  <>
                    <TableCell>{row.Center}</TableCell>
                    <TableCell>{row.SalesYear}</TableCell>
                    <TableCell>{row.TotalOrders}</TableCell>
                    <TableCell>{formatNumber(row.TotalSales)}</TableCell>
                    <TableCell>{row.TotalQtyPneu}</TableCell>
                    <TableCell>{formatNumber(row.TotalSalesPneu)}</TableCell>
                    <TableCell>{row.TotalQtyProtektory}</TableCell>
                    <TableCell>{formatNumber(row.TotalSalesProtektory)}</TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>{row.SalesRep}</TableCell>
                    <TableCell>{row.SalesYear}</TableCell>
                    <TableCell>{row.TotalOrders}</TableCell>
                    <TableCell>{formatNumber(row.TotalSales)}</TableCell>
                    <TableCell>{row.TotalQtyPneu}</TableCell>
                    <TableCell>{formatNumber(row.TotalSalesPneu)}</TableCell>
                    <TableCell>{row.TotalQtyProtektory}</TableCell>
                    <TableCell>{formatNumber(row.TotalSalesProtektory)}</TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default SalesRepDetail;
