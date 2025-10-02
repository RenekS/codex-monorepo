import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, parseISO } from 'date-fns';
import { CSVLink } from 'react-csv';
import axios from 'axios';
import ColumnFilter from './ColumnFilter'; // Přidání ColumnFilter komponenty

function EditableTable() {
  const [data, setData] = useState([]);
  const [viewConfig, setViewConfig] = useState([]);
  const [editedData, setEditedData] = useState([]);
  const [filterValues, setFilterValues] = useState({});

  useEffect(() => {
    fetchViewConfig('Scenar1');
    fetchData();
  }, [filterValues]); // Přidání závislosti na filterValues

  const fetchViewConfig = async (viewName) => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/get-view-config`, {
        params: { view_name: viewName }
      });
      setViewConfig(response.data);
    } catch (error) {
      console.error('Error fetching view config:', error);
    }
  };

  const fetchData = async () => {
    const queryParams = new URLSearchParams(filterValues).toString();
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/get-invent-table-data?${queryParams}`);
      setData(response.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleEdit = (index, field, value) => {
    const newData = [...editedData];
    if (!newData[index]) {
      newData[index] = { ...data[index] };
    }
    newData[index][field] = value;
    setEditedData(newData);
  };

  const handleDateChange = (index, field, value) => {
    if (value instanceof Date) {
      const formattedDate = format(value, "yyyy-MM-dd");
      handleEdit(index, field, formattedDate);
    } else {
      handleEdit(index, field, null);
    }
  };

  const renderCell = (row, index, column) => {
    const { column_name, editable, value_source, enum_table } = column;
    const value = editedData[index] && editedData[index][column_name] !== undefined ? editedData[index][column_name] : row[column_name];

    if (!editable) {
      return value;
    }

    if (value_source === 'enum') {
      // Zde přidejte logiku pro načtení hodnot z enum_table
      return (
        <select value={value} onChange={(e) => handleEdit(index, column_name, e.target.value)}>
          {/* Zde přidejte možnosti z enum_table */}
        </select>
      );
    } else {
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => handleEdit(index, column_name, e.target.value)}
        />
      );
    }
  };

  const handleSave = () => {
    // Uložení editovaných dat (např. odeslání na backend)
  };

  const exportToCSV = () => {
    const headers = viewConfig.map(col => col.column_name);
    const rows = data.map(row => {
      return headers.map(header => row[header]);
    });
    return [headers, ...rows];
  };

  const handleFilterChange = (filterName, filterValue) => {
    setFilterValues(prev => ({ ...prev, [filterName]: filterValue }));
  };

  return (
    <div>
      <button onClick={handleSave}>Uložit změny</button>
      <CSVLink data={exportToCSV()} filename="export.csv">
        Exportovat do CSV
      </CSVLink>
      <table>
        <thead>
          <tr>
            {viewConfig.map(column => (
              <th key={column.column_name}>
                {column.column_name}
                <ColumnFilter filterName={column.column_name} initialValue={filterValues[column.column_name]} onChange={handleFilterChange} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              {viewConfig.map(column => (
                <td key={column.column_name}>
                  {renderCell(row, index, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default EditableTable;
