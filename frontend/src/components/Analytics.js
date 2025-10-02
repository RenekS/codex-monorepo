// Analytics.js
import React, { useState, useEffect } from 'react';
import { useTable, useFilters, useGlobalFilter } from 'react-table';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';


function DefaultColumnFilter({
  column: { filterValue, setFilter },
}) {
  return (
    <input
      value={filterValue || ''}
      onChange={e => {
        setFilter(e.target.value || undefined); // Nastaví undefined pro odstranění filtru
      }}
      placeholder={`Hledat...`}
    />
  );
}

// Globální filtr pro vyhledávání ve všech sloupcích
function GlobalFilter({
  preGlobalFilteredRows,
  globalFilter,
  setGlobalFilter,
}) {
  const count = preGlobalFilteredRows.length;

  return (
    <span>
      Hledat: {' '}
      <input
        value={globalFilter || ''}
        onChange={e => {
          setGlobalFilter(e.target.value || undefined); // Nastaví undefined pro odstranění filtru
        }}
        placeholder={`${count} záznamů...`}
      />
    </span>
  );
}


function Analytics() {
  const [file, setFile] = useState(null);
  const [data, setData] = useState([]);
  const [showTable, setShowTable] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(process.env.REACT_APP_API_URL + '/get-import-data-CZS-Analytik');
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const columns = React.useMemo(
    () => [
      {
        Header: 'ID',
        accessor: 'id', // Klíč pro přístup k hodnotě
        disableFilters: true, // ID nebude filtrovatelné
      },
      {
        Header: 'Dodavatel',
        accessor: 'dodavatel',
        Filter: DefaultColumnFilter,
      },
      {
        Header: 'Externí číslo položky',
        accessor: 'externi_cislo_polozky',
        Filter: DefaultColumnFilter,
      },
      {
        Header: 'Název produktu',
        accessor: 'nazev_produktu',
        Filter: DefaultColumnFilter,
      },
      {
        Header: 'Prodejní cena',
        accessor: 'prodej_cena',
        Filter: DefaultColumnFilter,
      },
      {
        Header: 'Min. prod. cena',
        accessor: 'minimalni_prodejni_cena',
        Filter: DefaultColumnFilter,
      },
      {
        Header: 'V akci od',
        accessor: 'v_akci_od',
        Filter: DefaultColumnFilter,
      },
      {
        Header: 'V akci do',
        accessor: 'v_akci_do',
        Filter: DefaultColumnFilter,
      },
      {
        Header: 'Akční cena',
        accessor: 'akcni_cena',
        Filter: DefaultColumnFilter,
      },
      {
        Header: 'Mar. akce',
        accessor: 'marketingove_akce',
        Filter: DefaultColumnFilter,
      },
      {
        Header: 'Č. polozky',
        accessor: 'c_polozky',
        Filter: DefaultColumnFilter,
      },
      {
        Header: 'Dost. web',
        accessor: 'dostupnost_web',
        Filter: DefaultColumnFilter,
      },
      {
        Header: 'Dost. B2B',
        accessor: 'dostupnost_b2b',
        Filter: DefaultColumnFilter,
      },
      {
        Header: 'Sk. rad. sl.',
        accessor: 'skupina_radkove_slevy',
        Filter: DefaultColumnFilter,
      },
      {
        Header: 'Sk. položek',
        accessor: 'sk_polozek',
        Filter: DefaultColumnFilter,
      },    
      {
        Header: 'Náklady - cena',
        accessor: 'naklady_cena',
        Filter: DefaultColumnFilter,
      },
      {
        Header: 'Prodej - datum ceny',
        accessor: 'prodej_datum_ceny',
        Filter: DefaultColumnFilter,
      },

      // ... všechny ostatní sloupce podle struktury vaší tabulky
    ],
    []
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    state,
    preGlobalFilteredRows,
    setGlobalFilter,
  } = useTable(
    {
      columns,
      data,
      defaultColumn: { Filter: DefaultColumnFilter }, // Nastavit výchozí filtr pro všechny sloupce
    },
    useFilters, // Použití filtrů
    useGlobalFilter, // Použití globálního filtru
  );

  // Funkce pro zpracování výběru souboru
  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  // Funkce pro odeslání souboru na server
  const handleSubmit = async (event) => {
  event.preventDefault();

  if (!file) {
    alert('Prosím, vyberte soubor pro nahrání.');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(process.env.REACT_APP_API_URL + '/import-xlsx', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      // Zkontrolujte, zda je odpověď ve formátu JSON
      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        alert('Soubor byl úspěšně nahrán a zpracován.');
        console.log(result);
      } else {
        // Zpracování odpovědi, která není ve formátu JSON
        const textResponse = await response.text();
        alert(textResponse);
      }
    } else {
      throw new Error('Nepodařilo se nahrát soubor.');
    }
  } catch (error) {
    alert('Došlo k chybě při nahrávání souboru: ' + error.message);
    console.error('Error:', error);
  }
};

  return (
    <div className="analytics-container">
      <h2>Analytika</h2>
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
      

 <div className="card"> {/* Využití komponenty Card z AdminLTE */}
        <div className="card-header">
          <h3 className="card-title">Analytická tabulka</h3>
          <div className="card-tools">
            {/* Tlačítko pro sklápění/skrývání tabulky */}
            <button type="button" className="btn btn-tool" onClick={() => setShowTable(!showTable)}>
              {showTable ? <i className="fas fa-minus"></i> : <i className="fas fa-plus"></i>}
            </button>
          </div>
        </div>
        {showTable && ( // Podmíněné zobrazení tabulky na základě stavové proměnné
          <div className="card-body">
      <GlobalFilter
        preGlobalFilteredRows={preGlobalFilteredRows}
        globalFilter={state.globalFilter}
        setGlobalFilter={setGlobalFilter}
      />
      <table {...getTableProps()} className="table table-bordered table-striped">
        <thead>
          {headerGroups.map(headerGroup => (
            <tr {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map(column => (
                <th {...column.getHeaderProps()}>
                  {column.render('Header')}
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
        )}
      </div>
    </div>
  );
}

export default Analytics;
