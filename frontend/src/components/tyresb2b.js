import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import ColumnFilter from './ColumnFilter'; // Ensure the import path is correct

const tyreColumns = [
  { key: 'PartNo', label: 'Číslo dílu' },
  { key: 'Manufacturer', label: 'Výrobce' },
  { key: 'Pattern', label: 'Dezén' },
  { key: 'Width', label: 'Šířka' },
  { key: 'Profile', label: 'Profil' },
  { key: 'Diameter', label: 'Průměr' },
  { key: 'LoadIndexFrom', label: 'Index nosnosti od' },
  { key: 'LoadIndexTo', label: 'Index nosnosti do' },
  { key: 'SpeedIndex', label: 'Rychlostní index' },
  { key: 'Usage', label: 'Použití' },
  { key: 'VehicleType', label: 'Typ vozidla' },
  // Další sloupce podle potřeby
];

function TyresB2B() {
  const [data, setData] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchData = async () => {
      const searchParams = new URLSearchParams(location.search);
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/get-b2b-tyres`, { params: Object.fromEntries(searchParams) });
        setData(response.data);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    fetchData();
  }, [location.search]);

  const handleRowClick = (tyreId) => {
    console.log("Navigating to tyre details with ID:", tyreId);
    navigate(`/tyre-b2b-detail/${tyreId}`);
  };

  const handleFilterChange = (filterName, filterValue) => {
    const searchParams = new URLSearchParams(location.search);
    filterValue ? searchParams.set(filterName, filterValue) : searchParams.delete(filterName);
    navigate(`${location.pathname}?${searchParams}`, { replace: true });
  };

  return (
    <div className="container-fluid">
      <h2>Nákladní Pneumatiky B2B</h2>
      <div className="table-responsive">
        <table className="table table-bordered table-hover">
          <thead>
            <tr>
              {tyreColumns.map(column => (
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
            <tr key={item.ID} onClick={() => handleRowClick(item.ID)} style={{ cursor: 'pointer' }}>
              {tyreColumns.map(column => (
               <td key={column.key}>{item[column.key]}</td>
             ))}
           </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TyresB2B;
