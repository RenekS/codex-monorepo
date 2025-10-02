// VehicleInfo.js
import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';
import axios from 'axios';

const VehicleInfo = ({ RZ }) => {
  const [vehicleData, setVehicleData] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [parkingData, setParkingData] = useState(null);

  useEffect(() => {
    const fetchVehicleInfo = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/vehicle_info/${RZ}`);
        const { vehicle, company, parking } = response.data;
        setVehicleData(vehicle);
        setCustomerData(company);
        setParkingData(parking);
      } catch (error) {
        console.error('Error fetching vehicle data:', error);
      }
    };

    if (RZ) {
      fetchVehicleInfo();
    }
  }, [RZ]);

  return (
    <Box mt={2} sx={{ padding: '0 16px' }}>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6">Zákazník</Typography>
          <Typography>Jméno: {customerData?.companyName || 'N/A'}</Typography>
          <Typography>Adresa: {customerData?.companyAddress || 'N/A'}</Typography>
          <Typography>Kontakt: {parkingData?.contactPerson || 'N/A'} ({parkingData?.contactPhone || 'N/A'})</Typography>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6">Informace o vozidle</Typography>
          <Typography>RZ: {vehicleData?.RZ || 'N/A'}</Typography>
          <Typography>Model: {vehicleData?.Model_vozidla || 'N/A'}</Typography>
          <Typography>Výrobce: {vehicleData?.Znacka_vozidla || 'N/A'}</Typography>
          <Typography>Rok: {vehicleData?.Datum_prodeje || 'N/A'}</Typography>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6">Parkování</Typography>
          <Typography>Lokace: {parkingData?.parkingLocation || 'N/A'}</Typography>
          <Typography>Pozice: {parkingData?.parkingPosition || 'N/A'}</Typography>
          <Typography>Adresa: {parkingData?.parkingAddress || 'N/A'}</Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default VehicleInfo;