import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Select, MenuItem, InputLabel, FormControl, Button, TextField, Grid, Card } from '@mui/material';

const statusLabels = {
  "Opened": "Nevyřízeno",
  "OnHold": "Vyřídit",
  "Processing": "Vyřizuje se",
  "Shipped": "Expedováno",
  "CompletedDelivery": "Dodáno",
  "CompletedDeliveryAndSettledInvoice": "Dodáno+fa",
  // Další statusy...
};
const paymentLabels = {
  "CreditCard": "Kreditní kartou",
  "CashOnDelivery": "Dobírkou",
  "BankTransfer": "Převodem"
  // Další platby...
};

// Mapovací objekt pro Doprava
const deliveryLabels = {
  "Zásilkovna Z point": "Zásilkovna Z point",
  "GLS doručení na adresu": "GLS doručení na adresu",
  "GLS doručení do výdejního místa": "GLS doručení do výdejního místa"
  // Další dopravní služby...
};
function SE_OrderList() {
  const [orders, setOrders] = useState([]);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState([]);
  const [payment, setPayment] = useState([]);
  const [delivery, setDelivery] = useState([]);
  useEffect(() => {
    const today = new Date();
    const twoMonthsAgo = new Date(today.setMonth(today.getMonth() - 2));
  
    setDateFrom(twoMonthsAgo.toISOString().split('T')[0]);
    setDateTo(new Date().toISOString().split('T')[0]);
  }, []);
  useEffect(() => {
    fetchOrders();
  }, [searchParams]);

useEffect(() => {
  const handleBarcodeInput = async (event) => {
    if (event.key === 'Enter') {
      if (event.target && event.target.value) {
        const orderNumber = event.target.value.trim();

        try {
          const response = await axios.get(`${process.env.REACT_APP_API_URL}/efverify_order_number/${orderNumber}`);
          if (response.data.exists) {
            navigate(`/eforder/${orderNumber}`);
          } else {
            console.log('Objednávka nenalezena');
          }
        } catch (error) {
          console.error('Chyba při ověřování objednávky:', error);
        }
      }
    }
  };

  window.addEventListener('keypress', handleBarcodeInput);

  return () => {
    window.removeEventListener('keypress', handleBarcodeInput);
  };
}, [navigate]);



const fetchOrders = async () => {
  const params = new URLSearchParams();

  // Přidání data
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  if (searchQuery) params.append('searchQuery', searchQuery);

  // Pro každý status, payment a delivery přidáme samostatné položky do URLSearchParams
  status.forEach(s => params.append('status', s));
  payment.forEach(p => params.append('payment', p));
  delivery.forEach(d => params.append('delivery', d));

  try {
    const response = await axios.get(`${process.env.REACT_APP_API_URL}/eforders_list?${params.toString()}`);
    const sortedData = response.data.sort((a, b) => b.Order_Number - a.Order_Number);
    setOrders(sortedData);
  } catch (error) {
    console.error('Error fetching orders from database:', error);
  }
};


  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery) {
      searchOrder(searchQuery);
    } else {
      setSearchParams({ dateFrom, dateTo });
      fetchOrders();
    }
  };

  const searchOrder = async (orderNumber) => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/eforder/${orderNumber}`);
      navigate(`/SE_OrderDetail/${orderNumber}`);
    } catch (error) {
      console.error('Error searching for order:', error);
    }
  };

  const updateDatabase = async () => {
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/efupdate_orders_list`);
      console.log('Database updated successfully');
      fetchOrders(); // Volání funkce pro obnovení seznamu objednávek
    } catch (error) {
      console.error('Error updating database:', error);
  }
};

 

  const handleOrderClick = (orderNumber) => {
    navigate(`/eforder/${orderNumber}`);
  };

  const togglePicking = async (order) => {
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/efupdate_picking`, {
        Order_Number: order.Order_Number,
        Picking: order.Picking ? 0 : 1
      });
      fetchOrders();
    } catch (error) {
      console.error('Error updating picking status:', error);
    }
  };

const handleProcessPickingOrders = async () => {
  try {
    const response = await axios.get(`${process.env.REACT_APP_API_URL}/efprocess_picking_orders`);
    console.log('Picking orders processed:', response.data);
    navigate('/eforders-picking'); // Přidání této řádky pro navigaci
  } catch (error) {
    console.error('Error processing picking orders:', error);
  }
};



  return (
    <div>
    <form onSubmit={handleSearch}>
      <Card variant="outlined" style={{ padding: '20px', margin: '20px 0' }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Datum od"
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Datum do"
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Vyhledat objednávku"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </Grid>
          {/* Příklad pro Select s mapováním */}
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                multiple
                value={status}
                onChange={e => setStatus(e.target.value)}
                renderValue={(selected) => selected.map(val => statusLabels[val]).join(', ')}
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Platba</InputLabel>
              <Select
                multiple
                value={payment}
                onChange={e => setPayment(e.target.value)}
                renderValue={(selected) => selected.map(val => paymentLabels[val] || val).join(', ')}
              >
                {Object.entries(paymentLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Doprava</InputLabel>
              <Select
                multiple
                value={delivery}
                onChange={e => setDelivery(e.target.value)}
                renderValue={(selected) => selected.map(val => deliveryLabels[val] || val).join(', ')}
              >
                {Object.entries(deliveryLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
        </Grid>
        <Grid container spacing={2} justifyContent="flex-end" style={{ marginTop: '10px' }}>
          <Grid item>
            <Button type="submit" variant="contained" color="primary">Vyhledat</Button>
          </Grid>
          <Grid item>
            <Button onClick={updateDatabase} variant="contained" color="primary">Aktualizovat Databázi</Button>
          </Grid>
          <Grid item>
            <Button onClick={handleProcessPickingOrders} variant="contained" color="primary">Zpracovat Pickování</Button>
          </Grid>
        </Grid>
      </Card>
    </form>
      <table>
        <thead>
          <tr>
            <th>Pickovat</th>
            <th>Číslo objednávky</th>
            <th>Doprava</th>
            <th>Platba</th>
            <th>Stav</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.DocumentID}>
              <td>
                <input
                  type="checkbox"
                  checked={order.Picking}
                  onChange={() => togglePicking(order)}
                />
              </td>
              <td style={{ cursor: 'pointer' }} onClick={() => handleOrderClick(order.Order_Number)}>
                {order.Order_Number}
              </td>
              <td>{order.Delivery}</td>
              <td>{paymentLabels[order.Payment] || order.Payment}</td>
              <td>{statusLabels[order.Status] || order.Status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default SE_OrderList;