// AkcePolozka.js
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
import { jwtDecode } from 'jwt-decode'; // Ujistěte se, že import odpovídá verzi

function AkcePolozka() {
  const [data, setData] = useState([]);
  const [editedData, setEditedData] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [productGroup, setProductGroup] = useState('');
  const newRowRef = useRef(null);
  const tableContainerRef = useRef(null);
  const [scrollToEnd, setScrollToEnd] = useState(false);

  // Filtry – lokální a vzdálené
  const [remoteFilters, setRemoteFilters] = useState({});
  const [localFilters, setLocalFilters] = useState({});

  const navigate = useNavigate();

  const getUsername = () => {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        return decoded.username || 'Neznámý uživatel';
      } catch (error) {
        console.error('Chyba při dekódování tokenu:', error);
        return 'Neznámý uživatel';
      }
    }
    return 'Neznámý uživatel';
  };

  // Notifikace
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success', // 'success' | 'error' | 'warning' | 'info'
  });

  const showNotification = (message, severity = 'success') => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = (event, reason) => {
    if (reason === 'clickaway') return;
    setNotification((prev) => ({ ...prev, open: false }));
  };

  // Úprava buněk
  const handleEdit = (polozka, field, value) => {
    setEditedData((prev) => ({
      ...prev,
      [polozka]: {
        ...prev[polozka],
        [field]: value,
      },
    }));
  };

  const handleDateChange = (polozka, field, value) => {
    if (value instanceof Date) {
      const formattedDate = format(value, 'yyyy-MM-dd');
      handleEdit(polozka, field, formattedDate);
    } else {
      handleEdit(polozka, field, null);
    }
  };

  const isRowChanged = (polozka) => {
    const originalRow = data.find((row) => row.polozka === polozka);
    if (!originalRow) return false;
    if (originalRow.isNew) return true; // Nové řádky jsou považovány za změněné
    return editedData[polozka] && Object.keys(editedData[polozka]).length > 0;
  };

  const isDuplicateRow = (polozka) => {
    return data.some((row) => row.polozka === polozka);
  };

  const handleToggleAktivni = (polozka, isActive) => {
    console.log(`Toggling Aktivni for ${polozka} to ${isActive ? 1 : 0}`);
    handleEdit(polozka, 'Aktivni', isActive ? 1 : 0);
  };

  // Ukládání všech změn
  const handleSave = () => {
    const username = getUsername();
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

    // Sanitizace – odstraníme nepotřebná pole a prázdné hodnoty
    const sanitizedData = modifiedRows.map((item) => {
      const sanitizedItem = {};
      Object.keys(item).forEach((key) => {
        if (
          key !== 'id' &&
          key !== 'isNew' &&
          item[key] !== '' &&
          item[key] !== null &&
          item[key] !== undefined
        ) {
          // Přemapování je nutné pouze u netto verzí (prodano, limit)
          if (key === 'limit') {
            sanitizedItem['Limit'] = item[key];
          } else if (key === 'prodano') {
            sanitizedItem['Prodano'] = item[key];
          } else if (key === 'Aktivni') {
            sanitizedItem['Aktivni'] = item[key];
          } else {
            sanitizedItem[key] = item[key];
          }
        }
      });
      if (sanitizedItem.polozka) {
        sanitizedItem.polozka = sanitizedItem.polozka.trim();
      }
      return sanitizedItem;
    });

    const validData = sanitizedData.filter((item) => item && item.polozka);

    console.log('Data to be sent:', JSON.stringify(validData, null, 2));

    // POZOR: endpoint upravíme následně
    fetch(`${process.env.REACT_APP_API_URL}/update-data-akcepolozka`, {
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

  const handleSaveRow = (polozka) => {
    const username = getUsername();
    const originalRow = data.find((row) => row.polozka === polozka);
    if (!originalRow) {
      console.error(`Row with polozka ${polozka} not found.`);
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
        // Přemapování
        if (key === 'limit') {
          acc['Limit'] = value;
        } else if (key === 'prodano') {
          acc['Prodano'] = value;
        } else if (key === 'Aktivni') {
          acc['Aktivni'] = value;
        } else {
          acc[key] = value;
        }
      }
      return acc;
    }, {});

    if (sanitizedData.polozka) {
      sanitizedData.polozka = sanitizedData.polozka.trim();
    }

    console.log('Row to be sent:', JSON.stringify(sanitizedData, null, 2));

    // POZOR: endpoint upravíme následně
    fetch(`${process.env.REACT_APP_API_URL}/update-data-akcepolozka`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([sanitizedData]),
    })
      .then((response) => {
        if (response.ok) {
          console.log('Row successfully updated.');
          showNotification('Řádek byl úspěšně uložen.', 'success');
          setData((prevData) =>
            prevData.map((row) => {
              if (row.polozka === polozka) {
                return { ...row, ...editedData[polozka], isNew: false };
              }
              return row;
            })
          );
          setEditedData((prev) => {
            const newEditedData = { ...prev };
            delete newEditedData[polozka];
            return newEditedData;
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

  // Načítání dat
  const fetchData = () => {
    const queryParams = new URLSearchParams(remoteFilters).toString();

    // Pokud bychom chtěli odlišný endpoint, provedeme úpravu zde:
    fetch(`${process.env.REACT_APP_API_URL}/get-kalkulace-cen-akcepolozka?${queryParams}`, {
      method: 'GET',
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch data.');
        }
        return response.json();
      })
      .then((fetchedData) => {
        console.log('Fetched data:', fetchedData);
        // Přemapování dat podle struktury netto
        const tzData = fetchedData.map((item) => {
          const { Limit, Prodano, Aktivni, ...rest } = item;
          return {
            ...rest,
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
            limit: Limit !== null ? parseInt(Limit, 10) : 0,
            prodano: Prodano !== null ? parseInt(Prodano, 10) : 0,
            Aktivni:
              Aktivni !== null && Aktivni !== undefined
                ? parseInt(Aktivni, 10)
                : 1,
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

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteFilters]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scrollToEnd && tableContainerRef.current) {
      tableContainerRef.current.scrollTo({
        top: tableContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
      setScrollToEnd(false);
    }
  }, [data, scrollToEnd]);

  // Přidání nového řádku – otevře se dialog pro zadání skupiny a poté modal s výběrem produktu
  const addRow = () => {
    setIsGroupDialogOpen(true);
  };

  const handleGroupDialogClose = () => {
    setIsGroupDialogOpen(false);
  };

  const handleGroupDialogConfirm = () => {
    setIsGroupDialogOpen(false);
    setIsModalOpen(true);
  };

  // Odstranění řádku
  const removeRow = (polozka) => {
    const confirmed = window.confirm('Opravdu chcete odebrat tento řádek?');
    if (confirmed) {
      const row = data.find((row) => row.polozka === polozka);
      if (row.isNew) {
        setData((prevData) => prevData.filter((row) => row.polozka !== polozka));
        setEditedData((prev) => {
          const newEditedData = { ...prev };
          delete newEditedData[polozka];
          return newEditedData;
        });
        showNotification('Nový řádek byl odstraněn.', 'info');
      } else {
        fetch(`${process.env.REACT_APP_API_URL}/delete-data-akcepolozka/${polozka}`, {
          method: 'DELETE',
        })
          .then((response) => {
            if (response.ok) {
              const newData = data.filter((row) => row.polozka !== polozka);
              const newEditedData = Object.keys(editedData).reduce((acc, key) => {
                if (key !== polozka) {
                  acc[key] = editedData[key];
                }
                return acc;
              }, {});
              setData(newData);
              setEditedData(newEditedData);
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

  // Výběr produktů z modalu (multiselect)
  const handleSelectItems = (items) => {
    if (items && items.length > 0) {
      const duplicateItems = [];
      const newRows = [];

      items.forEach((item) => {
        if (isDuplicateRow(item.ItemId)) {
          const existingRow = data.find((row) => row.polozka === item.ItemId);
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
              B2B: existingRow['B2B'] || '',
              EXT_eshop: existingRow['EXT_eshop'] || '',
              prodano: existingRow.prodano || 0,
              limit: existingRow.limit || 0,
              platnost_od: existingRow.platnost_od || null,
              platnost_do: existingRow.platnost_do || null,
              marze: existingRow.marze || '',
              datum_zapsani: existingRow.datum_zapsani || '',
              zapsal: existingRow.zapsal || '',
              Aktivni: existingRow.Aktivni || 1,
              isNew: true,
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
            EXT_eshop: '',
            prodano: 0,
            limit: 0,
            platnost_od: null,
            platnost_do: null,
            marze: '',
            datum_zapsani: '',
            zapsal: '',
            Aktivni: 1,
            isNew: true,
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
        setData((prevData) => [...prevData, ...newRows]);
        setScrollToEnd(true);
      }
    }
  };

  // Přechod na detail produktu
  const handleProductClick = (polozka) => {
    navigate(`/productdetail/${polozka}`);
  };

  // Určení stylu řádku dle platnosti a stavu Aktivni
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

  const modifiedStyle = { backgroundColor: 'yellow', padding: '0 5px' };

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

  const handleKeyPress = (event, polozka, field) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleEdit(polozka, field, event.target.innerText);
      event.target.blur();
    }
  };

  const handleFilterChange = (filterName, filterValue, filterType) => {
    if (filterType === 'local') {
      setLocalFilters((prev) => ({ ...prev, [filterName]: filterValue }));
    } else if (filterType === 'remote') {
      setRemoteFilters((prev) => ({ ...prev, [filterName]: filterValue }));
    }
  };

  const handleRefresh = () => {
    fetchData();
    showNotification('Data byla aktualizována.', 'info');
  };

  // Použijeme pole sloupců, které odpovídá netto cenám:
  const tableColumns = [
    '1_eshop',
    '2_pult',
    '3_servis',
    '4_vo',
    '5_vip',
    '6_indiv',
    '7_dopravci',
    'B2B',
    'EXT_eshop',
    'prodano',
    'limit',
    'platnost_od',
    'platnost_do',
    'marze',
    'datum_zapsani',
    'zapsal',
  ];

  return (
    <Box
      sx={{
        position: 'relative',
        height: 'calc(100vh - 64px)', // Odečteme výšku AppBaru či jiného horního prvku
        overflow: 'hidden',
      }}
    >
      {/* Header */}
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
        <h3 style={{ flexGrow: 1 }}>Akce položka</h3>
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

      {/* Tabulka */}
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
              {tableColumns.map((header) => (
                <TableCell key={header}>
                  {header === 'datum_zapsani'
                    ? 'Datum Zapsání'
                    : header === 'marze'
                    ? 'Marže'
                    : header === 'prodano'
                    ? 'Prodáno'
                    : header === 'limit'
                    ? 'Limit'
                    : header.charAt(0).toUpperCase() + header.slice(1).replace('_', ' ')}
                  <ColumnFilter filterName={header} onChange={handleFilterChange} filterType="local" />
                </TableCell>
              ))}
              <TableCell>Akce</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data
              .filter((row) =>
                Object.keys(localFilters).every((key) => {
                  const value = localFilters[key];
                  if (!value) return true;
                  return row[key]?.toString().toLowerCase().includes(value.toLowerCase());
                })
              )
              .map((row) => {
                const isNewRow = row.isNew;
                return (
                  <TableRow
                    key={row.polozka + (isNewRow ? '_new' : '')}
                    style={getRowStyle(row)}
                    ref={isNewRow ? newRowRef : null}
                  >
                    {/* Položka */}
                    <TableCell
                      contentEditable
                      onBlur={(e) =>
                        handleEdit(row.polozka, 'polozka', e.target.innerText.trim())
                      }
                      style={isValueChanged(row.polozka, 'polozka') ? modifiedStyle : null}
                      onClick={() => handleProductClick(row.polozka)}
                    >
                      {row.polozka}
                    </TableCell>
                    {/* Název */}
                    <TableCell
                      contentEditable
                      onBlur={(e) => handleEdit(row.polozka, 'nazev_polozky', e.target.innerText)}
                      style={isValueChanged(row.polozka, 'nazev_polozky') ? modifiedStyle : null}
                      onKeyDown={(e) => handleKeyPress(e, row.polozka, 'nazev_polozky')}
                    >
                      {row.nazev_polozky}
                    </TableCell>
                    {/* Dynamicky generované sloupce */}
                    {tableColumns.map((col) => {
                      // U některých sloupců nechceme umožnit editaci (např. prodano)
                      if (col === 'prodano') {
                        return (
                          <TableCell key={col}>
                            {row.prodano}
                          </TableCell>
                        );
                      }
                      if (col === 'limit') {
                        return (
                          <TableCell
                            key={col}
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
                        );
                      }
                      // Pro datumová pole použijeme DatePicker
                      if (col === 'platnost_od' || col === 'platnost_do') {
                        return (
                          <TableCell key={col} style={{ padding: 0 }}>
                            <DatePicker
                              selected={
                                editedData[row.polozka]?.[col]
                                  ? parseISO(editedData[row.polozka][col])
                                  : row[col]
                                  ? parseISO(row[col])
                                  : null
                              }
                              onChange={(date) => handleDateChange(row.polozka, col, date)}
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
                        );
                      }
                      // Ostatní sloupce – inline editace
                      return (
                        <TableCell
                          key={col}
                          contentEditable
                          onBlur={(e) =>
                            handleEdit(row.polozka, col, e.target.innerText)
                          }
                          onKeyDown={(e) => handleKeyPress(e, row.polozka, col)}
                          style={isValueChanged(row.polozka, col) ? modifiedStyle : null}
                        >
                          {row[col]}
                        </TableCell>
                      );
                    })}
                    {/* Akce */}
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
        <Alert onClose={handleCloseNotification} severity={notification.severity} sx={{ width: '100%' }}>
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Vlastní CSS pro DatePicker */}
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
          padding: 0;
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

export default AkcePolozka;
