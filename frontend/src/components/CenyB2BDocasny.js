import React, { useState, useEffect, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import ColumnFilter from './ColumnFilter';
import SearchProductModal from './SearchProductModal';

function CenyB2BDocasny() {
  const [data, setData] = useState([]);
  const [editedData, setEditedData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRowIndex, setNewRowIndex] = useState(null);
  const newRowRef = useRef(null);
  const [filterValues, setFilterValues] = useState({});
  const [dateFilter, setDateFilter] = useState('all');
  const navigate = useNavigate();

  const handleEdit = (index, field, value) => {
    const newData = [...editedData];
    if (!newData[index]) {
      newData[index] = { ...data[index] };
    }
    newData[index][field] = value;
    setEditedData(newData);
  };

  const handleSave = () => {
    const filteredData = editedData.filter(item => item && item.C_Polozky !== '');
    const sanitizedData = filteredData.map(item => ({
      ...item,
      C_Polozky: item.C_Polozky.trim()
    }));

    fetch(process.env.REACT_APP_API_URL + '/update-data-cenyb2b', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sanitizedData),
    })
      .then(response => {
        if (response.ok) {
          console.log('Data successfully updated.');
          fetchData();
        } else {
          throw new Error('Failed to update data.');
        }
      })
      .catch(error => {
        console.error('Error updating data:', error);
      });
  };

  const handleSaveRow = (index) => {
    const item = editedData[index];
    if (item && item.C_Polozky !== '') {
      const sanitizedData = {
        ...item,
        C_Polozky: item.C_Polozky.trim()
      };

      fetch(process.env.REACT_APP_API_URL + '/update-data-cenyb2b', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([sanitizedData]),
      })
        .then(response => {
          if (response.ok) {
            console.log('Row successfully updated.');
            fetchData();
          } else {
            throw new Error('Failed to update row.');
          }
        })
        .catch(error => {
          console.error('Error updating row:', error);
        });
    }
  };

  const fetchData = () => {
    const queryParams = new URLSearchParams(filterValues).toString();

    fetch(`${process.env.REACT_APP_API_URL}/get-cenyb2b?${queryParams}`)
      .then(response => response.json())
      .then(data => {
        const tzData = data.map(item => ({
          ...item,
          M_akce_od: item.M_akce_od ? format(parseISO(item.M_akce_od), 'yyyy-MM-dd') : null,
          M_akce_do: item.M_akce_do ? format(parseISO(item.M_akce_do), 'yyyy-MM-dd') : null,
        }));
        setData(tzData);
        setEditedData([]);
      })
      .catch(error => console.error('Error fetching data:', error));
  };

  useEffect(() => {
    fetchData();
  }, [filterValues]);

  const addRow = () => {
    const newRow = {
      C_Polozky: '',
      Nazev: '',
      Nazev2: '',
      Nazev3: '',
      Prodej: '',
      EAN: '',
      Sirka: '',
      Rafek: '',
      Profil: '',
      SK_radkove_slevy: '',
      SK_polozek: '',
      Sleva: '',
      C_Ext: '',
      DOT: '',
      Datum_zmeny: '',
      Dostupnost_Web: '',
      Dostupnost_B2B: '',
      AX_B2B: '',
      Zmenil: '',
      Marketingova_akce: '',
      M_akce_od: null,
      M_akce_do: null,
      M_akce_cena: '',
      isNew: true
    };
    setData(prevData => [...prevData, newRow]);
    setEditedData(prevEditedData => [...prevEditedData, newRow]);
    setNewRowIndex(data.length);
    setIsModalOpen(true);
  };

  const removeRow = (index) => {
    const confirmed = window.confirm('Opravdu chcete odebrat tento řádek?');
    if (confirmed) {
      const C_Polozky = data[index].C_Polozky;

      fetch(`${process.env.REACT_APP_API_URL}/delete-data-cenyb2b/${C_Polozky}`, {
        method: 'DELETE',
      })
        .then(response => {
          if (response.ok) {
            const newData = data.filter((_, i) => i !== index);
            const newEditedData = editedData.filter((_, i) => i !== index);
            setData(newData);
            setEditedData(newEditedData);
          } else {
            throw new Error('Failed to delete item.');
          }
        })
        .catch(error => {
          console.error('Error deleting item:', error);
        });
    }
  };

  const handleFilterChange = (filterName, filterValue) => {
    setFilterValues(prev => ({ ...prev, [filterName]: filterValue }));
  };

  const handleDateFilterChange = (filter) => {
    setDateFilter(filter);
  };

  const filteredData = data.filter((row) => {
    if (!row) return false;
    const today = new Date();
    const startDate = row.M_akce_od ? parseISO(row.M_akce_od) : null;
    const endDate = row.M_akce_do ? parseISO(row.M_akce_do) : null;

    if (dateFilter === 'valid') {
      return startDate && endDate && today >= startDate && today <= endDate;
    } else if (dateFilter === 'expiring') {
      const timeLeft = endDate ? (endDate - today) / (1000 * 3600 * 24) : null;
      return startDate && endDate && today >= startDate && today <= endDate && timeLeft <= 7;
    } else if (dateFilter === 'invalid') {
      return !startDate || !endDate || today < startDate || today > endDate;
    } else {
      return true;
    }
  });

  const handleSelectItem = (item) => {
    if (newRowIndex !== null) {
      const newData = [...data];
      const newEditedData = [...editedData];
      const newRow = {
        ...newData[newRowIndex],
        C_Polozky: item.ItemId,
        Nazev: item.ItemName,
        Nazev2: item.ItsItemName2 || '',
        Nazev3: item.ItsItemName3 || '',
        Prodej: item.SalesPrice || '',
        Sleva:  '',
      };
      newData[newRowIndex] = newRow;
      newEditedData[newRowIndex] = newRow;
      setData(newData);
      setEditedData(newEditedData);
      setIsModalOpen(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <button className="btn btn-primary" onClick={handleSave}>Uložit změny</button>
        <button className="btn btn-secondary" onClick={addRow}>Přidat řádek</button>
        <h3 className="card-title">Ceny B2B</h3>
       
      </div>
      <div className="card-body">
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>C Položky <ColumnFilter filterName="C_Polozky" initialValue={filterValues["C_Polozky"]} onChange={handleFilterChange} /></th>
              <th>Název <ColumnFilter filterName="Nazev" initialValue={filterValues["Nazev"]} onChange={handleFilterChange} /></th>
              <th>Název2</th>
              <th>Název3</th>
              <th>Prodej</th>
              <th>Sleva</th>
              <th>Akce</th>              
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, index) => (
              <tr key={index}>
                <td>{row.C_Polozky}</td>
                <td>{row.Nazev}</td>
                <td>{row.Nazev2}</td>
                <td>{row.Nazev3}</td>
                <td
                  contentEditable
                  onBlur={e => handleEdit(index, 'Prodej', e.target.innerText)}
                >
                  {row.Prodej}
                </td>
                <td
                  contentEditable
                  onBlur={e => handleEdit(index, 'Sleva', e.target.innerText)}
                >
                  {row.Sleva}
                </td>
                <td>
                  <button className="btn btn-danger" onClick={() => removeRow(index)}>Odebrat</button>
                  {editedData[index] && editedData[index].C_Polozky && (
                    <button className="btn btn-success" onClick={() => handleSaveRow(index)}>Uložit</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isModalOpen && (
        <SearchProductModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSelectItem={handleSelectItem}
        />
      )}
    </div>
  );
}

export default CenyB2BDocasny;
