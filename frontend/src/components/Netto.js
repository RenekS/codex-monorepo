// Netto.js
import React, { useState, useEffect, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, parseISO } from 'date-fns';
import SearchProductModal from './SearchProductModal';
import ColumnFilter from './ColumnFilter';
import { useNavigate } from 'react-router-dom';
import RefreshIcon from '@mui/icons-material/Refresh';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Box,
  Snackbar,
  Alert,
} from '@mui/material';
import { jwtDecode } from 'jwt-decode'; // Corrected import

function Netto() {
  const [data, setData] = useState([]);
  const [editedData, setEditedData] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [productGroup, setProductGroup] = useState('');
  const [newRowId, setNewRowId] = useState(null);
  const newRowRef = useRef(null);
  const tableContainerRef = useRef(null);
  const [scrollToEnd, setScrollToEnd] = useState(false);

  // Rozdělení filtrů na lokální a vzdálené
  const [remoteFilters, setRemoteFilters] = useState({});
  const [localFilters, setLocalFilters] = useState({});

  const navigate = useNavigate();

  const getUsername = () => {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const decoded = jwtDecode(token); // Corrected function name
        return decoded.username || 'Neznámý uživatel';
      } catch (error) {
        console.error('Invalid token:', error);
        return 'Neznámý uživatel';
      }
    }
    return 'Neznámý uživatel';
  };

  // State pro zobrazení notifikací
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success', // 'success' | 'error' | 'warning' | 'info'
  });

  // Funkce pro zobrazení notifikací
  const showNotification = (message, severity = 'success') => {
    setNotification({ open: true, message, severity });
  };

  // Zavření notifikace
  const handleCloseNotification = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setNotification((prev) => ({ ...prev, open: false }));
  };

  // Funkce pro úpravu dat v tabulce
  const handleEdit = (polozka, field, value) => {
    setEditedData((prev) => ({
      ...prev,
      [polozka]: {
        ...prev[polozka],
        [field]: value,
      },
    }));
  };

  // Funkce pro změnu data pomocí DatePickeru
  const handleDateChange = (polozka, field, value) => {
    if (value instanceof Date) {
      const formattedDate = format(value, 'yyyy-MM-dd');
      handleEdit(polozka, field, formattedDate);
    } else {
      handleEdit(polozka, field, null);
    }
  };

  // Funkce pro kontrolu změněných řádků
  const isRowChanged = (polozka) => {
    const originalRow = data.find((row) => row.polozka === polozka);
    if (!originalRow) return false;
    if (originalRow.isNew) return true; // Nové řádky vždy považujeme za změněné
    return editedData[polozka] && Object.keys(editedData[polozka]).length > 0;
  };

  // Funkce pro kontrolu duplicitních řádků
  const isDuplicateRow = (polozka) => {
    return data.some((row) => row.polozka === polozka);
  };

  // Funkce pro zpracování změny Aktivni přepínače
  const handleToggleAktivni = (polozka, isActive) => {
    handleEdit(polozka, 'Aktivni', isActive ? 1 : 0);
  };

  // Funkce pro uložení všech změn
  const handleSave = () => {
    const username = getUsername();
    // Získání pouze změněných řádků
    const modifiedRows = Object.keys(editedData).map((polozka) => {
      const originalRow = data.find((row) => row.polozka === polozka);
      const changes = editedData[polozka];
      return {
        ...originalRow,
        ...changes,
        datum_zapsani: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        zapsal: username,
      };
    });

    // Sanitizace dat: odstranění prázdných polí, pole 'id' a 'isNew' a mapování jednotlivých polí
    const sanitizedData = modifiedRows.map((item) => {
      const sanitizedItem = {};
      Object.keys(item).forEach((key) => {
        const value = item[key];
        if (
          key !== 'id' &&
          key !== 'isNew' &&
          value !== '' &&
          value !== null &&
          value !== undefined
        ) {
          if (key === 'limit') {
            sanitizedItem['Limit'] = value;
          } else if (key === 'prodano') {
            sanitizedItem['Prodano'] = value;
          } else if (key === 'Aktivni') {
            sanitizedItem['Aktivni'] = value;
          } else if (key === 'conti') {
            sanitizedItem['Conti'] = value;
          } else if (key === 'pointS') {
            sanitizedItem['PointS'] = value;
          } else {
            sanitizedItem[key] = value;
          }
        }
      });
      if (sanitizedItem.polozka) {
        sanitizedItem.polozka = sanitizedItem.polozka.trim();
      }
      return sanitizedItem;
    });

    const validData = sanitizedData.filter((item) => item && item.polozka);

    fetch(`${process.env.REACT_APP_API_URL}/update-data-netto`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validData),
    })
      .then((response) => {
        if (response.ok) {
          showNotification('Data byla úspěšně uložena.', 'success');
          fetchData();
        } else {
          return response.text().then((text) => {
            throw new Error(text);
          });
        }
      })
      .catch((error) => {
        console.error('Error updating data:', error);
        showNotification(`Chyba při ukládání dat: ${error.message}`, 'error');
      });
  };

  // Funkce pro uložení konkrétního řádku
  const handleSaveRow = (polozka) => {
    const username = getUsername();
    const originalRow = data.find((row) => row.polozka === polozka);
    if (!originalRow) {
      showNotification(`Řádek s položkou ${polozka} nebyl nalezen.`, 'error');
      return;
    }

    const item = {
      ...originalRow,
      ...editedData[polozka],
      datum_zapsani: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      zapsal: username,
    };

    const sanitizedData = Object.keys(item).reduce((acc, key) => {
      const value = item[key];
      if (
        key !== 'id' &&
        key !== 'isNew' &&
        value !== '' &&
        value !== null &&
        value !== undefined
      ) {
        if (key === 'limit') {
          acc['Limit'] = value;
        } else if (key === 'prodano') {
          acc['Prodano'] = value;
        } else if (key === 'Aktivni') {
          acc['Aktivni'] = value;
        } else if (key === 'conti') {
          acc['Conti'] = value;
        } else if (key === 'pointS') {
          acc['PointS'] = value;
        } else {
          acc[key] = value;
        }
      }
      return acc;
    }, {});

    if (sanitizedData.polozka) {
      sanitizedData.polozka = sanitizedData.polozka.trim();
    }

    fetch(`${process.env.REACT_APP_API_URL}/update-data-netto`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([sanitizedData]),
    })
      .then((response) => {
        if (response.ok) {
          showNotification('Řádek byl úspěšně uložen.', 'success');
          setData((prevData) =>
            prevData.map((row) =>
              row.polozka === polozka ? { ...row, ...editedData[polozka], isNew: false } : row
            )
          );
          setEditedData((prev) => {
            const copy = { ...prev };
            delete copy[polozka];
            return copy;
          });
        } else {
          return response.text().then((text) => {
            throw new Error(text);
          });
        }
      })
      .catch((error) => {
        console.error('Error updating row:', error);
        showNotification(`Chyba při ukládání řádku: ${error.message}`, 'error');
      });
  };

  // Funkce pro získání dat z API
  const fetchData = () => {
    const queryParams = new URLSearchParams(remoteFilters).toString();

    fetch(`${process.env.REACT_APP_API_URL}/get-kalkulace-cen-netto?${queryParams}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch data.');
        }
        return response.json();
      })
      .then((fetchedData) => {
        const tzData = fetchedData.map((item) => {
          const { Limit, Prodano, Aktivni, Conti, PointS, ...rest } = item;
          return {
            ...rest,
            conti: Conti != null ? parseInt(Conti, 10) : 0,
            pointS: PointS != null ? parseInt(PointS, 10) : 0,
            limit: Limit != null ? parseInt(Limit, 10) : 0,
            prodano: Prodano != null ? parseInt(Prodano, 10) : 0,
            Aktivni: Aktivni != null ? parseInt(Aktivni, 10) : 1,
            platnost_od:
              item.platnost_od && !isNaN(Date.parse(item.platnost_od))
                ? format(parseISO(item.platnost_od), 'yyyy-MM-dd')
                : null,
            platnost_do:
              item.platnost_do && !isNaN(Date.parse(item.platnost_do))
                ? format(parseISO(item.platnost_do), 'yyyy-MM-dd')
                : null,
            datum_zapsani:
              item.datum_zapsani && !isNaN(Date.parse(item.datum_zapsani))
                ? format(parseISO(item.datum_zapsani), 'yyyy-MM-dd')
                : null,
            isNew: false,
          };
        });
        setData(tzData);
        setEditedData({});
      })
      .catch((error) => {
        console.error('Error fetching data:', error);
        showNotification(`Chyba při načítání dat: ${error.message}`, 'error');
      });
  };

  // Načtení dat při změně vzdálených filtrů
  useEffect(() => {
    fetchData();
  }, [remoteFilters]);

  // Načtení dat při prvotním načtení komponenty
  useEffect(() => {
    fetchData();
  }, []);

  // useEffect pro scrollování na konec tabulky
  useEffect(() => {
    if (scrollToEnd && tableContainerRef.current) {
      tableContainerRef.current.scrollTo({
        top: tableContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
      setScrollToEnd(false);
    }
  }, [data, scrollToEnd]);

  // Funkce pro přidání nového řádku
  const addRow = () => {
    setIsGroupDialogOpen(true);
  };

  // Zavření dialogu pro skupinu produktů
  const handleGroupDialogClose = () => {
    setIsGroupDialogOpen(false);
  };

  // Potvrzení dialogu pro skupinu produktů
  const handleGroupDialogConfirm = () => {
    setIsGroupDialogOpen(false);
    setNewRowId(Date.now());
    setIsModalOpen(true);
  };

  // Funkce pro odstranění řádku podle 'polozka'
  const removeRow = (polozka) => {
    const confirmed = window.confirm('Opravdu chcete odebrat tento řádek?');
    if (confirmed) {
      const row = data.find((row) => row.polozka === polozka);
      if (row.isNew) {
        setData((prevData) => prevData.filter((r) => r.polozka !== polozka));
        setEditedData((prev) => {
          const copy = { ...prev };
          delete copy[polozka];
          return copy;
        });
        showNotification('Nový řádek byl odstraněn.', 'info');
      } else {
        fetch(`${process.env.REACT_APP_API_URL}/delete-data-netto/${polozka}`, {
          method: 'DELETE',
        })
          .then((response) => {
            if (response.ok) {
              setData((prevData) => prevData.filter((r) => r.polozka !== polozka));
              setEditedData((prev) => {
                const copy = { ...prev };
                delete copy[polozka];
                return copy;
              });
              showNotification('Řádek byl úspěšně odstraněn.', 'success');
            } else {
              throw new Error('Failed to delete item.');
            }
          })
          .catch((error) => {
            console.error('Error deleting item:', error);
            showNotification(`Chyba při odstraňování řádku: ${error.message}`, 'error');
          });
      }
    }
  };

  // Funkce pro výběr produktů z modalu (multiselect)
  const handleSelectItems = (items) => {
    if (items && items.length > 0) {
      const duplicateItems = [];
      const newRows = [];

      items.forEach((item) => {
        if (isDuplicateRow(item.ItemId)) {
          const existingRow = data.find((r) => r.polozka === item.ItemId);
          if (existingRow) {
            newRows.push({
              id: Date.now() + Math.random(),
              polozka: item.ItemId,
              nazev_polozky: item.ItemName,
              '1_eshop': existingRow['1_eshop'] || '',
              '2_pult': existingRow['2_pult'] || '',
              '3_servis': existingRow['3_servis'] || '',
              '4_vo': existingRow['4_vo'] || '',
              '5_vip': existingRow['5_vip'] || '',
              '6_indiv': existingRow['6_indiv'] || '',
              '7_dopravci': existingRow['7_dopravci'] || '',
              B2B: existingRow.B2B || '',
              conti: existingRow.conti || 0,
              pointS: existingRow.pointS || 0,
              EXT_eshop: existingRow.EXT_eshop || '',
              platnost_od: existingRow.platnost_od || null,
              platnost_do: existingRow.platnost_do || null,
              marze: existingRow.marze || '',
              datum_zapsani: existingRow.datum_zapsani || '',
              zapsal: existingRow.zapsal || '',
              skladem: existingRow.skladem || null,
              Aktivni: existingRow.Aktivni || 1,
              isNew: true,
              prodano: existingRow.prodano || 0,
              limit: existingRow.limit || 0,
            });
          } else {
            duplicateItems.push(item.ItemId);
          }
        } else {
          newRows.push({
            id: Date.now() + Math.random(),
            polozka: item.ItemId,
            nazev_polozky: item.ItemName,
            '1_eshop': '',
            '2_pult': '',
            '3_servis': '',
            '4_vo': '',
            '5_vip': '',
            '6_indiv': '',
            '7_dopravci': '',
            B2B: '',
            conti: 0,
            pointS: 0,
            EXT_eshop: '',
            platnost_od: null,
            platnost_do: null,
            marze: '',
            datum_zapsani: '',
            zapsal: '',
            skladem: null,
            Aktivni: 1,
            isNew: true,
            prodano: 0,
            limit: 0,
          });
        }
      });

      if (duplicateItems.length > 0) {
        showNotification(
          `Některé položky již existují a byly zkopírovány: ${duplicateItems.join(', ')}`,
          'warning'
        );
      }

      if (newRows.length > 0) {
        setData((prev) => [...prev, ...newRows]);
        setScrollToEnd(true);
      }
    }
  };

  // Funkce pro kliknutí na produkt a navigaci na detail
  const handleProductClick = (polozka) => {
    navigate(`/productdetail/${polozka}`);
  };

  // Funkce pro nastavení stylu řádku na základě platnosti a Aktivni
  const getRowStyle = (row) => {
    const aktivniValue =
      editedData[row.polozka]?.Aktivni !== undefined
        ? editedData[row.polozka].Aktivni
        : row.Aktivni;

    if (aktivniValue === 0) {
      return { backgroundColor: 'gray' };
    }
    if (row.isNew) {
      return { backgroundColor: 'lightblue' };
    }

    const today = new Date();
    const startDate = row.platnost_od ? parseISO(row.platnost_od) : null;
    const endDate = row.platnost_do ? parseISO(row.platnost_do) : null;

    if (!startDate || !endDate) {
      return { backgroundColor: 'red' };
    }

    const timeLeft = (endDate - today) / (1000 * 3600 * 24);

    if (today >= startDate && today <= endDate) {
      if (timeLeft <= 7) {
        return { backgroundColor: 'orange' };
      }
      return { backgroundColor: 'green' };
    }

    return { backgroundColor: 'red' };
  };

  // Styl pro upravené buňky
  const modifiedStyle = { backgroundColor: 'yellow', padding: '0 5px' };

  // Funkce pro kontrolu, zda hodnota byla změněna
  const isValueChanged = (polozka, field) => {
    const originalRow = data.find((row) => row.polozka === polozka);
    if (!originalRow) return false;
    if (originalRow.isNew) return true;
    return (
      editedData[polozka] &&
      editedData[polozka][field] !== undefined &&
      editedData[polozka][field] !== originalRow[field]
    );
  };

  // Funkce pro zachycení stisku klávesy Enter při úpravě buněk
  const handleKeyPress = (event, polozka, field) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleEdit(polozka, field, event.target.innerText);
      event.target.blur();
    }
  };

  // Funkce pro změnu filtrů
  const handleFilterChange = (filterName, filterValue, filterType) => {
    if (filterType === 'local') {
      setLocalFilters((prev) => ({ ...prev, [filterName]: filterValue }));
    } else if (filterType === 'remote') {
      setRemoteFilters((prev) => ({ ...prev, [filterName]: filterValue }));
    }
  };

  // Funkce pro aktualizaci dat (Refresh)
  const handleRefresh = () => {
    fetchData();
    showNotification('Data byla aktualizována.', 'info');
  };

  // Filtrování dat na základě lokálních filtrů
  const filteredData = data.filter((row) => {
    return Object.keys(localFilters).every((key) => {
      const value = localFilters[key];
      if (!value) return true;
      return row[key]?.toString().toLowerCase().includes(value.toLowerCase());
    });
  });

  return (
    <Box
      sx={{
        position: 'relative',
        height: 'calc(100vh - 64px)', // Odečteme výšku AppBaru nebo jiného horního prvku
        overflow: 'hidden',
      }}
    >
      {/* Header s tlačítky akce */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '16px',
          position: 'sticky',
          top: 0,
          backgroundColor: 'white',
          zIndex: 3,
        }}
      >
        <Button variant="contained" color="primary" onClick={handleSave}>
          Uložit změny
        </Button>
        <Button variant="contained" color="secondary" onClick={addRow}>
          Přidat řádek
        </Button>
        <h3 style={{ flexGrow: 1 }}>Netto ceny</h3>
        <Box sx={{ display: 'flex', gap: '8px' }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => {
              setRemoteFilters({});
              setLocalFilters({});
            }}
          >
            Vše
          </Button>
          <Button
            variant="outlined"
            color="success"
            onClick={() => {
              setRemoteFilters((prev) => ({ ...prev, status: 'valid' }));
              setLocalFilters({});
            }}
          >
            Platné
          </Button>
          <Button
            variant="outlined"
            color="warning"
            onClick={() => {
              setRemoteFilters((prev) => ({ ...prev, status: 'expiring' }));
              setLocalFilters({});
            }}
          >
            Končící
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => {
              setRemoteFilters((prev) => ({ ...prev, status: 'invalid' }));
              setLocalFilters({});
            }}
          >
            Neplatné
          </Button>
        </Box>
        <Tooltip title="Aktualizovat">
          <IconButton color="primary" onClick={handleRefresh}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Tabulka s fixní hlavičkou */}
      <TableContainer
        component={Paper}
        sx={{
          height: 'calc(100% - 72px)',
          overflowY: 'auto',
        }}
        ref={tableContainerRef}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                Položka{' '}
                <ColumnFilter filterName="polozka" onChange={handleFilterChange} filterType="remote" />
              </TableCell>
              <TableCell>
                Název{' '}
                <ColumnFilter filterName="nazev_polozky" onChange={handleFilterChange} filterType="local" />
              </TableCell>
              {[
                '1_eshop',
                '2_pult',
                '3_servis',
                '4_vo',
                '5_vip',
                '6_indiv',
                '7_dopravci',
                'B2B',
                'conti',
                'pointS',
                'EXT_eshop',
                'prodano',
                'limit',
                'platnost_od',
                'platnost_do',
                'marze',
                'datum_zapsani',
                'zapsal',
              ].map((header) => (
                <TableCell key={header}>
                  {header === 'datum_zapsani'
                    ? 'Datum Zapsání'
                    : header === 'marze'
                    ? 'Marže'
                    : header === 'prodano'
                    ? 'Prodáno'
                    : header === 'limit'
                    ? 'Limit'
                    : header === 'conti'
                    ? 'Conti'
                    : header === 'pointS'
                    ? 'PointS'
                    : header.charAt(0).toUpperCase() + header.slice(1).replace('_', ' ')}
                  <ColumnFilter
                    filterName={header}
                    onChange={handleFilterChange}
                    filterType={
                      ['prodano', 'limit', 'conti', 'pointS'].includes(header)
                        ? 'local'
                        : ['polozka', '1_eshop', '2_pult', '3_servis', '4_vo', '5_vip', '6_indiv', '7_dopravci', 'B2B'].includes(header)
                        ? 'remote'
                        : 'local'
                    }
                  />
                </TableCell>
              ))}
              <TableCell>Akce</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData.map((row) => {
              const isNewRow = row.isNew;
              return (
                <TableRow
                  key={row.polozka + (isNewRow ? '_new' : '')}
                  style={getRowStyle(row)}
                  ref={isNewRow ? newRowRef : null}
                >
                  <TableCell
                    contentEditable
                    onBlur={(e) => handleEdit(row.polozka, 'polozka', e.target.innerText.trim())}
                    style={isValueChanged(row.polozka, 'polozka') ? modifiedStyle : null}
                    onClick={() => handleProductClick(row.polozka)}
                  >
                    {row.polozka}
                  </TableCell>
                  <TableCell
                    contentEditable
                    onBlur={(e) => handleEdit(row.polozka, 'nazev_polozky', e.target.innerText)}
                    style={isValueChanged(row.polozka, 'nazev_polozky') ? modifiedStyle : null}
                    onKeyDown={(e) => handleKeyPress(e, row.polozka, 'nazev_polozky')}
                  >
                    {row.nazev_polozky}
                  </TableCell>
                  {[
                    '1_eshop',
                    '2_pult',
                    '3_servis',
                    '4_vo',
                    '5_vip',
                    '6_indiv',
                    '7_dopravci',
                    'B2B',
                  ].map((field) => (
                    <TableCell
                      key={field}
                      contentEditable
                      onBlur={(e) => handleEdit(row.polozka, field, e.target.innerText)}
                      onKeyDown={(e) => handleKeyPress(e, row.polozka, field)}
                      style={isValueChanged(row.polozka, field) ? modifiedStyle : null}
                    >
                      {row[field]}
                    </TableCell>
                  ))}
                  {/* Conti */}
                  <TableCell
                    contentEditable
                    onBlur={(e) => {
                      const value = parseInt(e.target.innerText, 10);
                      handleEdit(row.polozka, 'conti', isNaN(value) ? 0 : value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const value = parseInt(e.target.innerText, 10);
                        handleEdit(row.polozka, 'conti', isNaN(value) ? 0 : value);
                        e.target.blur();
                      }
                    }}
                    style={isValueChanged(row.polozka, 'conti') ? modifiedStyle : null}
                  >
                    {row.conti}
                  </TableCell>
                  {/* PointS */}
                  <TableCell
                    contentEditable
                    onBlur={(e) => {
                      const value = parseInt(e.target.innerText, 10);
                      handleEdit(row.polozka, 'pointS', isNaN(value) ? 0 : value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const value = parseInt(e.target.innerText, 10);
                        handleEdit(row.polozka, 'pointS', isNaN(value) ? 0 : value);
                        e.target.blur();
                      }
                    }}
                    style={isValueChanged(row.polozka, 'pointS') ? modifiedStyle : null}
                  >
                    {row.pointS}
                  </TableCell>
                  {/* EXT_eshop */}
                  <TableCell
                    contentEditable
                    onBlur={(e) => handleEdit(row.polozka, 'EXT_eshop', e.target.innerText)}
                    onKeyDown={(e) => handleKeyPress(e, row.polozka, 'EXT_eshop')}
                    style={isValueChanged(row.polozka, 'EXT_eshop') ? modifiedStyle : null}
                  >
                    {row.EXT_eshop}
                  </TableCell>
                  {/* Prodano */}
                  <TableCell>{row.prodano}</TableCell>
                  {/* Limit */}
                  <TableCell
                    contentEditable
                    onBlur={(e) => {
                      const value = parseInt(e.target.innerText, 10);
                      handleEdit(row.polozka, 'limit', isNaN(value) ? 0 : value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const value = parseInt(e.target.innerText, 10);
                        handleEdit(row.polozka, 'limit', isNaN(value) ? 0 : value);
                        e.target.blur();
                      }
                    }}
                    style={isValueChanged(row.polozka, 'limit') ? modifiedStyle : null}
                  >
                    {row.limit}
                  </TableCell>
                  {/* Platnost od */}
                  <TableCell style={{ padding: 0 }}>
                    <DatePicker
                      selected={
                        editedData[row.polozka]?.platnost_od
                          ? parseISO(editedData[row.polozka].platnost_od)
                          : row.platnost_od
                          ? parseISO(row.platnost_od)
                          : null
                      }
                      onChange={(date) => handleDateChange(row.polozka, 'platnost_od', date)}
                      dateFormat="yyyy-MM-dd"
                      placeholderText="Vyberte datum"
                      customInput={
                        <TextField
                          variant="standard"
                          fullWidth
                          InputProps={{
                            disableUnderline: true,
                            style: { padding: '0', width: '100%' },
                          }}
                        />
                      }
                      wrapperClassName="datePickerWrapper"
                    />
                  </TableCell>
                  {/* Platnost do */}
                  <TableCell style={{ padding: 0 }}>
                    <DatePicker
                      selected={
                        editedData[row.polozka]?.platnost_do
                          ? parseISO(editedData[row.polozka].platnost_do)
                          : row.platnost_do
                          ? parseISO(row.platnost_do)
                          : null
                      }
                      onChange={(date) => handleDateChange(row.polozka, 'platnost_do', date)}
                      dateFormat="yyyy-MM-dd"
                      placeholderText="Vyberte datum"
                      customInput={
                        <TextField
                          variant="standard"
                          fullWidth
                          InputProps={{
                            disableUnderline: true,
                            style: { padding: '0', width: '100%' },
                          }}
                        />
                      }
                      wrapperClassName="datePickerWrapper"
                    />
                  </TableCell>
                  {/* Marže */}
                  <TableCell
                    contentEditable
                    onBlur={(e) => handleEdit(row.polozka, 'marze', e.target.innerText.trim())}
                    onKeyDown={(e) => handleKeyPress(e, row.polozka, 'marze')}
                    style={isValueChanged(row.polozka, 'marze') ? modifiedStyle : null}
                  >
                    {row.marze}
                  </TableCell>
                  {/* Datum Zapsání */}
                  <TableCell
                    contentEditable
                    onBlur={(e) =>
                      handleEdit(row.polozka, 'datum_zapsani', e.target.innerText.trim())
                    }
                    onKeyDown={(e) => handleKeyPress(e, row.polozka, 'datum_zapsani')}
                    style={isValueChanged(row.polozka, 'datum_zapsani') ? modifiedStyle : null}
                  >
                    {row.datum_zapsani}
                  </TableCell>
                  {/* Zapsal */}
                  <TableCell
                    contentEditable
                    onBlur={(e) => handleEdit(row.polozka, 'zapsal', e.target.innerText.trim())}
                    onKeyDown={(e) => handleKeyPress(e, row.polozka, 'zapsal')}
                    style={isValueChanged(row.polozka, 'zapsal') ? modifiedStyle : null}
                  >
                    {row.zapsal}
                  </TableCell>
                  {/* Aktivni a Akce */}
                  <TableCell>
                    <Switch
                      checked={
                        editedData[row.polozka]?.Aktivni !== undefined
                          ? editedData[row.polozka].Aktivni === 1
                          : row.Aktivni === 1
                      }
                      onChange={(e) => handleToggleAktivni(row.polozka, e.target.checked)}
                      color="primary"
                      inputProps={{ 'aria-label': 'Aktivní přepínač' }}
                    />
                    <Button
                      variant="contained"
                      color="error"
                      onClick={() => removeRow(row.polozka)}
                      size="small"
                      sx={{ ml: 1 }}
                    >
                      Odebrat
                    </Button>
                    {isRowChanged(row.polozka) && (
                      <Button
                        variant="contained"
                        color="success"
                        onClick={() => handleSaveRow(row.polozka)}
                        sx={{ ml: 1 }}
                        size="small"
                      >
                        Uložit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Modal pro výběr produktů */}
      {isModalOpen && (
        <SearchProductModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSelectItems={handleSelectItems}
          productGroup={productGroup}
        />
      )}

      {/* Dialog pro zadání skupiny produktů */}
      <Dialog open={isGroupDialogOpen} onClose={handleGroupDialogClose}>
        <DialogTitle>Zadejte skupinu produktů</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Skupina produktů"
            type="text"
            fullWidth
            value={productGroup}
            onChange={(e) => setProductGroup(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleGroupDialogClose} color="primary">
            Zrušit
          </Button>
          <Button onClick={handleGroupDialogConfirm} color="primary">
            Potvrdit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar pro notifikace */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Přidání vlastní CSS pro `DatePicker` */}
      <style jsx="true">{`
        .datePickerWrapper {
          width: 100%;
        }
        .react-datepicker-wrapper,
        .react-datepicker__input-container {
          width: 100%;
        }
        .react-datepicker__input-container input {
          width: 100%;
          height: 100%;
          padding: 0; /* Minimalizace odsazení */
          box-sizing: border-box;
          border: none;
          outline: none;
          font-size: 14px;
        }
        .react-datepicker__triangle {
          display: none;
        }
      `}</style>
    </Box>
  );
}

export default Netto;
