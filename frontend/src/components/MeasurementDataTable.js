// MeasurementDataTable.js
import React from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

const MeasurementDataTable = ({ data }) => {
  const { measurement, details } = data;

  return (
    <Box mt={2}>
      <Typography variant="h6">Poslední měření</Typography>
      <Typography variant="body1">Datum: {new Date(measurement.measurement_date).toLocaleString()}</Typography>
      <Typography variant="body1">Technik ID: {measurement.technician_id}</Typography>
      <Typography variant="body1">Stav tachometru: {measurement.odometer_reading} km</Typography>

      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Pozice</TableCell>
              <TableCell>Hloubka vnější drážky (mm)</TableCell>
              <TableCell>Hloubka střední drážky (mm)</TableCell>
              <TableCell>Hloubka vnitřní drážky (mm)</TableCell>
              <TableCell>Pneumatika otočena</TableCell>
              <TableCell>Naměřený tlak (bar)</TableCell>
              <TableCell>Tlak z TPMS senzoru (bar)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {details.map((detail) => (
              <TableRow key={detail.detail_id}>
                <TableCell>{detail.tyre_position}</TableCell>
                <TableCell>{detail.outer_tread_depth}</TableCell>
                <TableCell>{detail.center_tread_depth}</TableCell>
                <TableCell>{detail.inner_tread_depth}</TableCell>
                <TableCell>{detail.tyre_rotated ? 'Ano' : 'Ne'}</TableCell>
                <TableCell>{detail.measured_pressure}</TableCell>
                <TableCell>{detail.tpms_pressure}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default MeasurementDataTable;
