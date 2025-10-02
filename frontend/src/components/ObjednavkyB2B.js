import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import ColumnFilter from './ColumnFilter'; // Ujistěte se, že cesta k importu je správná

const columns = [
  { key: 'Number', label: 'Číslo' },
  { key: 'PaymentType', label: 'Typ platby' },
  { key: 'CustomerName', label: 'Zákazník' },
  { key: 'TotalPrice', label: 'Celková cena' },
  { key: 'Currency', label: 'Měna' },
  { key: 'Status', label: 'Stav' },
  { key: 'DateOfImport', label: 'Datum importu' },
  // Další sloupce podle potřeby
];

function ObjednavkyB2B() {
  const [data, setData] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchData = async () => {
      const searchParams = new URLSearchParams(location.search);
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/get-b2b-orders`, { params: Object.fromEntries(searchParams) });
        setData(response.data);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    fetchData();
  }, [location.search]);

  const handleRowClick = (orderId) => {
    console.log("Navigating to order with ID:", orderId);
    navigate(`/objednavka-b2b-detail/${orderId}`);
  };

  const handleFilterChange = (filterName, filterValue) => {
    const searchParams = new URLSearchParams(location.search);
    filterValue ? searchParams.set(filterName, filterValue) : searchParams.delete(filterName);
    navigate(`${location.pathname}?${searchParams}`, { replace: true });
  };

  return (
    <div className="container-fluid">
      <h2>Objednávky B2B</h2>
      <div className="table-responsive">
        <table className="table table-bordered table-hover">
          <thead>
            <tr>
              {columns.map(column => (
                <th key={column.key}>
                  {column.label}
                  <ColumnFilter 
                    filterName={column.key} 
                    initialValue={new URLSearchParams(location.search).get(column.key) || ""} 
                    onChange={value => handleFilterChange(column.key, value)} 
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
          {data.map((item) => (
            <tr key={item.OrderID} onClick={() => handleRowClick(item.OrderID)} style={{ cursor: 'pointer' }}>
              {columns.map(column => (
               <td key={column.key}>{item[column.key] || item['Order'+column.key]}</td> // Tento řádek zohledňuje možné prefixy
             ))}
           </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ObjednavkyB2B;
