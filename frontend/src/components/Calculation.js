import React, { useState, useEffect } from 'react';
import { useTable, useFilters, useGlobalFilter } from 'react-table';


// Komponenta pro výchozí sloupcový filtr
function DefaultColumnFilter({
  column: { filterValue, setFilter },
}) {
  return (
    <input
      value={filterValue || ''}
      onChange={e => setFilter(e.target.value || undefined)}
      placeholder={`Hledat...`}
    />
  );
}

// Globální filtr
function GlobalFilter({
  globalFilter,
  setGlobalFilter,
}) {
  return (
    <span>
      Hledat: {' '}
      <input
        value={globalFilter || ''}
        onChange={e => setGlobalFilter(e.target.value || undefined)}
        placeholder={`Všechny sloupce...`}
      />
    </span>
  );
}

function ImportPLOR() {
  const [file, setFile] = useState(null);
  const [data, setData] = useState([]);

  // Definice fetchData jako samostatné funkce
  const fetchData = async () => {
    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/get-comparison-data');
      if (!response.ok) throw new Error('Data could not be fetched');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching comparison data:', error);
    }
  };

  // Načtení dat při inicializaci komponenty
  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!file) {
      alert('Prosím, vyberte soubor pro nahrání.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/import-xlsx-an-PLOR', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert('Soubor byl úspěšně nahrán.');
        // Znovu načíst data po úspěšném nahrání
        fetchData();
      } else {
        alert('Nepodařilo se nahrát soubor.');
      }
    } catch (error) {
      alert('Došlo k chybě při nahrávání souboru: ' + error.message);
    }
  };

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };


  // Definice sloupců pro react-table
   const columns = React.useMemo(() => [
  {
  Header: 'Č. Položky',
  accessor: 'C_Polozky',
   Filter: DefaultColumnFilter,
  Cell: ({ row }) => {
    // Zkontroluj, zda hodnota ve sloupci 'shoda' obsahuje 'C_Polozky=IMP_c_polozky'
    const isMatched = row.original.shoda.includes('C_Polozky=IMP_c_polozky');
    return (
      <div style={{ backgroundColor: isMatched ? '#ccffcc' : '#ffcccc' }}>
        {row.values.C_Polozky}
      </div>
    );
  }
}
,
    {
      Header: 'Č. Položky 2',
      accessor: 'C_Polozky2',
       Filter: DefaultColumnFilter, 
      Cell: ({ row }) => {
       const isMatched = row.original.shoda.includes('C_Polozky2=IMP_c_polozky');
       return (
      <div style={{ backgroundColor: isMatched ? '#ccffcc' : 'transparent' }}>
        {row.values.C_Polozky2}
      </div>
    );
  }
    },
    {
      Header: 'Č. Položky 3',
      accessor: 'C_Polozky3',
       Filter: DefaultColumnFilter, 
       Cell: ({ row }) => {
       const isMatched = row.original.shoda.includes('C_Polozky3=IMP_c_polozky');
       return (
      <div style={{ backgroundColor: isMatched ? '#ccffcc' : 'transparent' }}>
        {row.values.C_Polozky3}
      </div>
    );
  }
    },
    {
      Header: 'Ext. č. položky',
      accessor: 'Ext_cislo_AX',
       Filter: DefaultColumnFilter,
       Cell: ({ row }) => {
       const isMatched = row.original.shoda.includes('Ext_cislo_polozky=C_Polozky');
       return (
      <div style={{ backgroundColor: isMatched ? '#ccffcc' : 'transparent' }}>
        {row.values.Ext_cislo_AX}
      </div>
    );
  }
    },
    {
      Header: 'Název',
      accessor: 'Nazev',
      Filter: DefaultColumnFilter,
    },
    {
      Header: 'Prodej - Ceník',
      accessor: 'Prodej_PLOR',
      Filter: DefaultColumnFilter,
      Cell: ({ row }) => {
      const isMatched = row.original.shoda.includes('Prodej shodný');
       return (
      <div style={{ backgroundColor: isMatched ? '#ccffcc' : '#ffcccc' }}>
        {row.values.Prodej_PLOR}
      </div>
    );
  }
    },
    {
      Header: 'Prodej - AX',
      accessor: 'Prodej_AX',
      Filter: DefaultColumnFilter,
      Cell: ({ row }) => {
      const isMatched = row.original.shoda.includes('Prodej shodný');
       return (
      <div style={{ backgroundColor: isMatched ? '#ccffcc' : '#ffcccc'}}>
        {row.values.Prodej_AX}
      </div>
    );
  }
    },
  {
  Header: 'Dat. Prod. ceny',
  accessor: 'prodej_datum_ceny_AX',
  Filter: DefaultColumnFilter,
Cell: ({ value }) => {
    // Formátování data, pokud existuje hodnota
    return value ? new Date(value).toLocaleDateString("cs-CZ") : '';
  }
}
,
     {
      Header: 'Dostupnost Web',
      accessor: 'dostupnost_Web_AX',
      Filter: DefaultColumnFilter,
    },
    
    // Přidejte další sloupce podle vašich dat...
  ], []);

  
const defaultColumn = React.useMemo(() => ({
    Filter: DefaultColumnFilter, // Nastavení výchozího filtru pro všechny sloupce
  }), []);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    state,
    visibleColumns,
    preGlobalFilteredRows,
    setGlobalFilter,
  } = useTable({
    columns,
    data,
    defaultColumn, // Nastavení výchozího filtru pro všechny sloupce
  }, useFilters, useGlobalFilter);
  return (
    <div className="import-plor-container">
      <h2>Import Kalkulačního Ceníku</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="fileUpload">Nahrát soubor:</label>
          <input
            type="file"
            id="fileUpload"
            name="fileUpload"
            accept=".xlsx"
            onChange={handleFileChange}
          />
        </div>
        <button type="submit" className="btn btn-primary">Nahrát a zpracovat</button>
      </form>

      <h2>Přehled Dat</h2>
     <GlobalFilter
  globalFilter={state.globalFilter}
  setGlobalFilter={setGlobalFilter}
/> 
     <div className="table-responsive">
        <table {...getTableProps()} className="table table-bordered table-striped">
          <thead>
  {headerGroups.map(headerGroup => (
    <tr {...headerGroup.getHeaderGroupProps()}>
      {headerGroup.headers.map(column => (
        <th {...column.getHeaderProps()}>
          {column.render('Header')}
          {/* Render filtru pro každý sloupec */}
          <div>{column.canFilter ? column.render('Filter') : null}</div>
        </th>
      ))}
    </tr>
  ))}
</thead>
          <tbody {...getTableBodyProps()}>
            {rows.map(row => {
              prepareRow(row);
              return (
                <tr {...row.getRowProps()}>
                  {row.cells.map(cell => (
                    <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ImportPLOR;
