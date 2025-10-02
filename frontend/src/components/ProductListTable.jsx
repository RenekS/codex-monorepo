import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Typography
} from '@mui/material';

const ProductListTable = ({ products, onShowPriceList }) => {
  if (!products || products.length === 0) {
    return <Typography variant="body1">Žádné produkty k zobrazení.</Typography>;
  }

  return (
    <TableContainer component={Paper}>
      <Table aria-label="product list">
        <TableHead>
          <TableRow>
            <TableCell align="center"><strong>ID</strong></TableCell>
            <TableCell align="left"><strong>Název produktu</strong></TableCell>
            <TableCell align="center"><strong>Ceník (filterId)</strong></TableCell>
            <TableCell align="center"><strong>Akce</strong></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell align="center">{product.id}</TableCell>
              <TableCell align="left">{product.name}</TableCell>
              <TableCell align="center">{product.priceListId}</TableCell>
              <TableCell align="center">
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => onShowPriceList(product.priceListId)}
                >
                  Zobraz ceník
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ProductListTable;
