import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs'; // Přidání dayjs pro práci s daty

function OrderList() {
  const [orders, setOrders] = useState([]);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Nastavení dateFrom na jeden měsíc zpět a dateTo na dnešní datum
  const initialDateTo = dayjs().format('YYYY-MM-DD');
  const initialDateFrom = dayjs().subtract(1, 'month').format('YYYY-MM-DD');

  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || initialDateFrom);
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || initialDateTo);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Aktualizace searchParams při změně dateFrom nebo dateTo
    setSearchParams({ dateFrom, dateTo });
  }, [dateFrom, dateTo, setSearchParams]);

  useEffect(() => {
    fetchOrders();
  }, [searchParams]);

  useEffect(() => {
    const handleBarcodeInput = async (event) => {
      if (event.key === 'Enter') {
        if (event.target && event.target.value) {
          const orderNumber = event.target.value.trim();

          try {
            const response = await axios.get(`${process.env.REACT_APP_API_URL}/wms/verify_order_number/${orderNumber}`);
            if (response.data.exists) {
              navigate(`/order/${orderNumber}`);
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
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/wms/orders_list_tavinox`, {
        params: { dateFrom, dateTo }
      });
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders from database:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery) {
      searchOrder(searchQuery);
    } else {
      fetchOrders();
    }
  };

  const searchOrder = async (orderNumber) => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/wms/order/${orderNumber}`);
      navigate(`/order/${orderNumber}`);
    } catch (error) {
      console.error('Error searching for order:', error);
    }
  };

  const updateDatabase = async () => {
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/update_orders_list`);
      console.log('Database updated successfully');
      fetchOrders(); // Volání funkce pro obnovení seznamu objednávek
    } catch (error) {
      console.error('Error updating database:', error);
    }
  };

  const handleOrderPicking = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/update_picking_orders`);
      console.log('Update successful:', response.data);
    } catch (error) {
      console.error('Error updating picking orders:', error);
    }
  };

  const togglePicking = async (order) => {
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/update_picking`, {
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
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/process_picking_orders`);
      console.log('Picking orders processed:', response.data);
      navigate('/orders-picking'); // Přidání této řádky pro navigaci
    } catch (error) {
      console.error('Error processing picking orders:', error);
    }
  };

  const handleOrderClick = (orderNumber) => {
    navigate(`/order/${orderNumber}`);
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <div>
          <label htmlFor="dateFrom">Datum od:</label>
          <input 
            type="date" 
            id="dateFrom" 
            value={dateFrom} 
            onChange={e => setDateFrom(e.target.value)} 
            max={initialDateTo} // Zajištění, že dateFrom nemůže být po dateTo
          />
        </div>
        <div>
          <label htmlFor="dateTo">Datum do:</label>
          <input 
            type="date" 
            id="dateTo" 
            value={dateTo} 
            onChange={e => setDateTo(e.target.value)} 
            min={initialDateFrom} // Zajištění, že dateTo nemůže být před dateFrom
            max={initialDateTo} // Zajištění, že dateTo nemůže být po dnešním dni
          />
        </div>
        <div>
          <label htmlFor="searchQuery">Vyhledat objednávku:</label>
          <input 
            type="text" 
            id="searchQuery" 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            placeholder="Zadejte číslo objednávky"
          />
        </div>
        <button type="submit">Vyhledat</button>
        <button type="button" onClick={updateDatabase}>Aktualizovat Databázi</button>
        <button type="button" onClick={handleProcessPickingOrders}>Zpracovat Pickování</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Pickovat</th>
            <th>Číslo objednávky</th>
            <th>Odběratel</th>
            <th>Doprava</th>
            <th>Platba</th>
            <th>Stav</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.Order_Number}>
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
              <td>{order.CustName}</td> {/* Zobrazení odběratele */}
              <td>{order.Delivery}</td>
              <td>{order.Payment}</td>
              <td>{order.Status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default OrderList;
