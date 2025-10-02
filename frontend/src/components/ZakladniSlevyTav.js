// ZakladniSlevy.js
import React, { useState, useEffect, useRef, memo } from 'react';
import ColumnFilter from './ColumnFilter';
import { useNavigate } from 'react-router-dom';

// Memoizovaná komponenta pro řádek
const TableRow = memo(function TableRow({
  row,
  index,
  newRowRef,
  handleEdit,
  removeRow,
  handleSaveRow,
  isValueChanged
}) {
  const modifiedStyle = { backgroundColor: 'yellow', padding: '0 5px' };

  return (
    <tr
      key={index}
      ref={index === newRowRef.current?.rowIndex ? newRowRef : null}
    >
      <td
        contentEditable
        onBlur={e =>
          handleEdit(index, 'cenove_skupiny', e.target.innerText.trim())
        }
        style={isValueChanged(index, 'cenove_skupiny') ? modifiedStyle : null}
      >
        {row.cenove_skupiny}
      </td>
      <td
        contentEditable
        onBlur={e => handleEdit(index, 'jmeno', e.target.innerText.trim())}
        style={isValueChanged(index, 'jmeno') ? modifiedStyle : null}
      >
        {row.jmeno}
      </td>

      {['1_eshop', '3_servis', '4_vo', '5_vip', '6_indiv'].map(field => (
        <td
          key={field}
          contentEditable
          onBlur={e => handleEdit(index, field, e.target.innerText.trim())}
          style={isValueChanged(index, field) ? modifiedStyle : null}
        >
          {row[field]}
        </td>
      ))}

      <td>{row.datum_zapsani}</td>

      <td>
        <button className="btn btn-danger" onClick={() => removeRow(index)}>
          Odebrat
        </button>
        {isValueChanged(index, 'cenove_skupiny') && (
          <button
            className="btn btn-success"
            onClick={() => handleSaveRow(index)}
            style={{ marginLeft: '0.5rem' }}
          >
            Uložit
          </button>
        )}
      </td>
    </tr>
  );
});

function ZakladniSlevy() {
  const [data, setData] = useState([]);
  const [editedData, setEditedData] = useState([]);
  const [newRowIndex, setNewRowIndex] = useState(null);
  const newRowRef = useRef(null);
  newRowRef.current = { rowIndex: newRowIndex };
  const [filterValues, setFilterValues] = useState({});
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
    const filtered = editedData.filter(
      item => item && item.cenove_skupiny !== ''
    );
    const sanitized = filtered.map(item => ({
      ...item,
      cenove_skupiny: item.cenove_skupiny.trim()
    }));

    fetch(`${process.env.REACT_APP_API_URL}/update-data-zakladni-slevy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sanitized)
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to update data.');
        fetchData();
      })
      .catch(err => console.error('Error updating data:', err));
  };

  const handleSaveRow = index => {
    const item = editedData[index];
    if (item && item.cenove_skupiny !== '') {
      const sanitized = {
        ...item,
        cenove_skupiny: item.cenove_skupiny.trim()
      };
      fetch(`${process.env.REACT_APP_API_URL}/update-data-zakladni-slevy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([sanitized])
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to update row.');
          fetchData();
        })
        .catch(err => console.error('Error updating row:', err));
    }
  };

  const fetchData = () => {
    const qp = new URLSearchParams(filterValues).toString();
    fetch(`${process.env.REACT_APP_API_URL}/get-tavinox-zakladni-slevy?${qp}`)
      .then(res => res.json())
      .then(raw => {
        setData(raw);
        setEditedData([]);
      })
      .catch(err => console.error('Error fetching data:', err));
  };

  useEffect(() => {
    fetchData();
  }, [filterValues]);

  useEffect(() => {
    if (newRowIndex !== null) {
      newRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [data, newRowIndex]);

  const addRow = () => {
    const newRow = {
      cenove_skupiny: '',
      jmeno: '',
      '1_eshop': '',
      '3_servis': '',
      '4_vo': '',
      '5_vip': '',
      '6_indiv': '',
      datum_zapsani: '',
      isNew: true
    };
    setData(prev => [...prev, newRow]);
    setEditedData(prev => [
      ...prev.map(it => ({ ...it, isNew: false })),
      newRow
    ]);
    setNewRowIndex(data.length);
  };

  const removeRow = index => {
    if (!window.confirm('Opravdu chcete odebrat tento řádek?')) return;
    const key = data[index].cenove_skupiny;
    fetch(
      `${process.env.REACT_APP_API_URL}/delete-data-zakladni-slevy/${key}`,
      { method: 'DELETE' }
    )
      .then(res => {
        if (!res.ok) throw new Error('Failed to delete item.');
        setData(d => d.filter((_, i) => i !== index));
        setEditedData(e => e.filter((_, i) => i !== index));
      })
      .catch(err => console.error('Error deleting item:', err));
  };

  const handleFilterChange = (name, value) => {
    setFilterValues(prev => ({ ...prev, [name]: value }));
  };

  const isValueChanged = (index, field) => {
    return (
      editedData[index] &&
      editedData[index][field] !== undefined &&
      editedData[index][field] !== data[index][field]
    );
  };

  return (
    <div className="card">
      <div className="card-header">
        <button className="btn btn-primary" onClick={handleSave}>
          Uložit změny
        </button>
        <button className="btn btn-secondary" onClick={addRow}>
          Přidat řádek
        </button>
        <h3 className="card-title">Základní Slevy</h3>
      </div>
      <div className="card-body">
        <table className="table table-bordered">
          <thead>
            <tr>
              <th rowSpan={2}>
                Cenové Skupiny
                <ColumnFilter
                  filterName="cenove_skupiny"
                  initialValue={filterValues.cenove_skupiny}
                  onChange={handleFilterChange}
                />
              </th>
              <th rowSpan={2}>
                Jméno
                <ColumnFilter
                  filterName="jmeno"
                  initialValue={filterValues.jmeno}
                  onChange={handleFilterChange}
                />
              </th>
              <th rowSpan={2}>
                E-shop
                <ColumnFilter
                  filterName="1_eshop"
                  initialValue={filterValues['1_eshop']}
                  onChange={handleFilterChange}
                />
              </th>
              <th rowSpan={2}>
                Servis
                <ColumnFilter
                  filterName="3_servis"
                  initialValue={filterValues['3_servis']}
                  onChange={handleFilterChange}
                />
              </th>
              <th rowSpan={2}>
                VO
                <ColumnFilter
                  filterName="4_vo"
                  initialValue={filterValues['4_vo']}
                  onChange={handleFilterChange}
                />
              </th>
              <th rowSpan={2}>
                VIP
                <ColumnFilter
                  filterName="5_vip"
                  initialValue={filterValues['5_vip']}
                  onChange={handleFilterChange}
                />
              </th>
              <th rowSpan={2}>
                Indiv
                <ColumnFilter
                  filterName="6_indiv"
                  initialValue={filterValues['6_indiv']}
                  onChange={handleFilterChange}
                />
              </th>
              <th rowSpan={2}>Datum Zapsání</th>
              <th rowSpan={2}>Akce</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <TableRow
                key={index}
                row={row}
                index={index}
                newRowRef={newRowRef}
                handleEdit={handleEdit}
                removeRow={removeRow}
                handleSaveRow={handleSaveRow}
                isValueChanged={isValueChanged}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ZakladniSlevy;
