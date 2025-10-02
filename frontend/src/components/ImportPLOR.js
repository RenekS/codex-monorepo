import React, { useState, useEffect } from 'react';
import { useTable, useFilters, useGlobalFilter } from 'react-table';
import * as XLSX from 'xlsx';
import SearchSelectModal from './SearchSelectModal';
import ExportImportModal from './ExportImportModal';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import Button from '@mui/material/Button';
import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';

// Komponenta pro výchozí sloupcový filtr
function DefaultColumnFilter({ column: { filterValue, setFilter } }) {
  return (
    <TextField
      value={filterValue || ''}
      onChange={e => setFilter(e.target.value || undefined)}
      placeholder="Hledat..."
      variant="outlined"
      size="small"
    />
  );
}

// Globální filtr
function GlobalFilter({ globalFilter, setGlobalFilter }) {
  return (
    <Box>
      <Typography variant="body1">Hledat:</Typography>
      <TextField
        value={globalFilter || ''}
        onChange={e => setGlobalFilter(e.target.value || undefined)}
        placeholder="Všechny sloupce..."
        variant="outlined"
        size="small"
      />
    </Box>
  );
}

// Stylování MUI modálu
const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

function ImportPLOR() {
  const [file, setFile] = useState(null);
  const [versionName, setVersionName] = useState('');
  const [data, setData] = useState([]);
  const [showPLORModal, setShowPLORModal] = useState(false);
  const [showIMPModal, setShowIMPModal] = useState(false);
  const [selectedPLORVersion, setSelectedPLORVersion] = useState(null);
  const [selectedIMPVersion, setSelectedIMPVersion] = useState(null);
  const [showExportImportModal, setShowExportImportModal] = useState(false); // Stav pro zobrazení modálního okna
  const [importData, setImportData] = useState({ file: null, versionName: '' });
  const [selectedSheets, setSelectedSheets] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [selectedVersions, setSelectedVersions] = useState({
    PLOR: { VersionID: null, VersionName: '' },
    IMP: { VersionID: null, VersionName: '' }
  });

  useEffect(() => {
    console.log("Aktuální uživatel je:", currentUser);
  }, [currentUser]);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const plorVerze = queryParams.get('plorVerze');
    const impVerze = queryParams.get('impVerze');

    if (plorVerze || impVerze) {
      setSelectedVersions(prev => ({
        ...prev,
        PLOR: { ...prev.PLOR, VersionID: plorVerze || prev.PLOR.VersionID },
        IMP: { ...prev.IMP, VersionID: impVerze || prev.IMP.VersionID }
      }));
    }
  }, [location]);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const plorVerzeId = queryParams.get('plorVerze');
    const impVerzeId = queryParams.get('impVerze');

    if (plorVerzeId) {
      fetchVersionName(plorVerzeId, 'PLOR').then(versionName => {
        setSelectedVersions(prev => ({
          ...prev,
          PLOR: { VersionID: plorVerzeId, VersionName: versionName }
        }));
      });
    }
    if (impVerzeId) {
      fetchVersionName(impVerzeId, 'IMP').then(versionName => {
        setSelectedVersions(prev => ({
          ...prev,
          IMP: { VersionID: impVerzeId, VersionName: versionName }
        }));
      });
    }
  }, []);

  const handleOpenExportImportModal = () => {
    setShowExportImportModal(true); // Otevře modální okno
    console.log("Otevírám Export/Import modální okno"); // Ladění
  };

  const handleExportImportClose = () => {
    setShowExportImportModal(false); // Zavře modální okno
    console.log("Zavírám Export/Import modální okno"); // Ladění
  };

  const handleExportImportSubmit = async (formData) => {
    console.log('handleExportImportSubmit called with formData:', formData);
  
    if (!currentUser || !currentUser.userID) {
      console.error('Uživatel není přihlášený nebo currentUser není dostupný.');
      alert('Uživatel není přihlášený nebo currentUser není dostupný.');
      return;
    }
  
    formData.append("userID", currentUser.userID);
  
    const url = `${process.env.REACT_APP_API_URL}/import-xlsx-an-PLOR`;
    console.log('Sending POST request to:', url);
  
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });
  
      console.log('Server response:', response);
  
      if (response.ok) {
        console.log("Data byla úspěšně importována");
        alert("Data byla úspěšně importována");
      } else {
        console.error("Nepodařilo se importovat data, status: ", response.status);
        alert(`Nepodařilo se importovat data, status: ${response.status}`);
      }
    } catch (error) {
      console.error("Došlo k chybě při importu: ", error);
      alert(`Došlo k chybě při importu: ${error}`);
    }
  };
  

  const updateURL = () => {
    const newURL = generateURLWithParams(selectedVersions);
    navigate(newURL, { replace: true });
  };

  const handleSelectVersion = (version, module) => {
    setSelectedVersions(prev => ({ ...prev, [module]: version.VersionID }));
  };

  const loadComparison = async () => {
    const { PLOR, IMP } = selectedVersions;
    if (!PLOR.VersionID || !IMP.VersionID) {
      console.log('Nejsou vybrány všechny potřebné verze pro srovnání.');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/get-comparison-data?plorVerze=${PLOR.VersionID}&impVerze=${IMP.VersionID}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      setData(data);
      console.log("Data z /get-comparison-data:", data);
    } catch (error) {
      console.error("Chyba při načítání srovnávacích dat: ", error);
    }
  };

  const fetchPLORTemplates = async () => {
    try {
      console.log(`Fetching PLOR templates for PLOR component`);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/search-versions?componentType=PLOR`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      console.log("API call success, data received for PLOR:", data);
      return data; // Vrací celé pole šablon
    } catch (error) {
      console.error("Error fetching PLOR templates: ", error);
      return []; // V případě chyby vrací prázdné pole
    }
  };

  const fetchIMPTemplates = async () => {
    try {
      console.log(`Fetching IMP templates for PLAX component`);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/search-versions?componentType=PLAX`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      console.log("API call success, data received for PLOR:", data);
      return data; // Vrací celé pole šablon
    } catch (error) {
      console.error("Error fetching IMP templates: ", error);
      return []; // V případě chyby vrací prázdné pole
    }
  };

  const fetchData = async (plorFilterId, impFilterId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/get-comparison-data?plorVerze=${plorFilterId}&impVerze=${impFilterId}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      console.log("Data z /get-comparison-data:", data);
      setData(data);
    } catch (error) {
      console.error("Chyba při načítání srovnávacích dat: ", error);
    }
  };

  const generateURLWithParams = (selectedVersions) => {
    const { PLOR, IMP } = selectedVersions;
    const queryParams = new URLSearchParams();

    if (PLOR.VersionID) {
      queryParams.append('plorVerze', PLOR.VersionID);
    }
    if (IMP.VersionID) {
      queryParams.append('impVerze', IMP.VersionID);
    }

    return queryParams.toString() ? `/import-plor?${queryParams}` : '/import-plor';
  };

  async function fetchVersionName(versionId, module) {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/get-name-version-from-id?versionId=${versionId}&module=${module}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      return data.versionName;
    } catch (error) {
      console.error("Chyba při načítání názvu verze: ", error);
      return '';
    }
  }

  const handleSelectPLORTemplate = (template) => {
    setSelectedVersions(prevVersions => ({
      ...prevVersions,
      PLOR: { VersionID: template.filterId, VersionName: template.filterName || '' }
    }));
    setShowPLORModal(false);
  };

  const handleSelectIMPTemplate = (template) => {
    setSelectedVersions(prevVersions => ({
      ...prevVersions,
      IMP: { VersionID: template.filterId, VersionName: template.filterName || '' }
    }));
    setShowIMPModal(false);
  };

  const resetVersionSelection = (module) => {
    setSelectedVersions(prev => ({ ...prev, [module]: { VersionID: null, VersionName: '' }}));
  };

  useEffect(() => {
    const { PLOR, IMP } = selectedVersions;

    if (PLOR && IMP) {
      fetchData(PLOR.VersionID, IMP.VersionID);
    }
  }, [selectedVersions]);

  const exportToXLSX = () => {
    const ws = XLSX.utils.json_to_sheet(data.map(row => {
      return {
        ...row,
        C_Polozky: row.shoda.includes('C_Polozky=IMP_c_polozky') ? 'Zelená: ' + row.C_Polozky : 'Červená: ' + row.C_Polozky,
      };
    }), {header: ['C_Polozky', 'shoda', 'C_Polozky_AX', 'Ext_cislo_AX', 'Nazev', 'Cena', 'Prodej_AX', 'prodej_datum_ceny_AX', 'dostupnost_Web_AX'], skipHeader: true});

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, "exportedData.xlsx");
  };

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const columns = React.useMemo(() => [
    {
      Header: 'Č. Položky - ceník',
      accessor: 'C_Polozky',
      Filter: DefaultColumnFilter,
      Cell: ({ row }) => {
        let style = {};
        if (row.original.shoda.includes('C_Polozky=IMP_c_polozky')) {
          style.backgroundColor = '#ccffcc';
        } else if (row.original.shoda.includes('Ext_cislo_polozky=C_Polozky')) {
          style.backgroundColor = '#ffcc88';
        } else {
          style.backgroundColor = '#ffcccc';
        }

        return (
          <div style={style}>
            {row.values.C_Polozky}
          </div>
        );
      }
    },
    {
      Header: 'Shoda',
      accessor: 'shoda',
      Filter: DefaultColumnFilter,
      Cell: ({ value }) => {
        let style = {};
        let text = value;

        if (value.includes('C_Polozky=IMP_c_polozky') || value.includes('Ext_cislo_polozky=C_Polozky')) {
          style = { backgroundColor: '#ccffcc', fontWeight: 'bold' };
          text = 'Běžný produkt';
        } else if (value === 'NESPÁROVÁNO - pouze v PLOR') {
          style = { backgroundColor: '#ffcc88', fontWeight: 'bold' };
          text = 'Nová položka';
        } else if (value === 'NESPÁROVÁNO - pouze v IMP') {
          style = { backgroundColor: '#ffcccc', fontWeight: 'bold' };
          text = 'Ukončená výroba';
        }

        return <div style={style}>{text}</div>;
      }
    },
    {
      Header: 'Ext. č. položky AX',
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
      accessor: 'Cena',
      Filter: DefaultColumnFilter,
      Cell: ({ row }) => {
        const isMatched = row.original.shoda.includes('Prodej shodný');
        return (
          <div style={{ backgroundColor: isMatched ? '#ccffcc' : '#ffcccc' }}>
            {row.values.Cena}
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
        return value ? new Date(value).toLocaleDateString("cs-CZ") : '';
      }
    },
    {
      Header: 'Dostupnost Web',
      accessor: 'dostupnost_Web_AX',
      Filter: DefaultColumnFilter,
    },
  ], []);

  const defaultColumn = React.useMemo(() => ({
    Filter: DefaultColumnFilter,
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
    defaultColumn,
  }, useFilters, useGlobalFilter);

  return (
    <div className="import-plor-container">
      <Typography variant="h4">Import Kalkulačního Ceníku</Typography>
      <Button variant="contained" color="primary" onClick={handleOpenExportImportModal}>
        Otevřít Export/Import
      </Button>

      <Button variant="contained" color="primary" onClick={() => setShowPLORModal(true)}>
        {selectedVersions.PLOR.VersionName || "Vybrat ceník"}
        {selectedVersions.PLOR.VersionName && (
          <Button onClick={(e) => {
            e.stopPropagation();
            resetVersionSelection('PLOR');
          }}>Reset</Button>
        )}
      </Button>

      <Button variant="contained" color="primary" onClick={() => setShowIMPModal(true)}>
        {selectedVersions.IMP.VersionName || "Vybrat obraz AX"}
        {selectedVersions.IMP.VersionName && (
          <Button onClick={(e) => {
            e.stopPropagation();
            resetVersionSelection('IMP');
          }}>Reset</Button>
        )}
      </Button>
    
      <Button variant="contained" color="success" onClick={exportToXLSX}>
        Exportovat do XLSX
      </Button>

      <Typography variant="h5">Přehled Dat</Typography>
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

      {/* Modál pomocí MUI */}
      <Modal
        open={showExportImportModal}
        onClose={handleExportImportClose}
      >
        <Box sx={modalStyle}>
          <ExportImportModal
            handleClose={handleExportImportClose}
            onSubmit={handleExportImportSubmit}
          />
        </Box>
      </Modal>

      <SearchSelectModal
        show={showPLORModal}
        handleClose={() => setShowPLORModal(false)}
        fetchItems={fetchPLORTemplates}
        onSelect={handleSelectPLORTemplate}
        placeholder="Vyhledat PLOR šablony..."
      />

      <SearchSelectModal
        show={showIMPModal}
        handleClose={() => setShowIMPModal(false)}
        fetchItems={fetchIMPTemplates}
        onSelect={handleSelectIMPTemplate}
        placeholder="Vyhledat IMP šablony..."
      />
    </div>
  );
}

export default ImportPLOR;
